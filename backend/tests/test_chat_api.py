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
