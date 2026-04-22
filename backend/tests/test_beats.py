import uuid

import pytest


async def setup_scene(client) -> tuple[str, str, str]:
    """Create user + story + scene, return (token, story_id, scene_id)."""
    suffix = uuid.uuid4().hex[:8]
    signup = await client.post(
        "/auth/signup",
        json={
            "name": "Writer",
            "email": f"beats-{suffix}@example.com",
            "password": "pass1234",
        },
    )
    token = signup.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    story = await client.post(
        "/api/stories", json={"title": "Beat Story"}, headers=headers
    )
    scene = await client.post(
        f"/api/stories/{story.json()['id']}/scenes",
        json={"title": "Opening", "pov": "Iris"},
        headers=headers,
    )
    return token, story.json()["id"], scene.json()["id"]


@pytest.mark.asyncio
async def test_create_beat_auto_increments_n(client):
    token, story_id, scene_id = await setup_scene(client)
    headers = {"Authorization": f"Bearer {token}"}
    base = f"/api/stories/{story_id}/scenes/{scene_id}/beats"

    b1 = await client.post(base, json={"title": "Setup", "kind": "setup"}, headers=headers)
    assert b1.status_code == 201
    assert b1.json()["n"] == 1
    assert b1.json()["kind"] == "setup"

    b2 = await client.post(base, json={"title": "Decision", "kind": "decision"}, headers=headers)
    assert b2.json()["n"] == 2


@pytest.mark.asyncio
async def test_list_beats_ordered_by_n(client):
    token, story_id, scene_id = await setup_scene(client)
    headers = {"Authorization": f"Bearer {token}"}
    base = f"/api/stories/{story_id}/scenes/{scene_id}/beats"

    await client.post(base, json={"title": "A"}, headers=headers)
    await client.post(base, json={"title": "B"}, headers=headers)
    await client.post(base, json={"title": "C"}, headers=headers)

    listed = await client.get(base, headers=headers)
    assert listed.status_code == 200
    items = listed.json()
    assert [b["title"] for b in items] == ["A", "B", "C"]
    assert [b["n"] for b in items] == [1, 2, 3]


@pytest.mark.asyncio
async def test_update_beat(client):
    token, story_id, scene_id = await setup_scene(client)
    headers = {"Authorization": f"Bearer {token}"}
    base = f"/api/stories/{story_id}/scenes/{scene_id}/beats"

    created = await client.post(base, json={"title": "Draft"}, headers=headers)
    beat_id = created.json()["id"]

    updated = await client.put(
        f"{base}/{beat_id}",
        json={"title": "Revised", "kind": "turn", "summary": "She turns on him."},
        headers=headers,
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["title"] == "Revised"
    assert body["kind"] == "turn"
    assert body["summary"] == "She turns on him."


@pytest.mark.asyncio
async def test_delete_beat(client):
    token, story_id, scene_id = await setup_scene(client)
    headers = {"Authorization": f"Bearer {token}"}
    base = f"/api/stories/{story_id}/scenes/{scene_id}/beats"

    created = await client.post(base, json={"title": "Gone"}, headers=headers)
    beat_id = created.json()["id"]

    deleted = await client.delete(f"{base}/{beat_id}", headers=headers)
    assert deleted.status_code == 204

    listed = await client.get(base, headers=headers)
    assert listed.json() == []


@pytest.mark.asyncio
async def test_beats_cascade_on_scene_delete(client):
    token, story_id, scene_id = await setup_scene(client)
    headers = {"Authorization": f"Bearer {token}"}
    base = f"/api/stories/{story_id}/scenes/{scene_id}/beats"

    await client.post(base, json={"title": "A"}, headers=headers)
    await client.post(base, json={"title": "B"}, headers=headers)

    # Delete the parent scene; beats should go with it via FK CASCADE.
    await client.delete(
        f"/api/stories/{story_id}/scenes/{scene_id}", headers=headers
    )

    # Listing against a deleted scene returns 404 via _require_scene.
    listed = await client.get(base, headers=headers)
    assert listed.status_code == 404


@pytest.mark.asyncio
async def test_beats_on_nonexistent_scene_returns_404(client):
    token, story_id, _ = await setup_scene(client)
    headers = {"Authorization": f"Bearer {token}"}
    fake_scene = uuid.uuid4()
    resp = await client.get(
        f"/api/stories/{story_id}/scenes/{fake_scene}/beats", headers=headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_reorder_beats(client):
    token, story_id, scene_id = await setup_scene(client)
    headers = {"Authorization": f"Bearer {token}"}
    base = f"/api/stories/{story_id}/scenes/{scene_id}/beats"

    a = (await client.post(base, json={"title": "A"}, headers=headers)).json()
    b = (await client.post(base, json={"title": "B"}, headers=headers)).json()
    c = (await client.post(base, json={"title": "C"}, headers=headers)).json()

    # Reverse: C, B, A → n = 1, 2, 3
    resp = await client.patch(
        f"{base}/reorder",
        json={"ordered_ids": [c["id"], b["id"], a["id"]]},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert [item["title"] for item in body] == ["C", "B", "A"]
    assert [item["n"] for item in body] == [1, 2, 3]


@pytest.mark.asyncio
async def test_reorder_beats_rejects_foreign_id(client):
    token, story_id, scene_id = await setup_scene(client)
    headers = {"Authorization": f"Bearer {token}"}
    base = f"/api/stories/{story_id}/scenes/{scene_id}/beats"
    await client.post(base, json={"title": "A"}, headers=headers)

    resp = await client.patch(
        f"{base}/reorder",
        json={"ordered_ids": [str(uuid.uuid4())]},
        headers=headers,
    )
    assert resp.status_code == 400
