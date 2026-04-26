"""Chat agent — tool-calling loop over the curated chat tools.

Read tools auto-execute and feed their results back into the agent.
Write tools persist as proposed assistant messages and pause the loop;
mutation only happens via apply_tool_call (Task 12, REST endpoint).
"""
from __future__ import annotations

import json
import uuid
from typing import Any, AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.context.assembler import build_chat_context
from app.ai.llm import call_llm_with_tools
from app.ai.tools.chat_tools import (
    READ_TOOLS,
    READ_TOOL_IMPLS,
    WRITE_TOOLS,
    WRITE_TOOL_PREVIEWS,
)
from app.models.chat_message import ChatMessageRole, ToolCallStatus
from app.models.chat_thread import ChatThread
from app.services import chat_service


SYSTEM_INSTRUCTIONS = (
    "You are the BeatLume story assistant. You help the user think about, "
    "explore, and refine their story. Use read tools freely to fetch context. "
    "When proposing changes, use write tools — they will be shown to the user "
    "as approval cards. Do not invent tools; only call those provided. "
    "Be concise."
)

MAX_TOOL_LOOP_ITERATIONS = 6


def _coerce_uuid_args(args: dict[str, Any]) -> dict[str, Any]:
    """Convert UUID-shaped string values into uuid.UUID for impls that expect them."""
    out = {**args}
    for k, v in list(out.items()):
        if isinstance(v, str) and len(v) == 36 and v.count("-") == 4:
            try:
                out[k] = uuid.UUID(v)
            except ValueError:
                pass
    return out


async def run_chat_turn(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    story_id: uuid.UUID,
    thread: ChatThread,
    user_text: str,
    active_scene_id: uuid.UUID | None,
) -> AsyncIterator[dict[str, Any]]:
    """Run a single chat turn. Yields SSE-shaped events: {type, data}."""

    # 1) Persist user message
    user_msg = await chat_service.persist_message(
        db, org_id, thread.id, ChatMessageRole.user, content=user_text
    )
    yield {"type": "chat.user.persisted", "data": {"id": str(user_msg.id)}}

    # 2) Build adaptive context
    story_context = await build_chat_context(db, story_id, active_scene_id=active_scene_id)
    history_rows, _ = await chat_service.list_messages(db, thread.id, limit=100)

    # 3) Build LiteLLM message list
    messages: list[dict] = [
        {"role": "system", "content": SYSTEM_INSTRUCTIONS + "\n\n" + story_context},
    ]
    for m in history_rows:
        if m.role == ChatMessageRole.user and m.content is not None:
            messages.append({"role": "user", "content": m.content})
        elif m.role == ChatMessageRole.assistant:
            entry: dict[str, Any] = {"role": "assistant", "content": m.content or ""}
            if m.tool_calls:
                entry["tool_calls"] = [
                    {
                        "id": tc.get("id", "x"),
                        "type": "function",
                        "function": {
                            "name": tc["name"],
                            "arguments": json.dumps(tc.get("arguments", {})),
                        },
                    }
                    for tc in m.tool_calls
                ]
            messages.append(entry)
        elif m.role == ChatMessageRole.tool and m.tool_call_result is not None:
            tc_id = (m.tool_calls or [{}])[0].get("id", "x") if m.tool_calls else "x"
            messages.append({
                "role": "tool",
                "tool_call_id": tc_id,
                "content": json.dumps(m.tool_call_result),
            })

    tools = READ_TOOLS + WRITE_TOOLS
    write_names = {t["name"] for t in WRITE_TOOLS}

    # 4) Tool-calling loop
    for _ in range(MAX_TOOL_LOOP_ITERATIONS):
        result = await call_llm_with_tools(messages, tools)
        tcs = result.get("tool_calls") or []

        # Case A — no tool calls, model produced final assistant text
        if not tcs:
            assistant = await chat_service.persist_message(
                db, org_id, thread.id, ChatMessageRole.assistant,
                content=result.get("content") or "",
            )
            yield {
                "type": "chat.message.complete",
                "data": {"id": str(assistant.id), "content": assistant.content},
            }
            return

        # Case B — write tool requested: persist as proposed and pause
        write_tcs = [tc for tc in tcs if tc["name"] in write_names]
        if write_tcs:
            tc = write_tcs[0]  # one write per turn (multiple = future scope)
            preview_fn = WRITE_TOOL_PREVIEWS[tc["name"]]
            preview = await preview_fn(db, story_id, **_coerce_uuid_args(tc["arguments"]))
            persisted = await chat_service.persist_message(
                db, org_id, thread.id, ChatMessageRole.assistant,
                content=result.get("content"),
                tool_calls=[tc],
                tool_call_status=ToolCallStatus.proposed,
                tool_call_result=preview,
            )
            yield {
                "type": "chat.tool_call.proposed",
                "data": {
                    "id": str(persisted.id),
                    "tool_name": tc["name"],
                    "preview": preview,
                },
            }
            return

        # Case C — read tools: execute all, append tool messages, loop
        # Append the assistant message that requested the calls (LiteLLM protocol fidelity)
        messages.append({
            "role": "assistant",
            "content": result.get("content") or "",
            "tool_calls": [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {
                        "name": tc["name"],
                        "arguments": json.dumps(tc["arguments"]),
                    },
                }
                for tc in tcs
            ],
        })
        for tc in tcs:
            impl = READ_TOOL_IMPLS.get(tc["name"])
            if impl is None:
                tool_result: dict[str, Any] = {"error": "unknown_tool", "name": tc["name"]}
            else:
                try:
                    tool_result = await impl(db, story_id, **_coerce_uuid_args(tc["arguments"]))
                except Exception as exc:
                    tool_result = {"error": "tool_failed", "message": str(exc)[:200]}

            await chat_service.persist_message(
                db, org_id, thread.id, ChatMessageRole.tool,
                tool_calls=[tc], tool_call_result=tool_result,
            )
            yield {
                "type": "chat.tool.executed",
                "data": {"tool_name": tc["name"], "result": tool_result},
            }
            messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": json.dumps(tool_result),
            })

    # Loop bailout — over iteration limit. Persist a fallback assistant message.
    fallback = await chat_service.persist_message(
        db, org_id, thread.id, ChatMessageRole.assistant,
        content="(I hit the tool-call iteration limit. Try narrowing the question.)",
    )
    yield {
        "type": "chat.message.complete",
        "data": {"id": str(fallback.id), "content": fallback.content},
    }
