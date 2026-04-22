import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_org, get_current_user, get_db, get_story
from app.models.story import Story
from app.models.user import Organization, User
from app.schemas.collaboration import (
    ActivityRead,
    CollaboratorRead,
    CommentCreate,
    CommentRead,
    CommentUpdate,
    InviteRequest,
)
from app.services import collaboration as collab_service
from app.services.collaboration import safe_log_activity


async def _user_name_map(db: AsyncSession, user_ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    """One batch SELECT to resolve user names for a set of ids.

    Returns {} when given an empty set so callers don't have to guard.
    Missing users (edge case: a deleted account) simply won't appear in
    the map; the caller falls back to None.
    """
    if not user_ids:
        return {}
    rows = await db.execute(select(User.id, User.name).where(User.id.in_(user_ids)))
    return {row.id: row.name for row in rows}


async def _user_identity_map(
    db: AsyncSession, user_ids: set[uuid.UUID]
) -> dict[uuid.UUID, tuple[str, str]]:
    """Like _user_name_map but also returns email — used by the
    collaborator table which shows both name and email."""
    if not user_ids:
        return {}
    rows = await db.execute(
        select(User.id, User.name, User.email).where(User.id.in_(user_ids))
    )
    return {row.id: (row.name, row.email) for row in rows}

router = APIRouter(prefix="/api/stories/{story_id}", tags=["collaboration"])


@router.get("/collaborators", response_model=list[CollaboratorRead])
async def list_collaborators(story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    collaborators = await collab_service.list_collaborators(db, story.id)
    identities = await _user_identity_map(db, {c.user_id for c in collaborators})
    return [
        CollaboratorRead(
            id=c.id,
            user_id=c.user_id,
            user_name=identities.get(c.user_id, (None, None))[0] if c.user_id in identities else None,
            user_email=identities.get(c.user_id, (None, None))[1] if c.user_id in identities else None,
            role=c.role.value if hasattr(c.role, "value") else str(c.role),
            invited_at=c.invited_at,
            accepted_at=c.accepted_at,
        )
        for c in collaborators
    ]


@router.post(
    "/collaborators",
    response_model=CollaboratorRead,
    status_code=status.HTTP_201_CREATED,
)
async def invite_collaborator(
    body: InviteRequest,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    collaborator = await collab_service.invite_collaborator(
        db, story.id, org.id, body.email, body.role
    )
    if collaborator is None:
        raise HTTPException(
            status_code=400,
            detail="No user with that email, or already a collaborator.",
        )
    await safe_log_activity(
        db, story.id, org.id, user.id, "collaborator.invite",
        {
            "collaborator_id": str(collaborator.id),
            "email": body.email,
            "role": body.role,
        },
    )
    # Look up the invitee's name so the UI row can render without a
    # second request. collaborator.user_id is the invitee, not the inviter.
    identities = await _user_identity_map(db, {collaborator.user_id})
    name, email = identities.get(collaborator.user_id, (None, None))
    return CollaboratorRead(
        id=collaborator.id,
        user_id=collaborator.user_id,
        user_name=name,
        user_email=email,
        role=collaborator.role.value if hasattr(collaborator.role, "value") else str(collaborator.role),
        invited_at=collaborator.invited_at,
        accepted_at=collaborator.accepted_at,
    )


@router.delete(
    "/collaborators/{collaborator_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_collaborator(
    collaborator_id: uuid.UUID,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await collab_service.delete_collaborator(db, story.id, collaborator_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Collaborator not found")
    await safe_log_activity(
        db, story.id, org.id, user.id, "collaborator.remove",
        {"collaborator_id": str(collaborator_id)},
    )
    return None


@router.get("/comments", response_model=list[CommentRead])
async def list_comments(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
    scene_id: uuid.UUID | None = Query(None),
):
    comments = await collab_service.list_comments(db, story.id, scene_id)
    names = await _user_name_map(db, {c.user_id for c in comments})
    return [
        CommentRead(
            id=c.id,
            user_id=c.user_id,
            user_name=names.get(c.user_id),
            scene_id=c.scene_id,
            body=c.body,
            created_at=c.created_at,
        )
        for c in comments
    ]


@router.post("/comments", response_model=CommentRead, status_code=201)
async def create_comment(
    body: CommentCreate,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comment = await collab_service.create_comment(
        db, story.id, org.id, user.id, body.body, body.scene_id,
    )
    return CommentRead(
        id=comment.id,
        user_id=comment.user_id,
        user_name=user.name,
        scene_id=comment.scene_id,
        body=comment.body,
        created_at=comment.created_at,
    )


@router.put("/comments/{comment_id}", response_model=CommentRead)
async def update_comment(
    comment_id: uuid.UUID,
    body: CommentUpdate,
    story: Story = Depends(get_story),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comment = await collab_service.get_comment(db, story.id, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != user.id:
        raise HTTPException(
            status_code=403, detail="Only the author can edit this comment"
        )
    updated = await collab_service.update_comment(db, comment, body.body)
    return CommentRead(
        id=updated.id,
        user_id=updated.user_id,
        user_name=user.name,
        scene_id=updated.scene_id,
        body=updated.body,
        created_at=updated.created_at,
    )


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: uuid.UUID,
    story: Story = Depends(get_story),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comment = await collab_service.get_comment(db, story.id, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != user.id:
        raise HTTPException(
            status_code=403, detail="Only the author can delete this comment"
        )
    await collab_service.delete_comment(db, comment)
    return None


@router.get("/activity", response_model=list[ActivityRead])
async def list_activity(story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    events = await collab_service.list_activity(db, story.id)
    names = await _user_name_map(db, {e.user_id for e in events})
    return [
        ActivityRead(
            id=e.id,
            user_id=e.user_id,
            user_name=names.get(e.user_id),
            action=e.action,
            detail=e.detail,
            created_at=e.created_at,
        )
        for e in events
    ]
