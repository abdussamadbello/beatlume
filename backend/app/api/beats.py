import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_org, get_current_user, get_db, get_story
from app.models.story import Story
from app.models.user import Organization, User
from app.schemas.beat import BeatCreate, BeatRead, BeatUpdate
from app.services import beat as beat_service
from app.services import scene as scene_service
from app.services.collaboration import safe_log_activity

router = APIRouter(
    prefix="/api/stories/{story_id}/scenes/{scene_id}/beats",
    tags=["beats"],
)


class BeatReorderRequest(BaseModel):
    ordered_ids: list[uuid.UUID]


async def _require_scene(
    story: Story, scene_id: uuid.UUID, db: AsyncSession
):
    """Resolve and guard that the scene belongs to the requested story.

    Raises 404 if missing. Keeps the beat endpoints from leaking
    cross-story data via a well-formed scene_id path param.
    """
    scene = await scene_service.get_scene(db, story.id, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene


@router.get("", response_model=list[BeatRead])
async def list_beats(
    scene_id: uuid.UUID,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    await _require_scene(story, scene_id, db)
    return await beat_service.list_beats(db, scene_id)


@router.patch("/reorder", response_model=list[BeatRead])
async def reorder_beats(
    scene_id: uuid.UUID,
    body: BeatReorderRequest,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    await _require_scene(story, scene_id, db)
    try:
        return await beat_service.reorder_beats(db, scene_id, body.ordered_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("", response_model=BeatRead, status_code=status.HTTP_201_CREATED)
async def create_beat(
    scene_id: uuid.UUID,
    body: BeatCreate,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_scene(story, scene_id, db)
    beat = await beat_service.create_beat(db, scene_id, org.id, body.model_dump())
    await safe_log_activity(
        db, story.id, org.id, user.id, "beat.create",
        {"beat_id": str(beat.id), "scene_id": str(scene_id), "kind": beat.kind},
    )
    return beat


@router.get("/{beat_id}", response_model=BeatRead)
async def get_beat(
    scene_id: uuid.UUID,
    beat_id: uuid.UUID,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    await _require_scene(story, scene_id, db)
    beat = await beat_service.get_beat(db, scene_id, beat_id)
    if not beat:
        raise HTTPException(status_code=404, detail="Beat not found")
    return beat


@router.put("/{beat_id}", response_model=BeatRead)
async def update_beat(
    scene_id: uuid.UUID,
    beat_id: uuid.UUID,
    body: BeatUpdate,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    await _require_scene(story, scene_id, db)
    beat = await beat_service.get_beat(db, scene_id, beat_id)
    if not beat:
        raise HTTPException(status_code=404, detail="Beat not found")
    return await beat_service.update_beat(
        db, beat, body.model_dump(exclude_unset=True)
    )


@router.delete("/{beat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_beat(
    scene_id: uuid.UUID,
    beat_id: uuid.UUID,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    await _require_scene(story, scene_id, db)
    beat = await beat_service.get_beat(db, scene_id, beat_id)
    if not beat:
        raise HTTPException(status_code=404, detail="Beat not found")
    await beat_service.delete_beat(db, beat)
    return None
