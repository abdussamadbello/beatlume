import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.insight import Insight


async def _setup_story(client) -> tuple[str, str]:
    suffix = uuid.uuid4().hex[:8]
    signup = await client.post(
        "/auth/signup",
        json={
            "name": "Author",
            "email": f"ins-{suffix}@example.com",
            "password": "pass1234",
        },
    )
    token = signup.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    story = await client.post(
        "/api/stories", json={"title": "Insight Story"}, headers=headers
    )
    return token, story.json()["id"]


async def _seed_insight(db_session: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID) -> uuid.UUID:
    insight = Insight(
        story_id=story_id,
        org_id=org_id,
        severity="amber",
        category="Pacing",
        title="Lull in act 2",
        body="Consider raising tension.",
        refs=[],
    )
    db_session.add(insight)
    await db_session.commit()
    await db_session.refresh(insight)
    return insight.id


@pytest.mark.asyncio
async def test_dismiss_then_restore(client, db_session):
    # Seed directly via the session fixture since insights aren't
    # currently created via any public API (they come from AI runs).
    token, story_id = await _setup_story(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch the story to learn its org_id.
    story_resp = await client.get(f"/api/stories/{story_id}", headers=headers)
    from app.models.story import Story
    from sqlalchemy import select
    row = (
        await db_session.execute(select(Story).where(Story.id == uuid.UUID(story_id)))
    ).scalar_one()
    insight_id = await _seed_insight(db_session, row.id, row.org_id)
    assert story_resp.status_code == 200

    # Default list: shows it.
    active = await client.get(f"/api/stories/{story_id}/insights", headers=headers)
    assert active.json()["total"] == 1

    # Dismiss.
    dis = await client.put(
        f"/api/stories/{story_id}/insights/{insight_id}/dismiss", headers=headers
    )
    assert dis.status_code == 200

    active_after = await client.get(f"/api/stories/{story_id}/insights", headers=headers)
    assert active_after.json()["total"] == 0

    dismissed_list = await client.get(
        f"/api/stories/{story_id}/insights?only_dismissed=true", headers=headers
    )
    assert dismissed_list.json()["total"] == 1
    assert dismissed_list.json()["items"][0]["dismissed"] is True

    # Restore.
    restored = await client.put(
        f"/api/stories/{story_id}/insights/{insight_id}/restore", headers=headers
    )
    assert restored.status_code == 200

    active_final = await client.get(f"/api/stories/{story_id}/insights", headers=headers)
    assert active_final.json()["total"] == 1
