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


from app.models.chat_message import ChatMessageRole, ToolCallStatus


@pytest.mark.asyncio
async def test_persist_user_message(db_session, sample_org, sample_story):
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    msg = await chat_service.persist_message(
        db_session,
        org_id=sample_org.id,
        thread_id=thread.id,
        role=ChatMessageRole.user,
        content="What does Marcus want?",
    )
    assert msg.role == ChatMessageRole.user
    assert msg.tool_calls is None


@pytest.mark.asyncio
async def test_list_messages_orders_chronologically(db_session, sample_org, sample_story):
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    a = await chat_service.persist_message(db_session, sample_org.id, thread.id, ChatMessageRole.user, content="first")
    b = await chat_service.persist_message(db_session, sample_org.id, thread.id, ChatMessageRole.assistant, content="second")
    rows, total = await chat_service.list_messages(db_session, thread.id)
    assert [r.id for r in rows] == [a.id, b.id]
    assert total == 2


@pytest.mark.asyncio
async def test_persist_proposed_tool_call(db_session, sample_org, sample_story):
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    msg = await chat_service.persist_message(
        db_session,
        org_id=sample_org.id,
        thread_id=thread.id,
        role=ChatMessageRole.assistant,
        content="Editing scene 1.",
        tool_calls=[{"name": "edit_scene_draft", "arguments": {"scene_id": "abc", "new_text": "x"}}],
        tool_call_status=ToolCallStatus.proposed,
        tool_call_result={"diff": "@@ -1 +1 @@\n-old\n+new"},
    )
    assert msg.tool_call_status == ToolCallStatus.proposed
    assert msg.tool_call_result["diff"].startswith("@@")
