"""Integration test: character analysis flow simulation."""
import pytest


@pytest.mark.asyncio
async def test_character_analysis_flow(client, auth_headers, mock_ai):
    """Complete character analysis flow from creation through AI inference."""
    story_resp = await client.post("/api/stories", json={
        "title": "Character Study",
        "genres": ["Drama"],
    }, headers=auth_headers)
    assert story_resp.status_code == 201
    story_id = story_resp.json()["id"]

    characters = [
        {"name": "Iris", "role": "Protagonist", "desire": "truth", "flaw": "distrust"},
        {"name": "Cole", "role": "Antagonist", "desire": "power", "flaw": "pride"},
        {"name": "Mae", "role": "Mentor", "desire": "help Iris", "flaw": "secrecy"},
        {"name": "Tom", "role": "Ally", "desire": "protect Iris", "flaw": "cowardice"},
    ]
    char_ids = []
    for char in characters:
        resp = await client.post(
            f"/api/stories/{story_id}/characters",
            json=char,
            headers=auth_headers,
        )
        assert resp.status_code == 201
        char_ids.append(resp.json()["id"])

    list_resp = await client.get(f"/api/stories/{story_id}/characters", headers=auth_headers)
    assert list_resp.json()["total"] == 4

    scene_resp = await client.post(
        f"/api/stories/{story_id}/scenes",
        json={"title": "Confrontation", "act": 2, "pov": "Iris", "tension": 8, "location": "House"},
        headers=auth_headers,
    )
    assert scene_resp.status_code == 201
    scene_id = scene_resp.json()["id"]

    rel_resp = await client.post(
        f"/api/stories/{story_id}/ai/relationships",
        headers=auth_headers,
    )
    assert rel_resp.status_code == 202
    assert "task_id" in rel_resp.json()

    insight_resp = await client.post(
        f"/api/stories/{story_id}/insights/generate",
        headers=auth_headers,
    )
    assert insight_resp.status_code == 202
    assert "task_id" in insight_resp.json()

    chars = await client.get(f"/api/stories/{story_id}/characters", headers=auth_headers)
    assert chars.json()["total"] == 4
    names = {c["name"] for c in chars.json()["items"]}
    assert names == {"Iris", "Cole", "Mae", "Tom"}


@pytest.mark.asyncio
async def test_character_crud_flow(client, auth_headers):
    """Basic character CRUD operations."""
    story_resp = await client.post("/api/stories", json={"title": "CRUD Test"}, headers=auth_headers)
    story_id = story_resp.json()["id"]

    char = await client.post(
        f"/api/stories/{story_id}/characters",
        json={"name": "Test Char", "role": "Supporting"},
        headers=auth_headers,
    )
    assert char.status_code == 201
    char_id = char.json()["id"]

    get_char = await client.get(f"/api/stories/{story_id}/characters/{char_id}", headers=auth_headers)
    assert get_char.status_code == 200
    assert get_char.json()["name"] == "Test Char"

    updated = await client.put(
        f"/api/stories/{story_id}/characters/{char_id}",
        json={"name": "Updated Char", "role": "Protagonist"},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Char"

    deleted = await client.delete(f"/api/stories/{story_id}/characters/{char_id}", headers=auth_headers)
    assert deleted.status_code == 204
