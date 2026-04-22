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
    InviteRequest,
)
from app.services import collaboration as collab_service

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
    return collaborator


@router.delete(
    "/collaborators/{collaborator_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_collaborator(
    collaborator_id: uuid.UUID,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    ok = await collab_service.delete_collaborator(db, story.id, collaborator_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Collaborator not found")
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


@router.get("/activity", response_model=list[ActivityRead])
async def list_activity(story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    return await collab_service.list_activity(db, story.id)
