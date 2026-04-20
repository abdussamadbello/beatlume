import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.character import Character


async def list_characters(db: AsyncSession, story_id: uuid.UUID, offset: int = 0, limit: int = 50) -> tuple[list[Character], int]:
    result = await db.execute(
        select(Character).where(Character.story_id == story_id).offset(offset).limit(limit)
    )
    chars = list(result.scalars().all())
    count = (await db.execute(
        select(func.count()).select_from(Character).where(Character.story_id == story_id)
    )).scalar()
    return chars, count


async def get_character(db: AsyncSession, story_id: uuid.UUID, char_id: uuid.UUID) -> Character | None:
    result = await db.execute(select(Character).where(Character.id == char_id, Character.story_id == story_id))
    return result.scalar_one_or_none()


async def create_character(db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, data: dict) -> Character:
    char = Character(story_id=story_id, org_id=org_id, **data)
    db.add(char)
    await db.commit()
    await db.refresh(char)
    return char


async def update_character(db: AsyncSession, char: Character, patch: dict) -> Character:
    for key, value in patch.items():
        if value is not None:
            setattr(char, key, value)
    await db.commit()
    await db.refresh(char)
    return char


async def delete_character(db: AsyncSession, char: Character) -> None:
    await db.delete(char)
    await db.commit()
