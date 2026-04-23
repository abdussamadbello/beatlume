import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.character import Character
from app.models.scene import Scene
from app.models.scene_participant import SceneParticipant


async def list_scenes(
    db: AsyncSession,
    story_id: uuid.UUID,
    act: int | None = None,
    pov: str | None = None,
    sort: str | None = None,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[Scene], int]:
    query = (
        select(Scene)
        .where(Scene.story_id == story_id)
        .options(selectinload(Scene.participants))
    )
    count_query = select(func.count()).select_from(Scene).where(Scene.story_id == story_id)

    if act is not None:
        query = query.where(Scene.act == act)
        count_query = count_query.where(Scene.act == act)
    if pov:
        query = query.where(Scene.pov == pov)
        count_query = count_query.where(Scene.pov == pov)

    if sort == "tension":
        query = query.order_by(Scene.tension.desc())
    elif sort == "pov":
        query = query.order_by(Scene.pov, Scene.n)
    else:
        query = query.order_by(Scene.n)

    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    scenes = list(result.scalars().all())
    total = (await db.execute(count_query)).scalar()
    return scenes, total


async def get_scene(db: AsyncSession, story_id: uuid.UUID, scene_id: uuid.UUID) -> Scene | None:
    result = await db.execute(
        select(Scene)
        .where(Scene.id == scene_id, Scene.story_id == story_id)
        .options(selectinload(Scene.participants))
    )
    return result.scalar_one_or_none()


async def create_scene(
    db: AsyncSession,
    story_id: uuid.UUID,
    org_id: uuid.UUID,
    data: dict,
) -> Scene:
    # Auto-assign next scene number
    max_n = await db.execute(
        select(func.max(Scene.n)).where(Scene.story_id == story_id)
    )
    next_n = (max_n.scalar() or 0) + 1

    participants_data = data.pop("participants", None) or []
    # Beat-level line for timeline / exports: never leave empty when we have a title.
    title = (data.get("title") or "").strip()
    raw_summary = data.get("summary")
    if raw_summary is None or not str(raw_summary).strip():
        data["summary"] = title
    else:
        data["summary"] = str(raw_summary).strip()
    scene = Scene(story_id=story_id, org_id=org_id, n=next_n, **data)
    db.add(scene)
    await db.flush()  # assign scene.id

    for p in participants_data:
        db.add(
            SceneParticipant(
                scene_id=scene.id,
                character_id=p["character_id"],
                role=p.get("role", "supporting"),
                interaction_weight=p.get("interaction_weight"),
                org_id=org_id,
            )
        )

    # Mirror pov string into a role='pov' participant, if a character matches
    await _sync_pov_participant(db, scene, org_id)

    await db.commit()
    return await get_scene(db, story_id, scene.id) or scene


async def update_scene(
    db: AsyncSession,
    scene: Scene,
    patch: dict,
) -> Scene:
    """Update scalar fields and (optionally) replace the participants set.

    If `participants` is present in the patch, the existing rows for this
    scene are deleted and replaced. If absent, participants are left alone.
    Changing `pov` best-effort upserts a role='pov' participant row matched
    by character name within the same story.
    """
    participants_data = patch.pop("participants", None)
    for key, value in patch.items():
        if value is not None:
            setattr(scene, key, value)

    if participants_data is not None:
        # Delete-and-replace semantics.
        existing = await db.execute(
            select(SceneParticipant).where(SceneParticipant.scene_id == scene.id)
        )
        for row in existing.scalars().all():
            await db.delete(row)
        for p in participants_data:
            db.add(
                SceneParticipant(
                    scene_id=scene.id,
                    character_id=p["character_id"],
                    role=p.get("role", "supporting"),
                    interaction_weight=p.get("interaction_weight"),
                    org_id=scene.org_id,
                )
            )

    # Keep the role='pov' participant aligned with the current pov string.
    if "pov" in patch and patch["pov"] is not None:
        await _sync_pov_participant(db, scene, scene.org_id)

    if not (str(scene.summary or "")).strip():
        scene.summary = (scene.title or "").strip()

    await db.commit()
    refreshed = await get_scene(db, scene.story_id, scene.id)
    return refreshed or scene


async def delete_scene(db: AsyncSession, scene: Scene) -> None:
    await db.delete(scene)
    await db.commit()


async def delete_all_scenes_for_story(db: AsyncSession, story_id: uuid.UUID) -> int:
    """Remove every scene in a story (cascades draft contents and participants)."""
    result = await db.execute(select(Scene).where(Scene.story_id == story_id))
    scenes = list(result.scalars().all())
    for s in scenes:
        await db.delete(s)
    await db.commit()
    return len(scenes)


async def reorder_scenes(
    db: AsyncSession,
    story_id: uuid.UUID,
    items: list[tuple[uuid.UUID, int | None]],
) -> list[Scene]:
    """Rewrite scene.n to match the given order, optionally re-homing
    scenes into a different act.

    Two-phase write to sidestep UniqueConstraint(story_id, n): first
    shift affected scenes into a high staging range (1_000_000 + i),
    then assign final positions 1..N. When an item's `act` is provided,
    it's applied during phase 1 so the scene lands in its new column
    atomically with the reorder. Scenes not in `items` keep their
    current n and act.
    """
    ordered_ids = [sid for sid, _ in items]
    result = await db.execute(
        select(Scene).where(
            Scene.story_id == story_id,
            Scene.id.in_(ordered_ids),
        )
    )
    scenes_by_id = {s.id: s for s in result.scalars().all()}

    missing = [i for i in ordered_ids if i not in scenes_by_id]
    if missing:
        raise ValueError(f"Scene ids not in story: {missing}")

    # Phase 1: move out of the way + apply any act changes.
    staging_base = 1_000_000
    for i, (sid, new_act) in enumerate(items):
        scene = scenes_by_id[sid]
        scene.n = staging_base + i
        if new_act is not None:
            scene.act = new_act
    await db.flush()

    # Phase 2: assign final positions.
    for i, (sid, _) in enumerate(items):
        scenes_by_id[sid].n = i + 1

    await db.commit()

    # Return fresh list in new order.
    refreshed = await db.execute(
        select(Scene)
        .where(Scene.story_id == story_id)
        .options(selectinload(Scene.participants))
        .order_by(Scene.n)
    )
    return list(refreshed.scalars().all())


async def _sync_pov_participant(
    db: AsyncSession,
    scene: Scene,
    org_id: uuid.UUID,
) -> None:
    """Best-effort: if scene.pov matches a character name in this story,
    ensure a role='pov' participant row exists. Any existing row for that
    character is promoted to role='pov' (so an author switching POV to
    someone already listed as supporting just works)."""
    if not scene.pov or not scene.pov.strip():
        return
    name = scene.pov.strip()
    char_q = await db.execute(
        select(Character).where(
            Character.story_id == scene.story_id,
            func.lower(func.trim(Character.name)) == name.lower(),
        )
    )
    character = char_q.scalar_one_or_none()
    if not character:
        return
    existing_q = await db.execute(
        select(SceneParticipant).where(
            SceneParticipant.scene_id == scene.id,
            SceneParticipant.character_id == character.id,
        )
    )
    existing = existing_q.scalar_one_or_none()
    if existing:
        existing.role = "pov"
    else:
        db.add(
            SceneParticipant(
                scene_id=scene.id,
                character_id=character.id,
                role="pov",
                org_id=org_id,
            )
        )
