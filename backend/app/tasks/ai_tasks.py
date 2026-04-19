import json
import redis

from app.config import settings
from app.tasks.celery_app import celery_app

redis_client = redis.Redis.from_url(settings.redis_url)


def publish_event(story_id: str, event_type: str, data: dict):
    """Publish event to Redis pub/sub for SSE consumption."""
    redis_client.publish(
        f"story:{story_id}:events",
        json.dumps({"type": event_type, "data": data}),
    )


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def continue_prose(self, story_id: str, scene_id: str, org_id: str):
    """Prose continuation task. Runs ProseGraph and publishes result."""
    publish_event(story_id, "ai.progress", {
        "task_id": self.request.id, "type": "prose_continuation", "status": "running",
    })
    try:
        # Graph execution happens here — requires async context
        # For now, this is a placeholder that will be wired up when
        # we integrate with the async DB session in the Celery worker
        publish_event(story_id, "ai.complete", {
            "task_id": self.request.id, "type": "prose_continuation",
            "status": "completed",
        })
    except Exception as exc:
        publish_event(story_id, "ai.error", {
            "task_id": self.request.id, "error": str(exc),
        })
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def generate_insights(self, story_id: str, org_id: str):
    """Full story insight analysis."""
    publish_event(story_id, "ai.progress", {
        "task_id": self.request.id, "type": "insight_generation", "status": "running",
    })
    try:
        publish_event(story_id, "ai.complete", {
            "task_id": self.request.id, "type": "insight_generation",
            "status": "completed",
        })
    except Exception as exc:
        publish_event(story_id, "ai.error", {
            "task_id": self.request.id, "error": str(exc),
        })
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def infer_relationships(self, story_id: str, org_id: str):
    """AI relationship inference across character pairs."""
    publish_event(story_id, "ai.progress", {
        "task_id": self.request.id, "type": "relationship_inference", "status": "running",
    })
    try:
        publish_event(story_id, "ai.complete", {
            "task_id": self.request.id, "type": "relationship_inference",
            "status": "completed",
        })
    except Exception as exc:
        publish_event(story_id, "ai.error", {
            "task_id": self.request.id, "error": str(exc),
        })
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def summarize_scene(self, story_id: str, scene_id: str, org_id: str):
    """Generate summary + beats for a single scene."""
    publish_event(story_id, "ai.progress", {
        "task_id": self.request.id, "type": "scene_summarization", "status": "running",
    })
    try:
        publish_event(story_id, "ai.complete", {
            "task_id": self.request.id, "type": "scene_summarization",
            "status": "completed",
        })
    except Exception as exc:
        publish_event(story_id, "ai.error", {
            "task_id": self.request.id, "error": str(exc),
        })
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def scaffold_story(self, story_id: str, premise: str, structure: str,
                   target_words: int, genres: list, characters: list, org_id: str):
    """Generate full story structure from premise."""
    publish_event(story_id, "ai.progress", {
        "task_id": self.request.id, "type": "story_scaffolding", "status": "running",
    })
    try:
        publish_event(story_id, "ai.complete", {
            "task_id": self.request.id, "type": "story_scaffolding",
            "status": "completed",
        })
    except Exception as exc:
        publish_event(story_id, "ai.error", {
            "task_id": self.request.id, "error": str(exc),
        })
        raise self.retry(exc=exc)
