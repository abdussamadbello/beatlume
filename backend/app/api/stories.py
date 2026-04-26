import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_org, get_current_user, get_db, get_story
from app.models.user import Organization, User
from app.models.story import Story
from app.schemas.story import StoryCreate, StoryRead, StoryUpdate
from app.schemas.common import PaginatedResponse
from app.services import story as story_service
from app.services.collaboration import safe_log_activity

router = APIRouter(prefix="/api/stories", tags=["stories"])


@router.get("", response_model=PaginatedResponse[StoryRead])
async def list_stories(
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    include_archived: bool = Query(False),
    only_archived: bool = Query(False),
):
    stories, total = await story_service.list_stories(
        db,
        org.id,
        offset=offset,
        limit=limit,
        include_archived=include_archived,
        only_archived=only_archived,
    )
    return PaginatedResponse(items=stories, total=total)


@router.post("", response_model=StoryRead, status_code=status.HTTP_201_CREATED)
async def create_story(
    body: StoryCreate,
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    story = await story_service.create_story(db, org.id, body.model_dump())
    return await story_service.attach_story_stat(db, story)


@router.post(
    "/{story_id}/duplicate",
    response_model=StoryRead,
    status_code=status.HTTP_201_CREATED,
)
async def duplicate_story(
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    new_story = await story_service.duplicate_story(db, story)
    await safe_log_activity(
        db, story.id, org.id, user.id, "story.duplicate",
        {"new_story_id": str(new_story.id), "new_title": new_story.title},
    )
    return await story_service.attach_story_stat(db, new_story)


@router.get("/{story_id}", response_model=StoryRead)
async def get_story_detail(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    return await story_service.attach_story_stat(db, story)


@router.put("/{story_id}", response_model=StoryRead)
async def update_story(
    body: StoryUpdate,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    patch = body.model_dump(exclude_unset=True)
    updated = await story_service.update_story(db, story, patch)
    # Archive/unarchive is the most common and most interesting update,
    # so give it its own action name. Other updates share a generic one.
    if "archived" in patch:
        action = "story.archive" if patch["archived"] else "story.unarchive"
    else:
        action = "story.update"
    await safe_log_activity(
        db, story.id, org.id, user.id, action,
        {"fields": sorted(patch.keys())},
    )
    return await story_service.attach_story_stat(db, updated)


@router.delete("/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_story(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    await story_service.delete_story(db, story)
    return None
