"""One-shot live test: create a throwaway story and run the real scaffold pipeline (no Celery).

Usage (from `backend/`):
  PYTHONPATH=. poetry run python scripts/live_scaffold_once.py

Requires: PostgreSQL, `backend/.env` with valid `OPENROUTER_API_KEY` (or other provider) and
valid `AI_MODEL_SCAFFOLD` (e.g. openrouter/google/gemini-2.5-flash).
"""
from __future__ import annotations

import asyncio
import sys
import uuid

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.story import Story
from app.models.user import Organization
from app.models.scene import Scene
from app.tasks.ai_tasks import _run_scaffold


async def main() -> int:
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        pool_pre_ping=True,
        connect_args={"prepared_statement_cache_size": 0},
    )
    sm = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    org_id: uuid.UUID
    story_id: uuid.UUID
    try:
        async with sm() as db:
            org = Organization(
                name="Live smoke org",
                slug=f"smoke-{uuid.uuid4().hex[:12]}",
            )
            db.add(org)
            await db.flush()
            story = Story(
                org_id=org.id,
                title="Live smoke story",
                logline="A keeper finds a map. Short test run.",
                genres=["Literary"],
                target_words=8000,
                structure_type="3-act",
            )
            db.add(story)
            await db.commit()
            org_id, story_id = org.id, story.id
            print(f"Created story_id={story_id} org_id={org_id}")

        await _run_scaffold(
            "live-smoke-task",
            str(story_id),
            "A lighthouse keeper finds a map in a bottle. Coastal mystery, one main character.",
            "3-act",
            8000,
            ["Mystery"],
            [],
            str(org_id),
            replace_existing=False,
        )
        print("scaffold run finished (no exception).")

        async with sm() as db:
            await db.execute(
                text("SELECT set_config('app.current_org_id', :oid, true)"),
                {"oid": str(org_id)},
            )
            n = (await db.execute(
                select(func.count()).select_from(Scene).where(Scene.story_id == story_id)
            )).scalar() or 0
        print(f"scenes in DB: {n}")
        if n == 0:
            print("WARNING: 0 scenes — check Celery logs if you used API, or model JSON validation.")
            return 2
        print("OK: live scaffold created at least one scene.")
        return 0
    finally:
        await engine.dispose()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
