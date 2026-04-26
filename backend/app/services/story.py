import uuid
from collections.abc import Iterable

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.beat import Beat
from app.models.character import Character
from app.models.draft import DraftContent
from app.models.insight import Insight
from app.models.manuscript import ManuscriptChapter
from app.models.scene import Scene
from app.models.scene_participant import SceneParticipant
from app.models.story import Story
from app.services.core import populate_default_core


STORY_STAT_FIELDS = (
    "scene_count",
    "character_count",
    "active_insight_count",
    "draft_word_count",
    "manuscript_word_count",
    "manuscript_chapter_count",
)


def _empty_story_stats() -> dict[str, int]:
    return {field: 0 for field in STORY_STAT_FIELDS}


async def get_story_stats_map(
    db: AsyncSession,
    story_ids: Iterable[uuid.UUID],
) -> dict[uuid.UUID, dict[str, int]]:
    ids = list(dict.fromkeys(story_ids))
    if not ids:
        return {}

    stats: dict[uuid.UUID, dict[str, int]] = {story_id: _empty_story_stats() for story_id in ids}

    scene_counts = await db.execute(
        select(Scene.story_id, func.count(Scene.id))
        .where(Scene.story_id.in_(ids))
        .group_by(Scene.story_id)
    )
    for story_id, count in scene_counts.all():
        stats[story_id]["scene_count"] = int(count or 0)

    character_counts = await db.execute(
        select(Character.story_id, func.count(Character.id))
        .where(Character.story_id.in_(ids))
        .group_by(Character.story_id)
    )
    for story_id, count in character_counts.all():
        stats[story_id]["character_count"] = int(count or 0)

    active_insight_counts = await db.execute(
        select(Insight.story_id, func.count(Insight.id))
        .where(Insight.story_id.in_(ids), Insight.dismissed.is_(False))
        .group_by(Insight.story_id)
    )
    for story_id, count in active_insight_counts.all():
        stats[story_id]["active_insight_count"] = int(count or 0)

    draft_word_counts = await db.execute(
        select(DraftContent.story_id, func.coalesce(func.sum(DraftContent.word_count), 0))
        .where(DraftContent.story_id.in_(ids))
        .group_by(DraftContent.story_id)
    )
    for story_id, count in draft_word_counts.all():
        stats[story_id]["draft_word_count"] = int(count or 0)

    trimmed_content = func.btrim(func.coalesce(ManuscriptChapter.content, ""))
    chapter_word_count = case(
        (trimmed_content == "", 0),
        else_=func.cardinality(func.regexp_split_to_array(trimmed_content, r"\s+")),
    )
    manuscript_stats = await db.execute(
        select(
            ManuscriptChapter.story_id,
            func.count(ManuscriptChapter.id),
            func.coalesce(func.sum(chapter_word_count), 0),
        )
        .where(ManuscriptChapter.story_id.in_(ids))
        .group_by(ManuscriptChapter.story_id)
    )
    for story_id, chapter_count, word_count in manuscript_stats.all():
        stats[story_id]["manuscript_chapter_count"] = int(chapter_count or 0)
        stats[story_id]["manuscript_word_count"] = int(word_count or 0)

    return stats


async def attach_story_stats(db: AsyncSession, stories: Iterable[Story]) -> list[Story]:
    story_list = list(stories)
    stats_map = await get_story_stats_map(db, [story.id for story in story_list])
    for story in story_list:
        story_stats = stats_map.get(story.id, _empty_story_stats())
        for field, value in story_stats.items():
            setattr(story, field, value)
    return story_list


async def attach_story_stat(db: AsyncSession, story: Story) -> Story:
    await attach_story_stats(db, [story])
    return story


async def list_stories(
    db: AsyncSession,
    org_id: uuid.UUID,
    offset: int = 0,
    limit: int = 50,
    include_archived: bool = False,
    only_archived: bool = False,
) -> tuple[list[Story], int]:
    query = select(Story).where(Story.org_id == org_id)
    count_query = select(func.count()).select_from(Story).where(Story.org_id == org_id)

    if only_archived:
        query = query.where(Story.archived.is_(True))
        count_query = count_query.where(Story.archived.is_(True))
    elif not include_archived:
        query = query.where(Story.archived.is_(False))
        count_query = count_query.where(Story.archived.is_(False))

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    stories = result.scalars().all()
    total = (await db.execute(count_query)).scalar()
    await attach_story_stats(db, stories)
    return list(stories), total


async def get_story(db: AsyncSession, story_id: uuid.UUID) -> Story | None:
    result = await db.execute(select(Story).where(Story.id == story_id))
    return result.scalar_one_or_none()


async def create_story(db: AsyncSession, org_id: uuid.UUID, data: dict) -> Story:
    story = Story(org_id=org_id, **data)
    db.add(story)
    await db.flush()
    await populate_default_core(db, story)
    await db.commit()
    await db.refresh(story)
    return story


async def update_story(db: AsyncSession, story: Story, patch: dict) -> Story:
    for key, value in patch.items():
        if value is not None:
            setattr(story, key, value)
    await db.commit()
    await db.refresh(story)
    return story


async def delete_story(db: AsyncSession, story: Story) -> None:
    await db.delete(story)
    await db.commit()


async def duplicate_story(db: AsyncSession, original: Story) -> Story:
    """Deep-copy the narrative hierarchy: story + chapters + characters +
    scenes (with chapter_id remapped) + participants + beats.

    Intentionally skipped: draft_contents (prose), insights (analysis
    output), graph nodes/edges (regenerated from scenes), core_config /
    core_settings (regenerated by populate_default_core on the new
    story), collaborators / comments / activity_events / export_jobs
    (operational data, not narrative).
    """
    new_story = Story(
        org_id=original.org_id,
        title=f"Copy of {original.title}",
        logline=original.logline,
        genres=list(original.genres or []),
        subgenre=original.subgenre,
        themes=list(original.themes or []),
        target_words=original.target_words,
        draft_number=original.draft_number,
        status=original.status,
        structure_type=original.structure_type,
        story_type=original.story_type,
        archived=False,
    )
    db.add(new_story)
    await db.flush()

    await populate_default_core(db, new_story)

    # Chapters: old_id → new_id
    chapter_rows = (
        await db.execute(
            select(ManuscriptChapter).where(ManuscriptChapter.story_id == original.id)
        )
    ).scalars().all()
    chapter_id_map: dict[uuid.UUID, uuid.UUID] = {}
    for ch in chapter_rows:
        new_ch = ManuscriptChapter(
            org_id=new_story.org_id,
            story_id=new_story.id,
            num=ch.num,
            title=ch.title,
            content=ch.content,
            sort_order=ch.sort_order,
        )
        db.add(new_ch)
        await db.flush()
        chapter_id_map[ch.id] = new_ch.id

    # Characters: old_id → new_id
    character_rows = (
        await db.execute(select(Character).where(Character.story_id == original.id))
    ).scalars().all()
    character_id_map: dict[uuid.UUID, uuid.UUID] = {}
    for c in character_rows:
        new_c = Character(
            org_id=new_story.org_id,
            story_id=new_story.id,
            name=c.name,
            role=c.role,
            archetype=c.archetype,
            description=c.description,
            bio=c.bio,
            desire=c.desire,
            fear=c.fear,
            flaw=c.flaw,
            arc_summary=c.arc_summary,
            relationship_notes=c.relationship_notes,
        )
        db.add(new_c)
        await db.flush()
        character_id_map[c.id] = new_c.id

    # Scenes: old_id → new_id, chapter_id remapped
    scene_rows = (
        await db.execute(
            select(Scene).where(Scene.story_id == original.id).order_by(Scene.n)
        )
    ).scalars().all()
    scene_id_map: dict[uuid.UUID, uuid.UUID] = {}
    for s in scene_rows:
        new_s = Scene(
            org_id=new_story.org_id,
            story_id=new_story.id,
            chapter_id=chapter_id_map.get(s.chapter_id) if s.chapter_id else None,
            n=s.n,
            title=s.title,
            pov=s.pov,
            tension=s.tension,
            act=s.act,
            location=s.location,
            tag=s.tag,
            summary=(s.summary or "").strip() or s.title,
            emotional=s.emotional,
            stakes=s.stakes,
            mystery=s.mystery,
            romance=s.romance,
            danger=s.danger,
            hope=s.hope,
        )
        db.add(new_s)
        await db.flush()
        scene_id_map[s.id] = new_s.id

    # Participants: remap scene_id and character_id
    participant_rows = (
        await db.execute(
            select(SceneParticipant)
            .join(Scene, Scene.id == SceneParticipant.scene_id)
            .where(Scene.story_id == original.id)
        )
    ).scalars().all()
    for p in participant_rows:
        new_char_id = character_id_map.get(p.character_id)
        new_scene_id = scene_id_map.get(p.scene_id)
        if new_char_id is None or new_scene_id is None:
            continue
        db.add(
            SceneParticipant(
                org_id=new_story.org_id,
                scene_id=new_scene_id,
                character_id=new_char_id,
                role=p.role,
                interaction_weight=p.interaction_weight,
            )
        )

    # Beats: remap scene_id
    beat_rows = (
        await db.execute(
            select(Beat)
            .join(Scene, Scene.id == Beat.scene_id)
            .where(Scene.story_id == original.id)
        )
    ).scalars().all()
    for b in beat_rows:
        new_scene_id = scene_id_map.get(b.scene_id)
        if new_scene_id is None:
            continue
        db.add(
            Beat(
                org_id=new_story.org_id,
                scene_id=new_scene_id,
                n=b.n,
                title=b.title,
                kind=b.kind,
                summary=b.summary,
            )
        )

    await db.commit()
    await db.refresh(new_story)
    return new_story
