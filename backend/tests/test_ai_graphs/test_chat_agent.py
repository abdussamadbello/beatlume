import pytest

from app.ai.graphs.chat_agent import run_chat_turn
from app.models.chat_message import ChatMessageRole


@pytest.mark.asyncio
async def test_run_chat_turn_text_only(
    db_session, sample_org, sample_story, monkeypatch
):
    async def fake_call(messages, tools, **kwargs):
        return {"content": "Hello back!", "tool_calls": None, "finish_reason": "stop", "usage": None}

    monkeypatch.setattr("app.ai.graphs.chat_agent.call_llm_with_tools", fake_call)

    from app.services import chat_service
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    events = []
    async for ev in run_chat_turn(
        db_session,
        org_id=sample_org.id,
        story_id=sample_story.id,
        thread=thread,
        user_text="Hi.",
        active_scene_id=None,
    ):
        events.append(ev)

    types = [e["type"] for e in events]
    assert "chat.user.persisted" in types
    assert "chat.message.complete" in types
    assert any(
        e["type"] == "chat.message.complete" and e["data"].get("content") == "Hello back!"
        for e in events
    )


@pytest.mark.asyncio
async def test_run_chat_turn_executes_read_tool_then_responds(
    db_session, sample_org, sample_story, sample_scene, monkeypatch
):
    calls = {"n": 0}

    async def fake_call(messages, tools, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            return {
                "content": None,
                "tool_calls": [{
                    "id": "tc1",
                    "name": "get_scene",
                    "arguments": {"scene_id": str(sample_scene.id)},
                }],
                "finish_reason": "tool_calls",
                "usage": None,
            }
        return {"content": "Done.", "tool_calls": None, "finish_reason": "stop", "usage": None}

    monkeypatch.setattr("app.ai.graphs.chat_agent.call_llm_with_tools", fake_call)

    from app.services import chat_service
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    events = []
    async for ev in run_chat_turn(
        db_session,
        org_id=sample_org.id, story_id=sample_story.id, thread=thread,
        user_text="Show scene 1.", active_scene_id=None,
    ):
        events.append(ev)

    types = [e["type"] for e in events]
    assert "chat.tool.executed" in types
    assert "chat.message.complete" in types


@pytest.mark.asyncio
async def test_run_chat_turn_proposes_write_and_pauses(
    db_session, sample_org, sample_story, sample_scene, monkeypatch
):
    async def fake_call(messages, tools, **kwargs):
        return {
            "content": "Let me edit scene 1.",
            "tool_calls": [{
                "id": "tc1",
                "name": "edit_scene_draft",
                "arguments": {"scene_id": str(sample_scene.id), "new_text": "X"},
            }],
            "finish_reason": "tool_calls",
            "usage": None,
        }

    monkeypatch.setattr("app.ai.graphs.chat_agent.call_llm_with_tools", fake_call)

    from app.services import chat_service
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    events = []
    async for ev in run_chat_turn(
        db_session,
        org_id=sample_org.id, story_id=sample_story.id, thread=thread,
        user_text="edit it", active_scene_id=None,
    ):
        events.append(ev)

    types = [e["type"] for e in events]
    assert "chat.tool_call.proposed" in types
    # Loop must pause (no chat.message.complete) — turn ends pending approval.
    assert "chat.message.complete" not in types
