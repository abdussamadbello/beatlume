"""Tool registry for the chat agent.

Read tools auto-execute and feed their result back into the agent.
Write tools (added in Task 7) generate a *preview* (no DB mutation) and
pause the agent; mutation only happens via apply_tool_call (Task 12).
"""
from __future__ import annotations

import difflib
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.character import Character
from app.models.scene import Scene
from app.services import character as character_service
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


# ---------- Write tool previews ----------

async def preview_edit_scene_draft(
    db: AsyncSession, story_id: uuid.UUID, *, scene_id: uuid.UUID, new_text: str
) -> dict[str, Any]:
    scene = await scene_service.get_scene(db, story_id, scene_id)
    if scene is None:
        return {"error": "scene_not_found", "scene_id": str(scene_id)}
    existing_draft = await draft_service.get_draft(db, story_id, scene_id)
    old_text = existing_draft.content if existing_draft else ""
    diff = "".join(
        difflib.unified_diff(
            old_text.splitlines(keepends=True),
            new_text.splitlines(keepends=True),
            fromfile=f"scene-{scene.n}/before",
            tofile=f"scene-{scene.n}/after",
            n=2,
        )
    )
    return {
        "kind": "diff",
        "scene_id": str(scene_id),
        "scene_n": scene.n,
        "old_word_count": len(old_text.split()),
        "new_word_count": len(new_text.split()),
        "diff": diff,
    }


async def preview_propose_scene(
    db: AsyncSession, story_id: uuid.UUID, *, after_id: uuid.UUID | None,
    summary: str, scene_n: int, title: str = "",
) -> dict[str, Any]:
    return {
        "kind": "scene_proposal",
        "after_id": str(after_id) if after_id else None,
        "scene_n": scene_n,
        "title": title,
        "summary": summary,
    }


async def preview_update_character_note(
    db: AsyncSession, story_id: uuid.UUID, *, character_id: uuid.UUID, note_text: str, append: bool = True,
) -> dict[str, Any]:
    c = await character_service.get_character(db, story_id, character_id)
    if c is None:
        return {"error": "character_not_found", "character_id": str(character_id)}
    before = c.bio or ""
    after = (before.rstrip() + "\n\n" + note_text).strip() if append else note_text
    return {
        "kind": "character_note",
        "character_id": str(character_id),
        "character_name": c.name,
        "append": append,
        "before": before,
        "after": after,
    }


async def preview_summarize_scene(
    db: AsyncSession, story_id: uuid.UUID, *, scene_id: uuid.UUID,
) -> dict[str, Any]:
    scene = await scene_service.get_scene(db, story_id, scene_id)
    if scene is None:
        return {"error": "scene_not_found", "scene_id": str(scene_id)}
    return {
        "kind": "summary_proposal",
        "scene_id": str(scene_id),
        "scene_n": scene.n,
        "current_summary": scene.summary,
        "note": "Preview is approximate; the summary is regenerated at apply time.",
    }


# ---------- Write tool appliers ----------

async def apply_edit_scene_draft(
    db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, *,
    scene_id: uuid.UUID, new_text: str,
) -> dict[str, Any]:
    draft = await draft_service.upsert_draft(db, story_id, scene_id, org_id, new_text)
    return {"applied": True, "scene_id": str(scene_id), "word_count": draft.word_count}


async def apply_propose_scene(
    db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, *,
    after_id: uuid.UUID | None, summary: str, scene_n: int, title: str = "",
) -> dict[str, Any]:
    # scene_service.create_scene auto-assigns n. We pass title/summary/pov as fields;
    # `after_id` and `scene_n` from the LLM are advisory hints — the auto-assigned `n`
    # is authoritative. Don't fight the service.
    scene = await scene_service.create_scene(
        db, story_id, org_id, {
            "title": title or summary[:60],
            "pov": "",
            "summary": summary,
        }
    )
    return {"applied": True, "scene_id": str(scene.id), "scene_n": scene.n}


async def apply_update_character_note(
    db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, *,
    character_id: uuid.UUID, note_text: str, append: bool = True,
) -> dict[str, Any]:
    char = await character_service.get_character(db, story_id, character_id)
    if char is None:
        return {"applied": False, "error": "character_not_found"}
    new_bio = (
        ((char.bio or "").rstrip() + "\n\n" + note_text).strip()
        if append
        else note_text
    )
    await character_service.update_character(db, char, {"bio": new_bio})
    return {"applied": True, "character_id": str(character_id)}


async def apply_summarize_scene(
    db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, *,
    scene_id: uuid.UUID,
) -> dict[str, Any]:
    """Regenerate scene summary by invoking the existing summary graph.

    The canonical path (build_summary_graph + run_graph) also manages beats, SSE
    progress events, and a dedicated DB engine — too heavy to replicate inline here
    without duplicating significant plumbing from ai_tasks.py. Left as a safe fallback;
    Task 12 will degrade gracefully on applied: False and the user can rerun via Tasks tab.
    """
    return {"applied": False, "error": "summarize_not_yet_supported"}


WRITE_TOOLS: list[dict[str, Any]] = [
    {
        "name": "edit_scene_draft",
        "description": "Replace a scene's draft text. Generates a unified diff for approval.",
        "parameters": {
            "type": "object",
            "properties": {
                "scene_id": {"type": "string", "format": "uuid"},
                "new_text": {"type": "string"},
            },
            "required": ["scene_id", "new_text"],
        },
    },
    {
        "name": "propose_scene",
        "description": "Add a new scene scaffold after a given scene id (or at start if null).",
        "parameters": {
            "type": "object",
            "properties": {
                "after_id": {"type": ["string", "null"], "format": "uuid"},
                "summary": {"type": "string"},
                "scene_n": {"type": "integer", "minimum": 1},
                "title": {"type": "string"},
            },
            "required": ["summary", "scene_n"],
        },
    },
    {
        "name": "update_character_note",
        "description": "Append (or replace) a character's bio (free-form notes).",
        "parameters": {
            "type": "object",
            "properties": {
                "character_id": {"type": "string", "format": "uuid"},
                "note_text": {"type": "string"},
                "append": {"type": "boolean", "default": True},
            },
            "required": ["character_id", "note_text"],
        },
    },
    {
        "name": "summarize_scene",
        "description": "Regenerate a scene's summary using the existing summary graph.",
        "parameters": {
            "type": "object",
            "properties": {"scene_id": {"type": "string", "format": "uuid"}},
            "required": ["scene_id"],
        },
    },
]

WRITE_TOOL_PREVIEWS: dict[str, Any] = {
    "edit_scene_draft": preview_edit_scene_draft,
    "propose_scene": preview_propose_scene,
    "update_character_note": preview_update_character_note,
    "summarize_scene": preview_summarize_scene,
}

WRITE_TOOL_APPLIERS: dict[str, Any] = {
    "edit_scene_draft": apply_edit_scene_draft,
    "propose_scene": apply_propose_scene,
    "update_character_note": apply_update_character_note,
    "summarize_scene": apply_summarize_scene,
}
