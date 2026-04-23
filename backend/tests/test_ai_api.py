import pytest


class StubAsyncResult:
    id = "mock-task-id"


class StubTask:
    def __init__(self):
        self.calls = []

    def delay(self, *args):
        self.calls.append(args)
        return StubAsyncResult()


async def setup_story_with_scene(client) -> tuple[str, str, str]:
    signup = await client.post(
        "/auth/signup",
        json={"name": "Writer", "email": "ai-api@example.com", "password": "pass1234"},
    )
    token = signup.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    story = await client.post("/api/stories", json={"title": "AI Story"}, headers=headers)
    story_id = story.json()["id"]
    scene = await client.post(
        f"/api/stories/{story_id}/scenes",
        json={"title": "Opening", "pov": "Iris", "tension": 4, "act": 1},
        headers=headers,
    )
    return token, story_id, scene.json()["id"]


@pytest.mark.asyncio
async def test_ai_trigger_endpoints_enqueue_tasks(client, monkeypatch):
    token, story_id, scene_id = await setup_story_with_scene(client)
    headers = {"Authorization": f"Bearer {token}"}

    import app.api.ai as ai_api

    tasks = {
        "generate_insights": StubTask(),
        "continue_prose": StubTask(),
        "infer_relationships": StubTask(),
        "summarize_scene": StubTask(),
        "scaffold_story": StubTask(),
        "generate_full_manuscript": StubTask(),
    }
    for name, task in tasks.items():
        monkeypatch.setattr(ai_api, name, task)

    responses = [
        await client.post(f"/api/stories/{story_id}/insights/generate", headers=headers),
        await client.post(f"/api/stories/{story_id}/draft/{scene_id}/ai-continue", headers=headers),
        await client.post(f"/api/stories/{story_id}/ai/relationships", headers=headers),
        await client.post(f"/api/stories/{story_id}/ai/summarize/{scene_id}", headers=headers),
        await client.post(
            f"/api/stories/{story_id}/ai/scaffold",
            json={
                "premise": "A lighthouse keeper finds a map in the fog.",
                "structure_type": "3-act",
                "target_words": 60000,
                "genres": ["Mystery"],
                "characters": [{"name": "Iris"}],
                "replace_existing": True,
            },
            headers=headers,
        ),
        await client.post(
            f"/api/stories/{story_id}/ai/generate-manuscript",
            json={"skip_non_empty": True, "max_scenes": None, "act": None},
            headers=headers,
        ),
    ]

    for response in responses:
        assert response.status_code == 202
        assert response.json() == {"task_id": "mock-task-id"}

    assert tasks["generate_insights"].calls[0][0] == story_id
    assert tasks["continue_prose"].calls[0][:2] == (story_id, scene_id)
    assert tasks["infer_relationships"].calls[0][0] == story_id
    assert tasks["summarize_scene"].calls[0][:2] == (story_id, scene_id)
    org_id = tasks["continue_prose"].calls[0][2]
    assert tasks["scaffold_story"].calls[0][:7] == (
        story_id,
        "A lighthouse keeper finds a map in the fog.",
        "3-act",
        60000,
        ["Mystery"],
        [{"name": "Iris"}],
        org_id,
    )
    assert tasks["scaffold_story"].calls[0][7] is True
    assert tasks["generate_full_manuscript"].calls[0] == (story_id, org_id, True, None, None, None)


@pytest.mark.asyncio
async def test_scaffold_409_when_scenes_exist(client, monkeypatch):
    monkeypatch.setattr("app.api.ai.scaffold_story", StubTask())
    token, story_id, _scene_id = await setup_story_with_scene(client)
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.post(
        f"/api/stories/{story_id}/ai/scaffold",
        json={
            "premise": "x",
            "structure_type": "3-act",
            "target_words": 1000,
            "genres": [],
            "characters": [],
            "replace_existing": False,
        },
        headers=headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_ai_trigger_endpoints_require_auth(client):
    resp = await client.post("/api/stories/00000000-0000-0000-0000-000000000000/ai/relationships")
    assert resp.status_code == 401
