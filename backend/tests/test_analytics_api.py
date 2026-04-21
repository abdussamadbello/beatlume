import uuid

import pytest


async def _new_story(client):
    suffix = uuid.uuid4().hex[:10]
    signup = await client.post(
        "/auth/signup",
        json={
            "name": "Writer",
            "email": f"analytics-{suffix}@example.com",
            "password": "pass1234",
        },
    )
    assert signup.status_code == 201, signup.text
    token = signup.json()["access_token"]
    story = await client.post(
        "/api/stories",
        json={"title": "Analytics Test Story"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert story.status_code == 201
    return token, story.json()["id"]


@pytest.mark.asyncio
async def test_tension_curve_endpoint_chart_contract(client):
    token, story_id = await _new_story(client)
    headers = {"Authorization": f"Bearer {token}"}
    tensions_pattern = [2, 3, 4, 5, 9, 5, 4, 3, 2, 3]
    for i, t in enumerate(tensions_pattern):
        act = 1 if i < 4 else 2 if i < 8 else 3
        await client.post(
            f"/api/stories/{story_id}/scenes",
            json={"title": f"S{i + 1}", "tension": t, "act": act},
            headers=headers,
        )

    resp = await client.get(
        f"/api/stories/{story_id}/analytics/tension-curve",
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"] == tensions_pattern
    assert len(body["acts"]) >= 1
    assert all("at" in a and "label" in a for a in body["acts"])
    assert body["acts"][0]["label"] == "Act I"
    assert any(a["label"] == "Act II" for a in body["acts"])
    assert len(body["peaks"]) >= 1
    for p in body["peaks"]:
        assert "at" in p and "v" in p and "label" in p
    assert "points" in body and len(body["points"]) > 0


@pytest.mark.asyncio
async def test_tension_curve_endpoint_empty_story(client):
    token, story_id = await _new_story(client)
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get(
        f"/api/stories/{story_id}/analytics/tension-curve",
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"] == []
    assert body["acts"] == []
    assert body["peaks"] == []
    assert body["points"] == []
