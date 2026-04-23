"""Integration test: full writing flow simulation."""
import pytest


@pytest.mark.asyncio
async def test_full_writing_flow(client, auth_headers, mock_ai):
    """Complete writing flow from story creation through AI analysis."""
    story_resp = await client.post("/api/stories", json={
        "title": "My Novel",
        "logline": "A woman returns home.",
        "genres": ["Literary"],
    }, headers=auth_headers)
    assert story_resp.status_code == 201
    story_id = story_resp.json()["id"]

    scene_ids = []
    for title, act, pov in [("Opening", 1, "Iris"), ("Conflict", 2, "Iris"), ("Resolution", 3, "Iris")]:
        resp = await client.post(
            f"/api/stories/{story_id}/scenes",
            json={"title": title, "act": act, "pov": pov, "tension": 3, "location": "Town"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        scene_ids.append(resp.json()["id"])

    list_resp = await client.get(f"/api/stories/{story_id}/scenes", headers=auth_headers)
    assert list_resp.json()["total"] == 3

    first_scene_id = scene_ids[0]
    beat_resp = await client.post(
        f"/api/stories/{story_id}/scenes/{first_scene_id}/beats",
        json={"title": "Setup beat", "kind": "setup"},
        headers=auth_headers,
    )
    assert beat_resp.status_code == 201

    beats = await client.get(
        f"/api/stories/{story_id}/scenes/{first_scene_id}/beats",
        headers=auth_headers,
    )
    assert len(beats.json()) == 1

    scaffold_resp = await client.post(
        f"/api/stories/{story_id}/ai/scaffold",
        json={
            "premise": "A woman returns to her hometown",
            "structure_type": "3-act",
            "target_words": 80000,
            "genres": ["Literary"],
            "replace_existing": True,
        },
        headers=auth_headers,
    )
    assert scaffold_resp.status_code == 202
    assert "task_id" in scaffold_resp.json()

    summary_resp = await client.post(
        f"/api/stories/{story_id}/ai/summarize/{first_scene_id}",
        headers=auth_headers,
    )
    assert summary_resp.status_code == 202
    assert "task_id" in summary_resp.json()

    get_resp = await client.get(f"/api/stories/{story_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["title"] == "My Novel"


@pytest.mark.asyncio
async def test_full_writing_flow_requires_auth(client):
    """Unauthenticated requests to story endpoints return 401."""
    resp = await client.post("/api/stories", json={"title": "Test"})
    assert resp.status_code == 401
