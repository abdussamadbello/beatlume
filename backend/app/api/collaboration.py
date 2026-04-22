import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
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

router = APIRouter(prefix="/api/stories/{story_id}", tags=["collaboration"])


@router.get("/collaborators", response_model=list[CollaboratorRead])
async def list_collaborators(story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    return await collab_service.list_collaborators(db, story.id)


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
    return collaborator


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
    return await collab_service.list_comments(db, story.id, scene_id)


@router.post("/comments", response_model=CommentRead, status_code=201)
async def create_comment(
    body: CommentCreate,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await collab_service.create_comment(db, story.id, org.id, user.id, body.body, body.scene_id)


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
    return await collab_service.update_comment(db, comment, body.body)


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
    return await collab_service.list_activity(db, story.id)
