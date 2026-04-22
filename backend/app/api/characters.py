import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_org, get_current_user, get_db, get_story
from app.models.story import Story
from app.models.user import Organization, User
from app.schemas.character import CharacterCreate, CharacterRead, CharacterUpdate
from app.schemas.common import PaginatedResponse
from app.services import character as character_service
from app.services.collaboration import safe_log_activity

router = APIRouter(prefix="/api/stories/{story_id}/characters", tags=["characters"])


@router.get("", response_model=PaginatedResponse[CharacterRead])
async def list_characters(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    chars, total = await character_service.list_characters(db, story.id, offset=offset, limit=limit)
    return PaginatedResponse(items=chars, total=total)


@router.post("", response_model=CharacterRead, status_code=status.HTTP_201_CREATED)
async def create_character(
    body: CharacterCreate,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    char = await character_service.create_character(db, story.id, org.id, body.model_dump())
    await safe_log_activity(
        db, story.id, org.id, user.id, "character.create",
        {"character_id": str(char.id), "name": char.name, "role": char.role},
    )
    return char


@router.get("/{character_id}", response_model=CharacterRead)
async def get_character(character_id: uuid.UUID, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    char = await character_service.get_character(db, story.id, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    return char


@router.put("/{character_id}", response_model=CharacterRead)
async def update_character(character_id: uuid.UUID, body: CharacterUpdate, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    char = await character_service.get_character(db, story.id, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    return await character_service.update_character(db, char, body.model_dump(exclude_unset=True))


@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_character(character_id: uuid.UUID, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    char = await character_service.get_character(db, story.id, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    await character_service.delete_character(db, char)
    return None
