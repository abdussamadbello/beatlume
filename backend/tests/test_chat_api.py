import pytest


async def _make_story(client, headers, title="Chat API Story"):
    resp = await client.post("/api/stories", json={"title": title, "genres": ["Literary"]}, headers=headers)
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


async def test_create_thread_endpoint(client, auth_headers):
    story_id = await _make_story(client, auth_headers)
    resp = await client.post(
        f"/api/stories/{story_id}/chat/threads",
        headers=auth_headers,
        json={},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["story_id"] == story_id
    assert body["archived_at"] is None


async def test_list_threads_endpoint_returns_paginated_shape(client, auth_headers):
    story_id = await _make_story(client, auth_headers)
    resp = await client.get(
        f"/api/stories/{story_id}/chat/threads",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "items" in body
    assert "total" in body


async def test_get_messages_endpoint(client, auth_headers):
    story_id = await _make_story(client, auth_headers)
    create_resp = await client.post(
        f"/api/stories/{story_id}/chat/threads", headers=auth_headers, json={}
    )
    thread_id = create_resp.json()["id"]
    # No messages yet — should return empty list
    resp = await client.get(
        f"/api/chat/threads/{thread_id}/messages",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 0


async def test_delete_thread_archives(client, auth_headers):
    story_id = await _make_story(client, auth_headers)
    create_resp = await client.post(
        f"/api/stories/{story_id}/chat/threads", headers=auth_headers, json={}
    )
    thread_id = create_resp.json()["id"]
    resp = await client.delete(
        f"/api/chat/threads/{thread_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 204
    # Listing should now be empty (archived by default excluded)
    list_resp = await client.get(f"/api/stories/{story_id}/chat/threads", headers=auth_headers)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 0


async def test_thread_not_found_for_other_org(client, auth_headers, second_org_auth_headers):
    story_id = await _make_story(client, auth_headers)
    create_resp = await client.post(
        f"/api/stories/{story_id}/chat/threads", headers=auth_headers, json={}
    )
    thread_id = create_resp.json()["id"]
    # Second org's user must NOT be able to see this thread.
    # Expected: 404 (not 403) per the spec — don't leak existence across orgs.
    resp = await client.get(
        f"/api/chat/threads/{thread_id}/messages",
        headers=second_org_auth_headers,
    )
    assert resp.status_code == 404, f"got {resp.status_code}: {resp.text}"


@pytest.mark.asyncio
async def test_send_message_streams_user_persisted_then_complete(
    client, auth_headers, monkeypatch
):
    # Stub the agent so the test doesn't hit a real LLM
    async def fake_run(db, *, org_id, story_id, thread, user_text, active_scene_id):
        yield {"type": "chat.user.persisted", "data": {"id": "u1"}}
        yield {"type": "chat.message.complete", "data": {"id": "a1", "content": "ok"}}

    import app.api.chat as chat_api
    monkeypatch.setattr(chat_api, "run_chat_turn", fake_run)

    story_id = await _make_story(client, auth_headers)
    create_resp = await client.post(
        f"/api/stories/{story_id}/chat/threads", headers=auth_headers, json={}
    )
    thread_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/chat/threads/{thread_id}/messages",
        headers=auth_headers,
        json={"content": "hello", "active_scene_id": None},
    )
    assert resp.status_code == 200, resp.text
    body = resp.text
    assert "event: chat.user.persisted" in body
    assert "event: chat.message.complete" in body


@pytest.mark.asyncio
async def test_send_message_other_org_404(
    client, auth_headers, second_org_auth_headers
):
    # Create a thread under one org, try to send via the other org's user
    story_id = await _make_story(client, auth_headers)
    create_resp = await client.post(
        f"/api/stories/{story_id}/chat/threads", headers=auth_headers, json={}
    )
    thread_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/chat/threads/{thread_id}/messages",
        headers=second_org_auth_headers,
        json={"content": "hijack", "active_scene_id": None},
    )
    assert resp.status_code == 404, resp.text


@pytest.mark.asyncio
async def test_apply_tool_call_endpoint(
    client, auth_headers, db_session
):
    from app.services import chat_service, draft as draft_service
    from app.models.chat_message import ChatMessageRole, ToolCallStatus

    story_id = await _make_story(client, auth_headers)

    # Create a scene via API
    scene_resp = await client.post(
        f"/api/stories/{story_id}/scenes",
        headers=auth_headers,
        json={"title": "Scene 1", "pov": "X", "summary": "summary"},
    )
    assert scene_resp.status_code in (200, 201), scene_resp.text
    scene_id = scene_resp.json()["id"]

    # Seed a draft via API
    await client.put(
        f"/api/stories/{story_id}/scenes/{scene_id}/draft",
        headers=auth_headers,
        json={"content": "old\n"},
    )

    # Create a thread via API
    create_resp = await client.post(
        f"/api/stories/{story_id}/chat/threads", headers=auth_headers, json={}
    )
    assert create_resp.status_code in (200, 201), create_resp.text
    thread_id = create_resp.json()["id"]

    # Seed a proposed message directly via the shared db_session (same session the app uses)
    import uuid as _uuid
    thread = await chat_service.get_thread(db_session, _uuid.UUID(thread_id))
    msg = await chat_service.persist_message(
        db_session,
        org_id=thread.org_id,
        thread_id=thread.id,
        role=ChatMessageRole.assistant,
        content="editing it",
        tool_calls=[{"id": "t1", "name": "edit_scene_draft",
                     "arguments": {"scene_id": scene_id, "new_text": "new\n"}}],
        tool_call_status=ToolCallStatus.proposed,
        tool_call_result={"diff": "stub"},
    )
    msg_id = msg.id

    resp = await client.post(
        f"/api/chat/tool_calls/{msg_id}/apply",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["applied"] is True


@pytest.mark.asyncio
async def test_reject_tool_call_endpoint(
    client, auth_headers, db_session
):
    from app.services import chat_service
    from app.models.chat_message import ChatMessageRole, ToolCallStatus

    story_id = await _make_story(client, auth_headers)
    create_resp = await client.post(
        f"/api/stories/{story_id}/chat/threads", headers=auth_headers, json={}
    )
    thread_id = create_resp.json()["id"]

    import uuid as _uuid
    thread = await chat_service.get_thread(db_session, _uuid.UUID(thread_id))
    msg = await chat_service.persist_message(
        db_session,
        org_id=thread.org_id,
        thread_id=thread.id,
        role=ChatMessageRole.assistant,
        content="proposing something",
        tool_calls=[{"id": "t2", "name": "edit_scene_draft", "arguments": {}}],
        tool_call_status=ToolCallStatus.proposed,
        tool_call_result={},
    )

    resp = await client.post(
        f"/api/chat/tool_calls/{msg.id}/reject",
        headers=auth_headers,
        json={"reason": "not what I wanted"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["rejected"] is True


@pytest.mark.asyncio
async def test_apply_tool_call_409_for_non_proposed(
    client, auth_headers, db_session
):
    from app.services import chat_service
    from app.models.chat_message import ChatMessageRole

    story_id = await _make_story(client, auth_headers)
    create_resp = await client.post(
        f"/api/stories/{story_id}/chat/threads", headers=auth_headers, json={}
    )
    thread_id = create_resp.json()["id"]

    import uuid as _uuid
    thread = await chat_service.get_thread(db_session, _uuid.UUID(thread_id))
    msg = await chat_service.persist_message(
        db_session,
        org_id=thread.org_id,
        thread_id=thread.id,
        role=ChatMessageRole.assistant,
        content="just text, no tool call",
    )

    resp = await client.post(
        f"/api/chat/tool_calls/{msg.id}/apply",
        headers=auth_headers,
    )
    assert resp.status_code == 409, resp.text
