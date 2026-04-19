import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_org, get_db, get_story
from app.models.story import Story
from app.models.user import Organization
from app.schemas.draft import DraftRead, DraftUpdate
from app.services import draft as draft_service

router = APIRouter(prefix="/api/stories/{story_id}/draft", tags=["draft"])


@router.get("/{scene_id}", response_model=DraftRead)
async def get_draft(scene_id: uuid.UUID, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    draft = await draft_service.get_draft(db, story.id, scene_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return draft


@router.put("/{scene_id}", response_model=DraftRead)
async def update_draft(
    scene_id: uuid.UUID,
    body: DraftUpdate,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    draft = await draft_service.upsert_draft(db, story.id, scene_id, org.id, body.content)
    return draft
