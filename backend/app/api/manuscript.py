import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_story
from app.models.manuscript import ManuscriptChapter
from app.models.story import Story
from app.schemas.manuscript import ChapterRead, ChapterUpdate

router = APIRouter(prefix="/api/stories/{story_id}/manuscript", tags=["manuscript"])


@router.get("", response_model=list[ChapterRead])
async def list_chapters(story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ManuscriptChapter).where(ManuscriptChapter.story_id == story.id).order_by(ManuscriptChapter.sort_order)
    )
    return result.scalars().all()


@router.get("/{num}", response_model=ChapterRead)
async def get_chapter(num: int, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ManuscriptChapter).where(ManuscriptChapter.story_id == story.id, ManuscriptChapter.num == num)
    )
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return chapter


@router.put("/{num}", response_model=ChapterRead)
async def update_chapter(num: int, body: ChapterUpdate, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ManuscriptChapter).where(ManuscriptChapter.story_id == story.id, ManuscriptChapter.num == num)
    )
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(chapter, k, v)
    await db.commit()
    await db.refresh(chapter)
    return chapter
