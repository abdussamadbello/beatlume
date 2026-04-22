import uuid

import pytest


async def setup_story(client) -> tuple[str, str, str]:
    """Create user + story, return (token, story_id, user_id)."""
    suffix = uuid.uuid4().hex[:8]
    signup = await client.post(
        "/auth/signup",
        json={
            "name": "Author",
            "email": f"collab-{suffix}@example.com",
            "password": "pass1234",
        },
    )
    token = signup.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    story = await client.post(
        "/api/stories", json={"title": "Collab Story"}, headers=headers
    )
    # Fetch own profile to learn user_id; there's no /me endpoint in
    # the test fixtures so infer it from a created comment.
    return token, story.json()["id"], ""


@pytest.mark.asyncio
async def test_update_own_comment(client):
    token, story_id, _ = await setup_story(client)
    headers = {"Authorization": f"Bearer {token}"}

    posted = await client.post(
        f"/api/stories/{story_id}/comments",
        json={"body": "First pass"},
        headers=headers,
    )
    assert posted.status_code == 201
    comment_id = posted.json()["id"]

    updated = await client.put(
        f"/api/stories/{story_id}/comments/{comment_id}",
        json={"body": "Revised"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["body"] == "Revised"


@pytest.mark.asyncio
async def test_delete_own_comment(client):
    token, story_id, _ = await setup_story(client)
    headers = {"Authorization": f"Bearer {token}"}

    posted = await client.post(
        f"/api/stories/{story_id}/comments",
        json={"body": "Goodbye"},
        headers=headers,
    )
    comment_id = posted.json()["id"]

    deleted = await client.delete(
        f"/api/stories/{story_id}/comments/{comment_id}",
        headers=headers,
    )
    assert deleted.status_code == 204

    # Re-fetch list; should be gone.
    listed = await client.get(
        f"/api/stories/{story_id}/comments", headers=headers
    )
    assert listed.status_code == 200
    assert all(c["id"] != comment_id for c in listed.json())


@pytest.mark.asyncio
async def test_cannot_edit_someone_elses_comment(client):
    # Author A posts a comment, Author B tries to edit it.
    token_a, story_id, _ = await setup_story(client)
    posted = await client.post(
        f"/api/stories/{story_id}/comments",
        json={"body": "Mine"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    comment_id = posted.json()["id"]

    # Author B is a different signup (new email).
    suffix = uuid.uuid4().hex[:8]
    signup_b = await client.post(
        "/auth/signup",
        json={
            "name": "Other",
            "email": f"b-{suffix}@example.com",
            "password": "pass1234",
        },
    )
    token_b = signup_b.json()["access_token"]

    # B can't see A's story via get_story (different org), so the
    # request returns 404 not 403. That's still "B can't touch it",
    # which is the invariant we care about.
    resp = await client.put(
        f"/api/stories/{story_id}/comments/{comment_id}",
        json={"body": "Hacked"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp.status_code in (403, 404)


@pytest.mark.asyncio
async def test_invite_nonexistent_user_returns_400(client):
    token, story_id, _ = await setup_story(client)
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.post(
        f"/api/stories/{story_id}/collaborators",
        json={"email": "nobody@example.com", "role": "reader"},
        headers=headers,
    )
    assert resp.status_code == 400
