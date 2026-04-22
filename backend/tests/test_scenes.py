import pytest


async def setup_story(client) -> tuple[str, str]:
    """Create user + story, return (token, story_id)."""
    signup = await client.post("/auth/signup", json={
        "name": "Writer", "email": "scenes@example.com", "password": "pass1234",
    })
    token = signup.json()["access_token"]
    story = await client.post("/api/stories", json={"title": "Test Story"}, headers={"Authorization": f"Bearer {token}"})
    return token, story.json()["id"]


@pytest.mark.asyncio
async def test_create_scene(client):
    token, story_id = await setup_story(client)
    resp = await client.post(
        f"/api/stories/{story_id}/scenes",
        json={"title": "Opening", "pov": "Iris", "tension": 3, "act": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Opening"
    assert data["n"] == 1
    assert data["pov"] == "Iris"


@pytest.mark.asyncio
async def test_scene_auto_increment_n(client):
    token, story_id = await setup_story(client)
    headers = {"Authorization": f"Bearer {token}"}
    await client.post(f"/api/stories/{story_id}/scenes", json={"title": "S1"}, headers=headers)
    resp = await client.post(f"/api/stories/{story_id}/scenes", json={"title": "S2"}, headers=headers)
    assert resp.json()["n"] == 2


@pytest.mark.asyncio
async def test_list_scenes(client):
    token, story_id = await setup_story(client)
    headers = {"Authorization": f"Bearer {token}"}
    await client.post(f"/api/stories/{story_id}/scenes", json={"title": "S1", "act": 1}, headers=headers)
    await client.post(f"/api/stories/{story_id}/scenes", json={"title": "S2", "act": 2}, headers=headers)
    resp = await client.get(f"/api/stories/{story_id}/scenes", headers=headers)
    assert resp.json()["total"] == 2


@pytest.mark.asyncio
async def test_filter_scenes_by_act(client):
    token, story_id = await setup_story(client)
    headers = {"Authorization": f"Bearer {token}"}
    await client.post(f"/api/stories/{story_id}/scenes", json={"title": "S1", "act": 1}, headers=headers)
    await client.post(f"/api/stories/{story_id}/scenes", json={"title": "S2", "act": 2}, headers=headers)
    resp = await client.get(f"/api/stories/{story_id}/scenes?act=1", headers=headers)
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_update_scene(client):
    token, story_id = await setup_story(client)
    headers = {"Authorization": f"Bearer {token}"}
    create = await client.post(f"/api/stories/{story_id}/scenes", json={"title": "Draft"}, headers=headers)
    scene_id = create.json()["id"]
    resp = await client.put(f"/api/stories/{story_id}/scenes/{scene_id}", json={"title": "Revised", "tension": 8}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "Revised"
    assert resp.json()["tension"] == 8


@pytest.mark.asyncio
async def test_delete_scene(client):
    token, story_id = await setup_story(client)
    headers = {"Authorization": f"Bearer {token}"}
    create = await client.post(f"/api/stories/{story_id}/scenes", json={"title": "Gone"}, headers=headers)
    scene_id = create.json()["id"]
    resp = await client.delete(f"/api/stories/{story_id}/scenes/{scene_id}", headers=headers)
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_reorder_scenes(client):
    token, story_id = await setup_story(client)
    headers = {"Authorization": f"Bearer {token}"}

    a = (await client.post(f"/api/stories/{story_id}/scenes", json={"title": "A"}, headers=headers)).json()
    b = (await client.post(f"/api/stories/{story_id}/scenes", json={"title": "B"}, headers=headers)).json()
    c = (await client.post(f"/api/stories/{story_id}/scenes", json={"title": "C"}, headers=headers)).json()

    resp = await client.patch(
        f"/api/stories/{story_id}/scenes/reorder",
        json={"ordered_ids": [c["id"], a["id"], b["id"]]},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert [item["title"] for item in body] == ["C", "A", "B"]
    assert [item["n"] for item in body] == [1, 2, 3]
