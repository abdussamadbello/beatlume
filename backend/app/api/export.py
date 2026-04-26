"""Export API endpoints."""

from __future__ import annotations

import time
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings as app_settings
from app.deps import get_db, get_story
from app.models.core import CoreSetting
from app.models.story import Story
from app.services import manuscript_assembly

EXPORT_HISTORY_TTL_SECONDS = 86400  # match export_job hash TTL
EXPORT_HISTORY_LIMIT = 10

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
    format: str | None = None
    created_at: float | None = None


class ExportHistoryResponse(BaseModel):
    items: list[ExportJobStatus]
    total: int


def _decode_job_hash(job_id: str, raw: dict[bytes, bytes]) -> ExportJobStatus:
    data = {k.decode(): v.decode() for k, v in raw.items()}
    return ExportJobStatus(
        job_id=job_id,
        status=data.get("status", "unknown"),
        progress=float(data.get("progress", 0)),
        download_url=data.get("download_url"),
        filename=data.get("filename"),
        error=data.get("error"),
        format=data.get("format"),
        created_at=float(data["created_at"]) if data.get("created_at") else None,
    )


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

    # Chapters: prefer `manuscript_chapters`; if empty, assemble from scene drafts (AI draft-only path).
    chapter_data = await manuscript_assembly.chapter_dicts_for_export(db, story.id)

    # Load settings
    settings_result = await db.execute(
        select(CoreSetting).where(CoreSetting.story_id == story.id)
    )
    story_settings = settings_result.scalars().all()

    # Prepare data for Celery task
    story_data = {"id": str(story.id), "title": story.title}
    settings_data = [
        {"key": s.key, "value": s.value}
        for s in story_settings
    ]

    job_id = str(uuid.uuid4())
    now = time.time()

    # Index the job so the listing endpoint can find it before the worker writes status.
    import redis as redis_lib

    try:
        r = redis_lib.from_url(app_settings.redis_url)
        pipe = r.pipeline()
        pipe.hset(
            f"export_job:{job_id}",
            mapping={
                "status": "queued",
                "progress": "0",
                "format": body.format,
                "created_at": str(now),
            },
        )
        pipe.expire(f"export_job:{job_id}", EXPORT_HISTORY_TTL_SECONDS)
        history_key = f"story:{story.id}:exports"
        pipe.zadd(history_key, {job_id: now})
        pipe.zremrangebyrank(history_key, 0, -EXPORT_HISTORY_LIMIT - 1)  # cap at last N
        pipe.expire(history_key, EXPORT_HISTORY_TTL_SECONDS)
        pipe.execute()
    except Exception:
        # If Redis is unavailable here, the worker will recreate the hash; history index is best-effort.
        pass

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


@router.get("", response_model=ExportHistoryResponse)
async def list_export_history(
    story: Story = Depends(get_story),
):
    """Return up to 10 most recent export jobs for this story (most recent first)."""
    import redis as redis_lib

    try:
        r = redis_lib.from_url(app_settings.redis_url)
        history_key = f"story:{story.id}:exports"
        # Most recent first.
        job_ids = [jid.decode() for jid in r.zrevrange(history_key, 0, EXPORT_HISTORY_LIMIT - 1)]
        if not job_ids:
            return ExportHistoryResponse(items=[], total=0)
        pipe = r.pipeline()
        for jid in job_ids:
            pipe.hgetall(f"export_job:{jid}")
        results = pipe.execute()
    except Exception:
        raise HTTPException(status_code=503, detail="Export history unavailable")

    items: list[ExportJobStatus] = []
    stale_ids: list[str] = []
    for jid, raw in zip(job_ids, results):
        if not raw:
            stale_ids.append(jid)
            continue
        items.append(_decode_job_hash(jid, raw))

    if stale_ids:
        try:
            r.zrem(f"story:{story.id}:exports", *stale_ids)
        except Exception:
            pass  # cleanup is best-effort

    return ExportHistoryResponse(items=items, total=len(items))


@router.get("/{job_id}", response_model=ExportJobStatus)
async def get_export_status(
    job_id: str,
    story: Story = Depends(get_story),
):
    """Check the status of an export job."""
    import redis as redis_lib

    try:
        r = redis_lib.from_url(app_settings.redis_url)
        job_data = r.hgetall(f"export_job:{job_id}")
    except Exception:
        raise HTTPException(status_code=503, detail="Job status unavailable")

    if not job_data:
        raise HTTPException(status_code=404, detail="Export job not found")

    return _decode_job_hash(job_id, job_data)
