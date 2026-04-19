import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collaboration import ActivityEvent, Collaborator, Comment


async def list_collaborators(db: AsyncSession, story_id: uuid.UUID) -> list[Collaborator]:
    result = await db.execute(select(Collaborator).where(Collaborator.story_id == story_id))
    return list(result.scalars().all())


async def list_comments(db: AsyncSession, story_id: uuid.UUID, scene_id: uuid.UUID | None = None) -> list[Comment]:
    query = select(Comment).where(Comment.story_id == story_id).order_by(Comment.created_at.desc())
    if scene_id:
        query = query.where(Comment.scene_id == scene_id)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_comment(
    db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, user_id: uuid.UUID, body: str, scene_id: uuid.UUID | None = None
) -> Comment:
    comment = Comment(story_id=story_id, org_id=org_id, user_id=user_id, body=body, scene_id=scene_id)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


async def list_activity(db: AsyncSession, story_id: uuid.UUID) -> list[ActivityEvent]:
    result = await db.execute(
        select(ActivityEvent).where(ActivityEvent.story_id == story_id).order_by(ActivityEvent.created_at.desc()).limit(50)
    )
    return list(result.scalars().all())


async def log_activity(
    db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, user_id: uuid.UUID, action: str, detail: dict
) -> ActivityEvent:
    event = ActivityEvent(story_id=story_id, org_id=org_id, user_id=user_id, action=action, detail=detail)
    db.add(event)
    await db.commit()
    return event
