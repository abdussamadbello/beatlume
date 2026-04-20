import pytest


async def get_auth_token(client) -> str:
    resp = await client.post("/auth/signup", json={
        "name": "Writer", "email": "writer@example.com", "password": "pass1234",
    })
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_create_story(client):
    token = await get_auth_token(client)
    resp = await client.post(
        "/api/stories",
        json={"title": "My Novel", "genres": ["Literary", "Mystery"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "My Novel"
    assert data["genres"] == ["Literary", "Mystery"]
    assert data["status"] == "not_started"


@pytest.mark.asyncio
async def test_list_stories(client):
    token = await get_auth_token(client)
    await client.post("/api/stories", json={"title": "Story 1"}, headers={"Authorization": f"Bearer {token}"})
    await client.post("/api/stories", json={"title": "Story 2"}, headers={"Authorization": f"Bearer {token}"})
    resp = await client.get("/api/stories", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


@pytest.mark.asyncio
async def test_get_story(client):
    token = await get_auth_token(client)
    create = await client.post("/api/stories", json={"title": "My Novel"}, headers={"Authorization": f"Bearer {token}"})
    story_id = create.json()["id"]
    resp = await client.get(f"/api/stories/{story_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "My Novel"


@pytest.mark.asyncio
async def test_update_story(client):
    token = await get_auth_token(client)
    create = await client.post("/api/stories", json={"title": "Draft"}, headers={"Authorization": f"Bearer {token}"})
    story_id = create.json()["id"]
    resp = await client.put(f"/api/stories/{story_id}", json={"title": "Final"}, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Final"


@pytest.mark.asyncio
async def test_delete_story(client):
    token = await get_auth_token(client)
    create = await client.post("/api/stories", json={"title": "Doomed"}, headers={"Authorization": f"Bearer {token}"})
    story_id = create.json()["id"]
    resp = await client.delete(f"/api/stories/{story_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 204
    resp = await client.get(f"/api/stories/{story_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_stories_require_auth(client):
    resp = await client.get("/api/stories")
    assert resp.status_code == 401
