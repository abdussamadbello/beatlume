import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt

from app.config import settings
from app.services.auth import ALGORITHM, create_access_token, create_sse_token


async def setup_story(client, email: str = "sse@example.com") -> tuple[str, str]:
    signup = await client.post(
        "/auth/signup",
        json={"name": "SSE User", "email": email, "password": "pass1234"},
    )
    token = signup.json()["access_token"]
    story = await client.post(
        "/api/stories",
        json={"title": "SSE Story"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return token, story.json()["id"]


class FakePubSub:
    async def subscribe(self, channel):
        self.channel = channel

    async def get_message(self, ignore_subscribe_messages=True, timeout=30):
        raise asyncio.CancelledError()

    async def unsubscribe(self):
        pass


class FakeRedis:
    def pubsub(self):
        return FakePubSub()

    async def aclose(self):
        pass


@pytest.mark.asyncio
async def test_create_sse_token_endpoint(client):
    access_token, story_id = await setup_story(client)

    resp = await client.post(
        f"/api/stories/{story_id}/events/token",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["expires_in"] == settings.sse_token_expire_seconds
    payload = jwt.decode(data["token"], settings.jwt_secret_key, algorithms=[ALGORITHM])
    assert payload["type"] == "sse"
    assert payload["story"] == story_id


@pytest.mark.asyncio
async def test_create_sse_token_requires_auth(client):
    resp = await client.post("/api/stories/00000000-0000-0000-0000-000000000000/events/token")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_sse_token_rejects_inaccessible_story(client):
    _, story_id = await setup_story(client, "owner@example.com")
    other_token, _ = await setup_story(client, "other@example.com")

    resp = await client.post(
        f"/api/stories/{story_id}/events/token",
        headers={"Authorization": f"Bearer {other_token}"},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_events_accepts_valid_sse_token(client, monkeypatch):
    access_token, story_id = await setup_story(client)
    payload = jwt.decode(access_token, settings.jwt_secret_key, algorithms=[ALGORITHM])
    sse_token = create_sse_token(
        uuid.UUID(payload["sub"]),
        uuid.UUID(payload["org"]),
        uuid.UUID(story_id),
    )

    import app.api.sse as sse_api

    monkeypatch.setattr(sse_api.aioredis, "from_url", lambda _: FakeRedis())

    async with client.stream("GET", f"/api/stories/{story_id}/events?sse_token={sse_token}") as resp:
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_events_rejects_access_token_query_param(client):
    access_token, story_id = await setup_story(client)

    resp = await client.get(f"/api/stories/{story_id}/events?token={access_token}")

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_events_rejects_invalid_sse_tokens(client):
    access_token, story_id = await setup_story(client)
    payload = jwt.decode(access_token, settings.jwt_secret_key, algorithms=[ALGORITHM])
    user_id = uuid.UUID(payload["sub"])
    org_id = uuid.UUID(payload["org"])
    wrong_story = uuid.uuid4()

    expired = jwt.encode(
        {
            "sub": str(user_id),
            "org": str(org_id),
            "story": story_id,
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
            "type": "sse",
        },
        settings.jwt_secret_key,
        algorithm=ALGORITHM,
    )
    wrong_type = create_access_token(user_id, org_id)
    wrong_story_token = create_sse_token(user_id, org_id, wrong_story)

    for token in [expired, wrong_type, wrong_story_token, "not-a-jwt"]:
        resp = await client.get(f"/api/stories/{story_id}/events?sse_token={token}")
        assert resp.status_code == 401
