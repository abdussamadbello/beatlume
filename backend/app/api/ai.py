import uuid

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_org, get_db, get_story
from app.models.story import Story
from app.models.user import Organization
from app.tasks.ai_tasks import (
    continue_prose,
    generate_insights,
    infer_relationships,
    scaffold_story,
    summarize_scene,
)

router = APIRouter(tags=["ai"])


class TaskResponse(BaseModel):
    task_id: str


class ScaffoldRequest(BaseModel):
    premise: str
    structure_type: str = "3-act"
    target_words: int = 80000
    genres: list[str] = []
    characters: list[dict] = []


@router.post(
    "/api/stories/{story_id}/insights/generate",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_insights(
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
):
    task = generate_insights.delay(str(story.id), str(org.id))
    return TaskResponse(task_id=task.id)


@router.post(
    "/api/stories/{story_id}/draft/{scene_id}/ai-continue",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_prose_continuation(
    scene_id: uuid.UUID,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
):
    task = continue_prose.delay(str(story.id), str(scene_id), str(org.id))
    return TaskResponse(task_id=task.id)


@router.post(
    "/api/stories/{story_id}/ai/relationships",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_relationship_inference(
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
):
    task = infer_relationships.delay(str(story.id), str(org.id))
    return TaskResponse(task_id=task.id)


@router.post(
    "/api/stories/{story_id}/ai/summarize/{scene_id}",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_scene_summary(
    scene_id: uuid.UUID,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
):
    task = summarize_scene.delay(str(story.id), str(scene_id), str(org.id))
    return TaskResponse(task_id=task.id)


@router.post(
    "/api/stories/{story_id}/ai/scaffold",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_scaffold(
    body: ScaffoldRequest,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
):
    task = scaffold_story.delay(
        str(story.id), body.premise, body.structure_type,
        body.target_words, body.genres, body.characters, str(org.id),
    )
    return TaskResponse(task_id=task.id)
