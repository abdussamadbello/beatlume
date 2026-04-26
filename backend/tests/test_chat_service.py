import pytest

from app.services import chat_service


@pytest.mark.asyncio
async def test_create_thread_returns_unarchived_thread(db_session, sample_org, sample_story):
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    assert thread.archived_at is None
    assert thread.story_id == sample_story.id


@pytest.mark.asyncio
async def test_list_threads_excludes_archived_by_default(db_session, sample_org, sample_story):
    a = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    b = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    await chat_service.archive_thread(db_session, b.id)

    rows, total = await chat_service.list_threads(db_session, sample_story.id)
    ids = {t.id for t in rows}
    assert a.id in ids
    assert b.id not in ids
    assert total == 1


@pytest.mark.asyncio
async def test_archive_thread_sets_archived_at(db_session, sample_org, sample_story):
    t = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    await chat_service.archive_thread(db_session, t.id)
    await db_session.refresh(t)
    assert t.archived_at is not None
