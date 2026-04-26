"""Celery task for async export generation."""

from __future__ import annotations

import json
import logging
import uuid

import redis

from app.ai.errors import safe_error_message
from app.config import settings
from app.export import get_exporter
from app.export.base import ExportOptions
from app.storage.s3 import S3Storage
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

_redis_client = None


def _get_redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.redis_url)
    return _redis_client


def _publish_progress(job_id: str, progress: float, status: str = "running"):
    """Publish progress update via Redis pub/sub."""
    try:
        r = _get_redis()
        r.publish(
            f"export:{job_id}",
            json.dumps({"job_id": job_id, "progress": progress, "status": status}),
        )
    except Exception:
        logger.warning("Failed to publish export progress", exc_info=True)


def _publish_story_event(story_id: str, event_type: str, data: dict):
    """Publish an event to the per-story SSE channel consumed by the frontend."""
    try:
        r = _get_redis()
        r.publish(
            f"story:{story_id}:events",
            json.dumps({"type": event_type, "data": data}),
        )
    except Exception:
        logger.warning("Failed to publish story event %s", event_type, exc_info=True)


@celery_app.task(bind=True, name="app.tasks.export_tasks.run_export")
def run_export(
    self,
    job_id: str,
    story: dict,
    chapters: list[dict],
    story_settings: list[dict],
    fmt: str,
    options: dict | None = None,
):
    """Run an export job: generate file, upload to S3, publish progress.

    Args:
        job_id: unique export job identifier.
        story: story dict with title, id.
        chapters: list of chapter dicts.
        story_settings: list of settings dicts.
        fmt: export format (pdf, docx, epub, plaintext).
        options: export option overrides.
    """
    try:
        r = _get_redis()
        r.hset(f"export_job:{job_id}", mapping={"status": "running", "progress": "0"})

        exporter = get_exporter(fmt)
        opts = ExportOptions(**(options or {}))

        def on_progress(p: float):
            _publish_progress(job_id, p)
            r.hset(f"export_job:{job_id}", "progress", str(round(p, 2)))

        result = exporter.export(
            story=story,
            chapters=chapters,
            settings=story_settings,
            options=opts,
            on_progress=on_progress,
        )

        # Upload to S3
        s3_key = f"exports/{story.get('id', 'unknown')}/{job_id}/{result.filename}"
        storage = S3Storage()
        storage.upload(
            bucket=settings.s3_bucket_exports,
            key=s3_key,
            data=result.file_bytes,
            content_type=result.content_type,
        )

        download_url = storage.get_presigned_url(
            bucket=settings.s3_bucket_exports,
            key=s3_key,
            expiry=settings.s3_presigned_expiry,
        )

        r.hset(
            f"export_job:{job_id}",
            mapping={
                "status": "completed",
                "progress": "1.0",
                "download_url": download_url,
                "filename": result.filename,
                "content_type": result.content_type,
                "word_count": str(result.word_count),
            },
        )
        r.expire(f"export_job:{job_id}", 86400)  # 24h TTL
        _publish_progress(job_id, 1.0, status="completed")
        _publish_story_event(
            story.get("id", ""),
            "export.complete",
            {
                "job_id": job_id,
                "format": fmt,
                "filename": result.filename,
                "download_url": download_url,
                "content_type": result.content_type,
                "word_count": result.word_count,
            },
        )

    except Exception as exc:
        logger.exception("Export job %s failed", job_id)
        safe_msg = safe_error_message(exc)
        try:
            r = _get_redis()
            r.hset(
                f"export_job:{job_id}",
                mapping={"status": "failed", "error": safe_msg},
            )
            _publish_progress(job_id, 0, status="failed")
            _publish_story_event(
                story.get("id", ""),
                "export.failed",
                {"job_id": job_id, "format": fmt, "error": safe_msg},
            )
        except Exception:
            pass
        raise
