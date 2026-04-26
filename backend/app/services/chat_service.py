import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_thread import ChatThread


async def create_thread(
    db: AsyncSession,
    org_id: uuid.UUID,
    story_id: uuid.UUID,
    title: str | None = None,
) -> ChatThread:
    thread = ChatThread(org_id=org_id, story_id=story_id, title=title)
    db.add(thread)
    await db.commit()
    await db.refresh(thread)
    return thread


async def list_threads(
    db: AsyncSession,
    story_id: uuid.UUID,
    include_archived: bool = False,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[ChatThread], int]:
    base = select(ChatThread).where(ChatThread.story_id == story_id)
    count_base = select(func.count()).select_from(ChatThread).where(ChatThread.story_id == story_id)
    if not include_archived:
        base = base.where(ChatThread.archived_at.is_(None))
        count_base = count_base.where(ChatThread.archived_at.is_(None))
    query = base.order_by(ChatThread.updated_at.desc()).offset(offset).limit(limit)
    rows = list((await db.execute(query)).scalars().all())
    total = (await db.execute(count_base)).scalar() or 0
    return rows, total


async def get_thread(db: AsyncSession, thread_id: uuid.UUID) -> ChatThread | None:
    return (await db.execute(select(ChatThread).where(ChatThread.id == thread_id))).scalar_one_or_none()


async def archive_thread(db: AsyncSession, thread_id: uuid.UUID) -> ChatThread | None:
    thread = await get_thread(db, thread_id)
    if thread is None:
        return None
    thread.archived_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(thread)
    return thread
