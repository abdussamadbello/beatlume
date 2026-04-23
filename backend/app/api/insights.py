import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_org, get_db, get_story
from app.models.story import Story
from app.models.user import Organization
from app.schemas.insight import InsightRead
from app.schemas.common import PaginatedResponse
from app.services import insight as insight_service
from app.tasks.ai_tasks import apply_insight as apply_insight_task

router = APIRouter(prefix="/api/stories/{story_id}/insights", tags=["insights"])


class TaskResponse(BaseModel):
    task_id: str


@router.post(
    "/{insight_id}/apply",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def apply_insight(
    insight_id: uuid.UUID,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    ins = await insight_service.get_insight(db, story.id, insight_id)
    if ins is None:
        raise HTTPException(status_code=404, detail="Insight not found")
    task = apply_insight_task.delay(str(story.id), str(org.id), str(insight_id))
    return TaskResponse(task_id=task.id)


@router.get("", response_model=PaginatedResponse[InsightRead])
async def list_insights(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
    category: str | None = Query(None),
    severity: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    include_dismissed: bool = Query(False),
    only_dismissed: bool = Query(False),
):
    insights, total = await insight_service.list_insights(
        db,
        story.id,
        category,
        severity,
        offset=offset,
        limit=limit,
        include_dismissed=include_dismissed,
        only_dismissed=only_dismissed,
    )
    return PaginatedResponse(items=insights, total=total)


@router.put("/{insight_id}/dismiss")
async def dismiss_insight(insight_id: uuid.UUID, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    dismissed = await insight_service.dismiss_insight(db, story.id, insight_id)
    if not dismissed:
        raise HTTPException(status_code=404, detail="Insight not found")
    return {"status": "dismissed"}


@router.put("/{insight_id}/restore")
async def restore_insight(insight_id: uuid.UUID, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    restored = await insight_service.restore_insight(db, story.id, insight_id)
    if not restored:
        raise HTTPException(status_code=404, detail="Insight not found")
    return {"status": "restored"}
