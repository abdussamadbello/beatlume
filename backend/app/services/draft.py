import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.draft import DraftContent


async def get_draft(db: AsyncSession, story_id: uuid.UUID, scene_id: uuid.UUID) -> DraftContent | None:
    result = await db.execute(
        select(DraftContent).where(DraftContent.story_id == story_id, DraftContent.scene_id == scene_id)
    )
    return result.scalar_one_or_none()


async def upsert_draft(db: AsyncSession, story_id: uuid.UUID, scene_id: uuid.UUID, org_id: uuid.UUID, content: str) -> DraftContent:
    result = await db.execute(
        select(DraftContent).where(DraftContent.story_id == story_id, DraftContent.scene_id == scene_id)
    )
    draft = result.scalar_one_or_none()
    if draft:
        draft.content = content
        draft.word_count = len(content.split())
    else:
        draft = DraftContent(
            story_id=story_id,
            scene_id=scene_id,
            org_id=org_id,
            content=content,
            word_count=len(content.split()),
        )
        db.add(draft)
    await db.commit()
    await db.refresh(draft)
    return draft
