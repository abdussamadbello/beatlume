import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_org, get_db, get_story
from app.models.story import Story
from app.models.user import Organization
from app.schemas.scene import SceneCreate, SceneRead, SceneUpdate
from app.schemas.common import PaginatedResponse
from app.services import scene as scene_service

router = APIRouter(prefix="/api/stories/{story_id}/scenes", tags=["scenes"])


class ReorderRequest(BaseModel):
    ordered_ids: list[uuid.UUID]


@router.patch("/reorder", response_model=list[SceneRead])
async def reorder_scenes(
    body: ReorderRequest,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    try:
        scenes = await scene_service.reorder_scenes(db, story.id, body.ordered_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return scenes


@router.get("", response_model=PaginatedResponse[SceneRead])
async def list_scenes(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
    act: int | None = Query(None),
    pov: str | None = Query(None),
    sort: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    scenes, total = await scene_service.list_scenes(
        db, story.id, act=act, pov=pov, sort=sort, offset=offset, limit=limit,
    )
    return PaginatedResponse(items=scenes, total=total)


@router.post("", response_model=SceneRead, status_code=status.HTTP_201_CREATED)
async def create_scene(
    body: SceneCreate,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    scene = await scene_service.create_scene(db, story.id, org.id, body.model_dump())
    return scene


@router.get("/{scene_id}", response_model=SceneRead)
async def get_scene(
    scene_id: uuid.UUID,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    scene = await scene_service.get_scene(db, story.id, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene


@router.put("/{scene_id}", response_model=SceneRead)
async def update_scene(
    scene_id: uuid.UUID,
    body: SceneUpdate,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    scene = await scene_service.get_scene(db, story.id, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    updated = await scene_service.update_scene(db, scene, body.model_dump(exclude_unset=True))
    return updated


@router.delete("/{scene_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scene(
    scene_id: uuid.UUID,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    scene = await scene_service.get_scene(db, story.id, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    await scene_service.delete_scene(db, scene)
    return None
