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


@pytest.mark.asyncio
async def test_archive_story_hides_from_default_list(client):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    created = await client.post("/api/stories", json={"title": "Old Draft"}, headers=headers)
    story_id = created.json()["id"]

    # Default list shows unarchived; archiving should remove from it.
    assert created.json()["archived"] is False
    await client.put(f"/api/stories/{story_id}", json={"archived": True}, headers=headers)

    default_list = await client.get("/api/stories", headers=headers)
    assert default_list.json()["total"] == 0

    only_archived = await client.get("/api/stories?only_archived=true", headers=headers)
    assert only_archived.json()["total"] == 1
    assert only_archived.json()["items"][0]["archived"] is True

    all_list = await client.get("/api/stories?include_archived=true", headers=headers)
    assert all_list.json()["total"] == 1


@pytest.mark.asyncio
async def test_duplicate_story_copies_narrative_hierarchy(client):
    token = await get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    story = (await client.post(
        "/api/stories",
        json={"title": "Original", "logline": "A widow and an orchard."},
        headers=headers,
    )).json()
    story_id = story["id"]

    # Create a character, scene, beat. (Chapters have no POST endpoint
    # today — they're created via seeds only; chapter remap in duplicate
    # is exercised by the integration seed path, not this unit test.)
    character = (await client.post(
        f"/api/stories/{story_id}/characters",
        json={"name": "Iris", "role": "Protagonist"},
        headers=headers,
    )).json()
    scene = (await client.post(
        f"/api/stories/{story_id}/scenes",
        json={"title": "Opening", "pov": "Iris"},
        headers=headers,
    )).json()
    await client.post(
        f"/api/stories/{story_id}/scenes/{scene['id']}/beats",
        json={"title": "Setup beat", "kind": "setup"},
        headers=headers,
    )

    dup_resp = await client.post(
        f"/api/stories/{story_id}/duplicate", headers=headers
    )
    assert dup_resp.status_code == 201
    dup = dup_resp.json()
    assert dup["title"] == "Copy of Original"
    assert dup["logline"] == "A widow and an orchard."
    assert dup["id"] != story_id

    # Narrative hierarchy copied.
    dup_characters = await client.get(f"/api/stories/{dup['id']}/characters", headers=headers)
    assert dup_characters.json()["total"] == 1
    assert dup_characters.json()["items"][0]["name"] == "Iris"
    # Different character ID than the original.
    assert dup_characters.json()["items"][0]["id"] != character["id"]

    dup_scenes = await client.get(f"/api/stories/{dup['id']}/scenes", headers=headers)
    assert dup_scenes.json()["total"] == 1
    dup_scene = dup_scenes.json()["items"][0]
    assert dup_scene["title"] == "Opening"
    # Different scene ID than the original.
    assert dup_scene["id"] != scene["id"]

    # Beats came along too.
    dup_beats = await client.get(
        f"/api/stories/{dup['id']}/scenes/{dup_scene['id']}/beats",
        headers=headers,
    )
    assert len(dup_beats.json()) == 1
    assert dup_beats.json()[0]["title"] == "Setup beat"
