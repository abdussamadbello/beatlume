import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.story import Story
from app.services.core import populate_default_core


async def list_stories(db: AsyncSession, org_id: uuid.UUID, offset: int = 0, limit: int = 50) -> tuple[list[Story], int]:
    result = await db.execute(
        select(Story).where(Story.org_id == org_id).offset(offset).limit(limit)
    )
    stories = result.scalars().all()
    count_result = await db.execute(
        select(func.count()).select_from(Story).where(Story.org_id == org_id)
    )
    total = count_result.scalar()
    return list(stories), total


async def get_story(db: AsyncSession, story_id: uuid.UUID) -> Story | None:
    result = await db.execute(select(Story).where(Story.id == story_id))
    return result.scalar_one_or_none()


async def create_story(db: AsyncSession, org_id: uuid.UUID, title: str, genres: list[str], target_words: int, structure_type: str) -> Story:
    story = Story(
        org_id=org_id,
        title=title,
        genres=genres,
        target_words=target_words,
        structure_type=structure_type,
    )
    db.add(story)
    await db.flush()
    await populate_default_core(db, story)
    await db.commit()
    await db.refresh(story)
    return story


async def update_story(db: AsyncSession, story: Story, patch: dict) -> Story:
    for key, value in patch.items():
        if value is not None:
            setattr(story, key, value)
    await db.commit()
    await db.refresh(story)
    return story


async def delete_story(db: AsyncSession, story: Story) -> None:
    await db.delete(story)
    await db.commit()
