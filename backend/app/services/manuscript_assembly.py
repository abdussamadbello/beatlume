"""Build manuscript chapter data from scenes + drafts; keep export in sync with AI drafts."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.manuscript import ManuscriptChapter
from app.models.scene import Scene
from app.services import draft as draft_service


async def sync_manuscript_chapters_from_drafts(
    db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID
) -> int:
    """Upsert one `ManuscriptChapter` per scene (`num` = `scene.n`, content from draft).

    Used after full-manuscript generation so PDF/DOCX export (which reads `manuscript_chapters`)
    matches scene-level drafts. Idempotent: re-run overwrites title/content from current scenes/drafts.
    """
    scene_result = await db.execute(
        select(Scene).where(Scene.story_id == story_id).order_by(Scene.n)
    )
    scenes = list(scene_result.scalars().all())
    n = 0
    for scene in scenes:
        draft = await draft_service.get_draft(db, story_id, scene.id)
        content = (draft.content if draft else "") or ""

        existing = await db.execute(
            select(ManuscriptChapter).where(
                ManuscriptChapter.story_id == story_id,
                ManuscriptChapter.num == scene.n,
            )
        )
        row = existing.scalar_one_or_none()
        if row:
            row.title = scene.title
            row.content = content
            row.sort_order = scene.n
        else:
            db.add(
                ManuscriptChapter(
                    story_id=story_id,
                    org_id=org_id,
                    num=scene.n,
                    title=scene.title,
                    content=content,
                    sort_order=scene.n,
                )
            )
        n += 1
    await db.commit()
    return n


async def chapter_dicts_for_export(db: AsyncSession, story_id: uuid.UUID) -> list[dict]:
    """Rows for the export task: prefer saved manuscript chapters; else assemble from scenes + drafts."""
    ch_result = await db.execute(
        select(ManuscriptChapter)
        .where(ManuscriptChapter.story_id == story_id)
        .order_by(ManuscriptChapter.sort_order)
    )
    chapters = list(ch_result.scalars().all())
    if chapters:
        return [{"num": ch.num, "title": ch.title, "content": ch.content} for ch in chapters]

    scene_result = await db.execute(
        select(Scene).where(Scene.story_id == story_id).order_by(Scene.n)
    )
    scenes = list(scene_result.scalars().all())
    out: list[dict] = []
    for scene in scenes:
        draft = await draft_service.get_draft(db, story_id, scene.id)
        content = (draft.content if draft else "") or ""
        out.append({"num": scene.n, "title": scene.title, "content": content})
    return out
