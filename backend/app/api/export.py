"""Export API endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_story
from app.models.manuscript import ManuscriptChapter
from app.models.core import CoreSetting
from app.models.story import Story

router = APIRouter(
    prefix="/api/stories/{story_id}/export",
    tags=["export"],
)


class ExportRequest(BaseModel):
    format: str = "pdf"
    options: dict | None = None


class ExportResponse(BaseModel):
    job_id: str
    status: str = "queued"


class ExportJobStatus(BaseModel):
    job_id: str
    status: str
    progress: float = 0.0
    download_url: str | None = None
    filename: str | None = None
    error: str | None = None


@router.post("", status_code=202, response_model=ExportResponse)
async def trigger_export(
    body: ExportRequest,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    """Trigger an asynchronous export job."""
    valid_formats = {"pdf", "docx", "epub", "plaintext"}
    if body.format not in valid_formats:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid format. Must be one of: {', '.join(sorted(valid_formats))}",
        )

    # Load chapters
    result = await db.execute(
        select(ManuscriptChapter)
        .where(ManuscriptChapter.story_id == story.id)
        .order_by(ManuscriptChapter.sort_order)
    )
    chapters = result.scalars().all()

    # Load settings
    settings_result = await db.execute(
        select(CoreSetting).where(CoreSetting.story_id == story.id)
    )
    story_settings = settings_result.scalars().all()

    # Prepare data for Celery task
    story_data = {"id": str(story.id), "title": story.title}
    chapter_data = [
        {"num": ch.num, "title": ch.title, "content": ch.content}
        for ch in chapters
    ]
    settings_data = [
        {"key": s.key, "value": s.value}
        for s in story_settings
    ]

    job_id = str(uuid.uuid4())

    # Import and dispatch Celery task
    from app.tasks.export_tasks import run_export

    run_export.delay(
        job_id=job_id,
        story=story_data,
        chapters=chapter_data,
        story_settings=settings_data,
        fmt=body.format,
        options=body.options,
    )

    return ExportResponse(job_id=job_id)


@router.get("/{job_id}", response_model=ExportJobStatus)
async def get_export_status(
    job_id: str,
    story: Story = Depends(get_story),
):
    """Check the status of an export job."""
    import redis as redis_lib
    from app.config import settings

    try:
        r = redis_lib.from_url(settings.redis_url)
        job_data = r.hgetall(f"export_job:{job_id}")
    except Exception:
        raise HTTPException(status_code=503, detail="Job status unavailable")

    if not job_data:
        raise HTTPException(status_code=404, detail="Export job not found")

    # Redis returns bytes — decode
    data = {k.decode(): v.decode() for k, v in job_data.items()}

    return ExportJobStatus(
        job_id=job_id,
        status=data.get("status", "unknown"),
        progress=float(data.get("progress", 0)),
        download_url=data.get("download_url"),
        filename=data.get("filename"),
        error=data.get("error"),
    )
