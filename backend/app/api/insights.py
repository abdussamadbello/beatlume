import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_story
from app.models.story import Story
from app.schemas.insight import InsightRead
from app.schemas.common import PaginatedResponse
from app.services import insight as insight_service

router = APIRouter(prefix="/api/stories/{story_id}/insights", tags=["insights"])


@router.get("", response_model=PaginatedResponse[InsightRead])
async def list_insights(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
    category: str | None = Query(None),
    severity: str | None = Query(None),
):
    insights, total = await insight_service.list_insights(db, story.id, category, severity)
    return PaginatedResponse(items=insights, total=total)


@router.put("/{insight_id}/dismiss")
async def dismiss_insight(insight_id: uuid.UUID, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    dismissed = await insight_service.dismiss_insight(db, story.id, insight_id)
    if not dismissed:
        raise HTTPException(status_code=404, detail="Insight not found")
    return {"status": "dismissed"}
