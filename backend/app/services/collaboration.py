import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collaboration import ActivityEvent, Collaborator, CollaboratorRole, Comment
from app.models.user import User


async def list_collaborators(db: AsyncSession, story_id: uuid.UUID) -> list[Collaborator]:
    result = await db.execute(select(Collaborator).where(Collaborator.story_id == story_id))
    return list(result.scalars().all())


async def invite_collaborator(
    db: AsyncSession,
    story_id: uuid.UUID,
    org_id: uuid.UUID,
    email: str,
    role: str,
) -> Collaborator | None:
    """Invite a user by email. Returns None if no user exists with that email
    or if they're already a collaborator on this story.

    A real product would send an email with a signup-and-accept link. For
    now, we require the invitee to have an account — the Collaborator row
    is created with accepted_at=NULL so the UI can distinguish pending from
    accepted (which is expected to flip once an /accept endpoint lands).
    """
    try:
        role_enum = CollaboratorRole(role)
    except ValueError:
        role_enum = CollaboratorRole.reader

    user_row = await db.execute(
        select(User).where(User.email == email.strip().lower())
    )
    user = user_row.scalar_one_or_none()
    if user is None:
        return None

    existing = await db.execute(
        select(Collaborator).where(
            Collaborator.story_id == story_id,
            Collaborator.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return None

    collaborator = Collaborator(
        story_id=story_id,
        org_id=org_id,
        user_id=user.id,
        role=role_enum,
    )
    db.add(collaborator)
    await db.commit()
    await db.refresh(collaborator)
    return collaborator


async def delete_collaborator(
    db: AsyncSession, story_id: uuid.UUID, collaborator_id: uuid.UUID
) -> bool:
    result = await db.execute(
        select(Collaborator).where(
            Collaborator.id == collaborator_id,
            Collaborator.story_id == story_id,
        )
    )
    collaborator = result.scalar_one_or_none()
    if collaborator is None:
        return False
    await db.delete(collaborator)
    await db.commit()
    return True


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


async def get_comment(
    db: AsyncSession, story_id: uuid.UUID, comment_id: uuid.UUID
) -> Comment | None:
    result = await db.execute(
        select(Comment).where(
            Comment.id == comment_id,
            Comment.story_id == story_id,
        )
    )
    return result.scalar_one_or_none()


async def update_comment(db: AsyncSession, comment: Comment, body: str) -> Comment:
    comment.body = body
    await db.commit()
    await db.refresh(comment)
    return comment


async def delete_comment(db: AsyncSession, comment: Comment) -> None:
    await db.delete(comment)
    await db.commit()


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


async def safe_log_activity(
    db: AsyncSession,
    story_id: uuid.UUID,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    action: str,
    detail: dict,
) -> None:
    """Write an ActivityEvent, swallowing failures.

    Activity log writes are informational. A DB hiccup here must not
    roll back the caller's successful mutation. Log and continue.
    """
    try:
        await log_activity(db, story_id, org_id, user_id, action, detail)
    except Exception:
        # Deliberately suppressed — activity log is best-effort.
        pass
