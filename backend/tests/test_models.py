import uuid

from app.models import (
    Base, User, Organization, Membership, Story, Scene, Character,
    CharacterNode, CharacterEdge, Insight, DraftContent,
    CoreConfigNode, CoreSetting, ManuscriptChapter,
    Collaborator, Comment, ActivityEvent, ExportJob,
)
from app.models.user import PlanType, MembershipRole
from app.models.story import StoryStatus
from app.models.graph import EdgeKind, EdgeProvenance, NodeType
from app.models.insight import InsightSeverity
from app.models.core import CoreKind
from app.models.collaboration import CollaboratorRole, ExportFormat, ExportStatus


def test_all_tables_registered():
    table_names = sorted(Base.metadata.tables.keys())
    expected = sorted([
        "organizations", "users", "memberships", "stories", "scenes",
        "scene_participants", "beats",
        "characters", "character_nodes", "character_edges", "insights",
        "draft_contents", "core_config_nodes", "core_settings",
        "manuscript_chapters", "collaborators", "comments",
        "activity_events", "export_jobs",
        "chat_threads", "chat_messages",
    ])
    assert table_names == expected


def test_org_scoped_tables_have_org_id():
    org_scoped = [
        "stories", "scenes", "scene_participants", "beats", "characters",
        "character_nodes", "character_edges",
        "insights", "draft_contents", "core_config_nodes", "core_settings",
        "manuscript_chapters", "collaborators", "comments", "activity_events",
        "export_jobs",
    ]
    for table_name in org_scoped:
        table = Base.metadata.tables[table_name]
        column_names = [c.name for c in table.columns]
        assert "org_id" in column_names, f"{table_name} missing org_id"


def test_user_model_defaults():
    user = User(email="test@example.com", name="Test User")
    # Column-level defaults are applied at INSERT time, not on construction
    plan_col = Base.metadata.tables["users"].c.plan
    assert plan_col.default.arg == PlanType.free
    assert user.password_hash is None
    assert user.avatar_url is None
    assert user.oauth_provider is None


def test_story_model_defaults():
    stories_table = Base.metadata.tables["stories"]
    assert stories_table.c.status.default.arg == StoryStatus.not_started
    assert stories_table.c.draft_number.default.arg == 1
    assert stories_table.c.target_words.default.arg == 80000
    assert stories_table.c.structure_type.default.arg == "3-act"


def test_scene_model_fields():
    table = Base.metadata.tables["scenes"]
    column_names = [c.name for c in table.columns]
    required = ["id", "org_id", "story_id", "n", "title", "pov", "tension", "act", "location", "tag", "summary"]
    for col in required:
        assert col in column_names, f"Scene missing column: {col}"
    assert table.c.summary.nullable is False


def test_edge_kind_enum_values():
    assert set(EdgeKind) == {
        EdgeKind.conflict, EdgeKind.alliance, EdgeKind.romance,
        EdgeKind.mentor, EdgeKind.secret, EdgeKind.family,
    }


def test_edge_provenance_enum_values():
    assert set(EdgeProvenance) == {
        EdgeProvenance.author, EdgeProvenance.ai_accepted,
        EdgeProvenance.ai_pending, EdgeProvenance.scaffold,
    }


def test_insight_severity_enum_values():
    assert set(InsightSeverity) == {
        InsightSeverity.red, InsightSeverity.amber, InsightSeverity.blue,
    }


def test_export_format_enum_values():
    assert set(ExportFormat) == {
        ExportFormat.pdf, ExportFormat.docx, ExportFormat.epub, ExportFormat.plaintext,
    }


def test_unique_constraints():
    scene_table = Base.metadata.tables["scenes"]
    constraint_names = [c.name for c in scene_table.constraints if hasattr(c, "name") and c.name]
    assert "uq_scene_number" in constraint_names

    edge_table = Base.metadata.tables["character_edges"]
    constraint_names = [c.name for c in edge_table.constraints if hasattr(c, "name") and c.name]
    assert "uq_edge" in constraint_names

    setting_table = Base.metadata.tables["core_settings"]
    index_names = {ix.name for ix in setting_table.indexes}
    assert "uq_core_setting_story_key_null_node" in index_names
    assert "uq_core_setting_story_node_key" in index_names


import uuid
from datetime import datetime

import pytest
from sqlalchemy import select

from app.models.chat_thread import ChatThread
from app.models.chat_message import ChatMessage, ChatMessageRole, ToolCallStatus


@pytest.mark.asyncio
@pytest.mark.skip(reason="enabled in Task 2 once migration runs")
async def test_chat_thread_persists(db_session, sample_org, sample_story):
    thread = ChatThread(
        org_id=sample_org.id,
        story_id=sample_story.id,
        title=None,
    )
    db_session.add(thread)
    await db_session.commit()
    await db_session.refresh(thread)

    assert isinstance(thread.id, uuid.UUID)
    assert thread.archived_at is None
    assert isinstance(thread.created_at, datetime)
    assert isinstance(thread.updated_at, datetime)


@pytest.mark.asyncio
@pytest.mark.skip(reason="enabled in Task 2 once migration runs")
async def test_chat_message_persists_with_tool_call(db_session, sample_org, sample_story):
    thread = ChatThread(org_id=sample_org.id, story_id=sample_story.id)
    db_session.add(thread)
    await db_session.flush()

    msg = ChatMessage(
        org_id=sample_org.id,
        thread_id=thread.id,
        role=ChatMessageRole.assistant,
        content="I will edit scene 1.",
        tool_calls=[{"name": "edit_scene_draft", "arguments": {"scene_id": "x"}}],
        tool_call_status=ToolCallStatus.proposed,
        tool_call_result={"diff": "@@ -1 +1 @@\n-old\n+new"},
    )
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)

    assert msg.role == ChatMessageRole.assistant
    assert msg.tool_call_status == ToolCallStatus.proposed
    assert msg.tool_calls[0]["name"] == "edit_scene_draft"


@pytest.mark.asyncio
@pytest.mark.skip(reason="enabled in Task 2 once migration runs")
async def test_chat_thread_cascades_messages_on_delete(db_session, sample_org, sample_story):
    thread = ChatThread(org_id=sample_org.id, story_id=sample_story.id)
    db_session.add(thread)
    await db_session.flush()
    msg = ChatMessage(
        org_id=sample_org.id,
        thread_id=thread.id,
        role=ChatMessageRole.user,
        content="hello",
    )
    db_session.add(msg)
    await db_session.commit()

    await db_session.delete(thread)
    await db_session.commit()

    rows = (await db_session.execute(select(ChatMessage).where(ChatMessage.id == msg.id))).all()
    assert rows == []
