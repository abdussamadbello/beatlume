import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.insight import Insight


async def list_insights(
    db: AsyncSession,
    story_id: uuid.UUID,
    category: str | None = None,
    severity: str | None = None,
    offset: int = 0,
    limit: int = 50,
    include_dismissed: bool = False,
    only_dismissed: bool = False,
) -> tuple[list[Insight], int]:
    query = select(Insight).where(Insight.story_id == story_id)
    count_q = select(func.count()).select_from(Insight).where(Insight.story_id == story_id)

    if only_dismissed:
        query = query.where(Insight.dismissed.is_(True))
        count_q = count_q.where(Insight.dismissed.is_(True))
    elif not include_dismissed:
        query = query.where(Insight.dismissed.is_(False))
        count_q = count_q.where(Insight.dismissed.is_(False))

    if category:
        query = query.where(Insight.category == category)
        count_q = count_q.where(Insight.category == category)
    if severity:
        query = query.where(Insight.severity == severity)
        count_q = count_q.where(Insight.severity == severity)
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    total = (await db.execute(count_q)).scalar()
    return list(result.scalars().all()), total


async def dismiss_insight(db: AsyncSession, story_id: uuid.UUID, insight_id: uuid.UUID) -> bool:
    return await _set_dismissed(db, story_id, insight_id, True)


async def restore_insight(db: AsyncSession, story_id: uuid.UUID, insight_id: uuid.UUID) -> bool:
    return await _set_dismissed(db, story_id, insight_id, False)


async def _set_dismissed(
    db: AsyncSession, story_id: uuid.UUID, insight_id: uuid.UUID, value: bool
) -> bool:
    result = await db.execute(
        select(Insight).where(Insight.id == insight_id, Insight.story_id == story_id)
    )
    insight = result.scalar_one_or_none()
    if not insight:
        return False
    insight.dismissed = value
    await db.commit()
    return True
