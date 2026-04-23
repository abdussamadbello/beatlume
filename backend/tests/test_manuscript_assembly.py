import uuid

import pytest
from sqlalchemy import select

from app.models.scene import Scene
from app.models.story import Story
from app.models.user import Organization
from app.services import draft as draft_service
from app.services.manuscript_assembly import chapter_dicts_for_export, sync_manuscript_chapters_from_drafts


async def _org_story(db_session) -> tuple[uuid.UUID, uuid.UUID]:
    org = Organization(
        id=uuid.uuid4(),
        name="O",
        slug=f"msa-{uuid.uuid4().hex[:8]}",
    )
    db_session.add(org)
    await db_session.flush()
    story = Story(
        id=uuid.uuid4(),
        org_id=org.id,
        title="T",
        logline="",
        genres=[],
        target_words=5000,
        structure_type="3-act",
    )
    db_session.add(story)
    await db_session.flush()
    return org.id, story.id


@pytest.mark.asyncio
async def test_chapter_dicts_falls_back_to_drafts(db_session):
    org_id, story_id = await _org_story(db_session)
    s1 = Scene(
        id=uuid.uuid4(),
        story_id=story_id,
        org_id=org_id,
        n=1,
        title="A",
        pov="X",
        tension=5,
        act=1,
        location="",
        tag="",
    )
    db_session.add(s1)
    await db_session.flush()
    await draft_service.upsert_draft(db_session, story_id, s1.id, org_id, "Hello prose.")

    rows = await chapter_dicts_for_export(db_session, story_id)
    assert len(rows) == 1
    assert rows[0]["num"] == 1
    assert rows[0]["title"] == "A"
    assert "Hello" in rows[0]["content"]


@pytest.mark.asyncio
async def test_sync_creates_manuscript_rows(db_session):
    from app.models.manuscript import ManuscriptChapter

    org_id, story_id = await _org_story(db_session)
    s1 = Scene(
        id=uuid.uuid4(),
        story_id=story_id,
        org_id=org_id,
        n=1,
        title="A",
        pov="X",
        tension=5,
        act=1,
        location="",
        tag="",
    )
    db_session.add(s1)
    await db_session.flush()
    await draft_service.upsert_draft(db_session, story_id, s1.id, org_id, "Body text.")

    n = await sync_manuscript_chapters_from_drafts(db_session, story_id, org_id)
    assert n == 1

    r = await db_session.execute(
        select(ManuscriptChapter).where(ManuscriptChapter.story_id == story_id)
    )
    ch = r.scalar_one()
    assert ch.content == "Body text."
    assert ch.num == 1
