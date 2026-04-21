import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_story
from app.models.core import CoreConfigNode, CoreSetting
from app.models.story import Story
from app.schemas.core import (
    CoreNodeRead,
    CoreNodeUpdate,
    CoreSettingCreate,
    CoreSettingRead,
    CoreSettingUpdate,
    ResolvedSettingRead,
)
from app.services.core import resolve_settings_for_node

router = APIRouter(prefix="/api/stories/{story_id}/core", tags=["core"])


# ---------------------------------------------------------------------------
# Tree
# ---------------------------------------------------------------------------


@router.get("/tree", response_model=list[CoreNodeRead])
async def get_tree(story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CoreConfigNode)
        .where(CoreConfigNode.story_id == story.id)
        .order_by(CoreConfigNode.sort_order)
    )
    return result.scalars().all()


@router.put("/tree/{node_id}", response_model=CoreNodeRead)
async def update_tree_node(
    node_id: uuid.UUID,
    body: CoreNodeUpdate,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CoreConfigNode).where(
            CoreConfigNode.id == node_id, CoreConfigNode.story_id == story.id
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Config node not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(node, k, v)
    await db.commit()
    await db.refresh(node)
    return node


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


async def _validate_node(db: AsyncSession, story: Story, node_id: uuid.UUID | None):
    """Ensure node_id, if provided, belongs to this story."""
    if node_id is None:
        return
    result = await db.execute(
        select(CoreConfigNode).where(
            CoreConfigNode.id == node_id, CoreConfigNode.story_id == story.id
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Config node not found for this story")


@router.get("/settings", response_model=list[ResolvedSettingRead])
async def get_settings(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
    node_id: uuid.UUID | None = Query(
        default=None,
        description="Resolve settings relative to this tree node. Omit for the story root.",
    ),
):
    await _validate_node(db, story, node_id)
    resolved = await resolve_settings_for_node(db, story.id, node_id)
    return [
        ResolvedSettingRead(
            key=r.key,
            value=r.value,
            source=r.source,
            tag=r.tag,
            defined_at_node_id=r.defined_at_node_id,
            defined_at_label=r.defined_at_label,
            is_override=r.is_override,
        )
        for r in resolved
    ]


@router.get("/settings/raw", response_model=list[CoreSettingRead])
async def get_raw_settings(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    """Return every raw `core_settings` row for this story without any
    resolution. Used by admin/debug views; most UI consumers should use
    `/settings?node_id=...`."""
    result = await db.execute(select(CoreSetting).where(CoreSetting.story_id == story.id))
    return result.scalars().all()


@router.post("/settings", response_model=CoreSettingRead, status_code=status.HTTP_201_CREATED)
async def create_setting(
    body: CoreSettingCreate,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    await _validate_node(db, story, body.config_node_id)

    existing_q = select(CoreSetting).where(
        CoreSetting.story_id == story.id, CoreSetting.key == body.key
    )
    if body.config_node_id is None:
        existing_q = existing_q.where(CoreSetting.config_node_id.is_(None))
    else:
        existing_q = existing_q.where(CoreSetting.config_node_id == body.config_node_id)

    existing = await db.execute(existing_q)
    if existing.scalar_one_or_none() is not None:
        scope = "this node" if body.config_node_id else "this story"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Setting '{body.key}' already exists for {scope}",
        )
    setting = CoreSetting(
        id=uuid.uuid4(),
        org_id=story.org_id,
        story_id=story.id,
        config_node_id=body.config_node_id,
        key=body.key,
        value=body.value,
        source=body.source,
        tag=body.tag,
    )
    db.add(setting)
    await db.commit()
    await db.refresh(setting)
    return setting


async def _find_setting(
    db: AsyncSession,
    story: Story,
    key: str,
    node_id: uuid.UUID | None,
) -> CoreSetting | None:
    q = select(CoreSetting).where(
        CoreSetting.story_id == story.id, CoreSetting.key == key
    )
    if node_id is None:
        q = q.where(CoreSetting.config_node_id.is_(None))
    else:
        q = q.where(CoreSetting.config_node_id == node_id)
    result = await db.execute(q)
    return result.scalar_one_or_none()


@router.put("/settings/{key}", response_model=CoreSettingRead)
async def update_setting(
    key: str,
    body: CoreSettingUpdate,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
    node_id: uuid.UUID | None = Query(
        default=None,
        description="Target a node-scoped override. Omit for the story-root row.",
    ),
):
    await _validate_node(db, story, node_id)
    setting = await _find_setting(db, story, key, node_id)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    patch = body.model_dump(exclude_unset=True)
    if "value" in patch and patch["value"] is not None:
        setting.value = patch["value"]
    if "source" in patch:
        setting.source = patch["source"] or ""
    if "tag" in patch:
        setting.tag = patch["tag"]
    await db.commit()
    await db.refresh(setting)
    return setting


@router.delete("/settings/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_setting(
    key: str,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
    node_id: uuid.UUID | None = Query(
        default=None,
        description="Target a node-scoped override. Omit for the story-root row.",
    ),
):
    await _validate_node(db, story, node_id)
    setting = await _find_setting(db, story, key, node_id)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    if setting.source == "system" and node_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="System-derived story-level settings cannot be deleted",
        )
    await db.delete(setting)
    await db.commit()
    return None
