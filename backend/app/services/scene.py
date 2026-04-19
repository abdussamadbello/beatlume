import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scene import Scene


async def list_scenes(
    db: AsyncSession,
    story_id: uuid.UUID,
    act: int | None = None,
    pov: str | None = None,
    sort: str | None = None,
) -> tuple[list[Scene], int]:
    query = select(Scene).where(Scene.story_id == story_id)
    count_query = select(func.count()).select_from(Scene).where(Scene.story_id == story_id)

    if act is not None:
        query = query.where(Scene.act == act)
        count_query = count_query.where(Scene.act == act)
    if pov:
        query = query.where(Scene.pov == pov)
        count_query = count_query.where(Scene.pov == pov)

    if sort == "tension":
        query = query.order_by(Scene.tension.desc())
    elif sort == "pov":
        query = query.order_by(Scene.pov, Scene.n)
    else:
        query = query.order_by(Scene.n)

    result = await db.execute(query)
    scenes = list(result.scalars().all())
    total = (await db.execute(count_query)).scalar()
    return scenes, total


async def get_scene(db: AsyncSession, story_id: uuid.UUID, scene_id: uuid.UUID) -> Scene | None:
    result = await db.execute(
        select(Scene).where(Scene.id == scene_id, Scene.story_id == story_id)
    )
    return result.scalar_one_or_none()


async def create_scene(db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, data: dict) -> Scene:
    # Auto-assign next scene number
    max_n = await db.execute(
        select(func.max(Scene.n)).where(Scene.story_id == story_id)
    )
    next_n = (max_n.scalar() or 0) + 1

    scene = Scene(story_id=story_id, org_id=org_id, n=next_n, **data)
    db.add(scene)
    await db.commit()
    await db.refresh(scene)
    return scene


async def update_scene(db: AsyncSession, scene: Scene, patch: dict) -> Scene:
    for key, value in patch.items():
        if value is not None:
            setattr(scene, key, value)
    await db.commit()
    await db.refresh(scene)
    return scene


async def delete_scene(db: AsyncSession, scene: Scene) -> None:
    await db.delete(scene)
    await db.commit()
