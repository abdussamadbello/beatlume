import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_story
from app.models.core import CoreConfigNode, CoreSetting
from app.models.story import Story
from app.schemas.core import CoreNodeRead, CoreNodeUpdate, CoreSettingRead, CoreSettingUpdate

router = APIRouter(prefix="/api/stories/{story_id}/core", tags=["core"])


@router.get("/tree", response_model=list[CoreNodeRead])
async def get_tree(story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CoreConfigNode).where(CoreConfigNode.story_id == story.id).order_by(CoreConfigNode.sort_order)
    )
    return result.scalars().all()


@router.put("/tree/{node_id}", response_model=CoreNodeRead)
async def update_tree_node(node_id: uuid.UUID, body: CoreNodeUpdate, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CoreConfigNode).where(CoreConfigNode.id == node_id, CoreConfigNode.story_id == story.id))
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Config node not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(node, k, v)
    await db.commit()
    await db.refresh(node)
    return node


@router.get("/settings", response_model=list[CoreSettingRead])
async def get_settings(story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CoreSetting).where(CoreSetting.story_id == story.id))
    return result.scalars().all()


@router.put("/settings/{key}", response_model=CoreSettingRead)
async def update_setting(key: str, body: CoreSettingUpdate, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CoreSetting).where(CoreSetting.story_id == story.id, CoreSetting.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    setting.value = body.value
    await db.commit()
    await db.refresh(setting)
    return setting
