"""Execute validated insight-apply operations against scenes and drafts."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scene import Scene
from app.services import draft as draft_service
from app.services import manuscript_assembly as manuscript_assembly_service


def filter_operations_for_scenes(
    operations: list[dict[str, Any]], allowed_scene_ns: set[int]
) -> list[dict[str, Any]]:
    """Drop operations targeting scenes outside the allowed set."""
    out: list[dict[str, Any]] = []
    for op in operations:
        n = op.get("scene_n")
        if isinstance(n, int) and n in allowed_scene_ns:
            out.append(op)
    return out


async def apply_insight_operations(
    db: AsyncSession,
    story_id: uuid.UUID,
    org_id: uuid.UUID,
    allowed_scene_ns: set[int],
    operations: list[dict[str, Any]],
) -> dict[str, int]:
    """Returns counts of applied ops by kind."""
    counts = {"append_draft": 0, "patch_scene_summary": 0, "adjust_tension": 0}
    filtered = filter_operations_for_scenes(operations, allowed_scene_ns)
    for op in filtered:
        n = int(op["scene_n"])
        kind = op["kind"]
        scene_r = await db.execute(
            select(Scene).where(Scene.story_id == story_id, Scene.n == n)
        )
        scene = scene_r.scalar_one_or_none()
        if scene is None:
            continue
        if kind == "append_draft":
            text = (op.get("text") or "").strip()
            if not text:
                continue
            draft = await draft_service.get_draft(db, story_id, scene.id)
            base = (draft.content if draft else "") or ""
            new_content = base.rstrip() + "\n\n" + text
            await draft_service.upsert_draft(db, story_id, scene.id, org_id, new_content)
            counts["append_draft"] += 1
        elif kind == "patch_scene_summary":
            summary = (op.get("summary") or "").strip()
            if not summary:
                continue
            scene.summary = summary
            await db.commit()
            await db.refresh(scene)
            counts["patch_scene_summary"] += 1
        elif kind == "adjust_tension":
            t = int(op["tension"])
            if 1 <= t <= 10:
                scene.tension = t
                await db.commit()
                await db.refresh(scene)
                counts["adjust_tension"] += 1

    await manuscript_assembly_service.sync_manuscript_chapters_from_drafts(
        db, story_id, org_id
    )
    return counts
