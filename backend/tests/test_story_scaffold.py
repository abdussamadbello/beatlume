import uuid

import pytest
from sqlalchemy import select

from app.models.scene import Scene
from app.models.story import Story
from app.models.user import Organization
from app.services.story_scaffold import ScaffoldConflictError, apply_scaffold_to_story


FAKE_SCAFFOLD = {
    "acts": [
        {
            "act": 1,
            "label": "Act1",
            "scenes": [
                {
                    "n": 1,
                    "title": "Opening",
                    "pov": "Alice",
                    "location": "House",
                    "tension": 3,
                    "tag": "setup",
                    "summary": "It begins.",
                }
            ],
        }
    ],
    "characters": [
        {
            "name": "Alice",
            "role": "Protagonist",
            "desire": "Win",
            "flaw": "Pride",
            "arc": "Learns humility",
        }
    ],
    "relationships": [],
}


async def _setup_org_and_story(db_session) -> tuple[uuid.UUID, uuid.UUID]:
    org = Organization(
        id=uuid.uuid4(),
        name="O",
        slug=f"scaffold-{uuid.uuid4().hex[:8]}",
    )
    db_session.add(org)
    await db_session.flush()
    story = Story(
        id=uuid.uuid4(),
        org_id=org.id,
        title="T",
        logline="L",
        genres=[],
        target_words=1000,
        structure_type="3-act",
    )
    db_session.add(story)
    await db_session.flush()
    return org.id, story.id


@pytest.mark.asyncio
async def test_apply_scaffold_create_conflict_replace(db_session):
    """One session: create scenes, assert idempotency conflict, replace."""
    org_id, story_id = await _setup_org_and_story(db_session)

    n = await apply_scaffold_to_story(db_session, story_id, org_id, FAKE_SCAFFOLD, replace_existing=False)
    assert n == 1

    result = await db_session.execute(select(Scene).where(Scene.story_id == story_id).order_by(Scene.n))
    rows = list(result.scalars().all())
    assert len(rows) == 1
    assert rows[0].title == "Opening"
    assert rows[0].summary == "It begins."
    assert rows[0].pov == "Alice"
    assert rows[0].act == 1

    with pytest.raises(ScaffoldConflictError):
        await apply_scaffold_to_story(db_session, story_id, org_id, FAKE_SCAFFOLD, replace_existing=False)

    data2 = {
        "acts": [
            {
                "act": 1,
                "scenes": [
                    {
                        "n": 1,
                        "title": "Reboot",
                        "pov": "Bob",
                        "tension": 4,
                        "summary": "Again.",
                    }
                ],
            }
        ],
        "characters": [
            {"name": "Bob", "role": "Antagonist", "desire": "X", "flaw": "Y", "arc": "Z"},
        ],
    }
    n2 = await apply_scaffold_to_story(db_session, story_id, org_id, data2, replace_existing=True)
    assert n2 == 1
    result2 = await db_session.execute(select(Scene).where(Scene.story_id == story_id))
    rows2 = list(result2.scalars().all())
    assert len(rows2) == 1
    assert rows2[0].title == "Reboot"
    assert rows2[0].summary == "Again."
