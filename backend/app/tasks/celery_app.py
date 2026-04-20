from celery import Celery

from app.config import settings

celery_app = Celery("beatlume")

celery_app.config_from_object({
    "broker_url": settings.redis_url,
    "result_backend": settings.redis_url,
    "task_serializer": "json",
    "result_serializer": "json",
    "accept_content": ["json"],
    "task_track_started": True,
    "task_time_limit": 300,
    "task_soft_time_limit": 240,
    "worker_prefetch_multiplier": 1,
    "task_acks_late": True,
})

celery_app.conf.task_routes = {
    "app.tasks.ai_tasks.continue_prose": {"queue": "ai_fast"},
    "app.tasks.ai_tasks.summarize_scene": {"queue": "ai_fast"},
    "app.tasks.ai_tasks.generate_insights": {"queue": "ai_heavy"},
    "app.tasks.ai_tasks.infer_relationships": {"queue": "ai_heavy"},
    "app.tasks.ai_tasks.scaffold_story": {"queue": "ai_heavy"},
    "app.tasks.export_tasks.run_export": {"queue": "export"},
}
