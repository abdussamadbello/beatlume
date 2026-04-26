"""Tool registry for the chat agent.

Read tools auto-execute and feed their result back into the agent.
Write tools (added in Task 7) generate a *preview* (no DB mutation) and
pause the agent; mutation only happens via apply_tool_call (Task 12).
"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.character import Character
from app.models.scene import Scene
from app.services import draft as draft_service
from app.services import scene as scene_service


# ---------- Read tools ----------

async def tool_get_scene(db: AsyncSession, story_id: uuid.UUID, *, scene_id: uuid.UUID) -> dict[str, Any]:
    scene = await scene_service.get_scene(db, story_id, scene_id)
    if scene is None:
        return {"error": "scene_not_found", "scene_id": str(scene_id)}
    draft = await draft_service.get_draft(db, story_id, scene_id)
    return {
        "id": str(scene.id),
        "n": scene.n,
        "title": scene.title,
        "summary": scene.summary,
        "pov": scene.pov,
        "act": scene.act,
        "tension": scene.tension,
        "draft": draft.content if draft else "",
    }


async def tool_list_characters(db: AsyncSession, story_id: uuid.UUID) -> dict[str, Any]:
    rows = (await db.execute(
        select(Character).where(Character.story_id == story_id).order_by(Character.name.asc())
    )).scalars().all()
    return {
        "characters": [
            {"id": str(c.id), "name": c.name, "role": c.role}
            for c in rows
        ]
    }


async def tool_get_character(db: AsyncSession, story_id: uuid.UUID, *, character_id: uuid.UUID) -> dict[str, Any]:
    c = (await db.execute(
        select(Character).where(Character.id == character_id, Character.story_id == story_id)
    )).scalar_one_or_none()
    if c is None:
        return {"error": "character_not_found", "character_id": str(character_id)}
    # `bio` is the canonical "free-form notes" field on Character in this codebase.
    return {
        "id": str(c.id),
        "name": c.name,
        "role": c.role,
        "notes": c.bio or "",
    }


async def tool_get_scene_summaries(
    db: AsyncSession, story_id: uuid.UUID, *, start: int = 1, end: int = 1000
) -> dict[str, Any]:
    rows = (await db.execute(
        select(Scene)
        .where(Scene.story_id == story_id, Scene.n >= start, Scene.n <= end)
        .order_by(Scene.n.asc())
    )).scalars().all()
    return {
        "scenes": [
            {"id": str(s.id), "n": s.n, "title": s.title, "summary": s.summary}
            for s in rows
        ]
    }


async def tool_find_inconsistencies(db: AsyncSession, story_id: uuid.UUID) -> dict[str, Any]:
    """Read-only: surfaces recent insights for the story.

    Adapts to whatever read function the existing insight_service exposes —
    the plan called for `list_recent_insights`, but this codebase has `list_insights`.
    `list_insights` returns a tuple (list[Insight], total: int).
    """
    from app.services import insight as insight_service
    # list_insights(db, story_id, ...) -> tuple[list[Insight], int]
    result = await insight_service.list_insights(db, story_id)
    rows = result[0] if isinstance(result, tuple) else result
    rows = list(rows)[:20]
    return {
        "insights": [
            {
                "id": str(i.id),
                "type": i.category,
                "summary": i.title or i.body or "",
            }
            for i in rows
        ]
    }


# OpenAI/LiteLLM tool spec shape — `function` per their function-calling format.
READ_TOOLS: list[dict[str, Any]] = [
    {
        "name": "get_scene",
        "description": "Fetch a single scene with metadata and full draft text.",
        "parameters": {
            "type": "object",
            "properties": {"scene_id": {"type": "string", "format": "uuid"}},
            "required": ["scene_id"],
        },
    },
    {
        "name": "list_characters",
        "description": "List all characters in this story (id, name, role).",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_character",
        "description": "Fetch a character including their bio (free-form notes).",
        "parameters": {
            "type": "object",
            "properties": {"character_id": {"type": "string", "format": "uuid"}},
            "required": ["character_id"],
        },
    },
    {
        "name": "get_scene_summaries",
        "description": "Flat list of scene summaries within a scene-number range.",
        "parameters": {
            "type": "object",
            "properties": {
                "start": {"type": "integer", "minimum": 1},
                "end": {"type": "integer", "minimum": 1},
            },
            "required": ["start", "end"],
        },
    },
    {
        "name": "find_inconsistencies",
        "description": "Read recent insights about plot or character inconsistencies.",
        "parameters": {"type": "object", "properties": {}},
    },
]


READ_TOOL_IMPLS = {
    "get_scene": tool_get_scene,
    "list_characters": tool_list_characters,
    "get_character": tool_get_character,
    "get_scene_summaries": tool_get_scene_summaries,
    "find_inconsistencies": tool_find_inconsistencies,
}


# Write tools — populated in Task 7. Symbol must exist for the agent (Task 10) to import.
WRITE_TOOLS: list[dict[str, Any]] = []
WRITE_TOOL_PREVIEWS: dict[str, Any] = {}
WRITE_TOOL_APPLIERS: dict[str, Any] = {}
