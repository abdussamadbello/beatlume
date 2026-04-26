import pytest

from app.ai.tools.chat_tools import (
    READ_TOOLS,
    WRITE_TOOLS,
    READ_TOOL_IMPLS,
    tool_get_scene,
    tool_list_characters,
    tool_get_character,
    tool_get_scene_summaries,
    tool_find_inconsistencies,
)


def test_read_tools_registry_shape():
    names = {t["name"] for t in READ_TOOLS}
    assert {
        "get_scene",
        "list_characters",
        "get_character",
        "get_scene_summaries",
        "find_inconsistencies",
    } == names
    # Each tool spec must have a description and parameters object
    for t in READ_TOOLS:
        assert "description" in t and t["description"]
        assert t["parameters"]["type"] == "object"


def test_read_tool_impls_match_registry():
    assert {t["name"] for t in READ_TOOLS} == set(READ_TOOL_IMPLS.keys())


def test_write_tools_registry_is_present_but_will_be_populated_in_task_7():
    # Task 7 fills in 4 entries. For Task 6, the symbol must exist (so the agent
    # in Task 10 can import it). Empty list is acceptable here.
    assert isinstance(WRITE_TOOLS, list)


@pytest.mark.asyncio
async def test_tool_get_scene_returns_scene_dict(db_session, sample_story, sample_scene):
    result = await tool_get_scene(db_session, sample_story.id, scene_id=sample_scene.id)
    assert result["id"] == str(sample_scene.id)
    assert "draft" in result
    assert result["title"] == "Opening"


@pytest.mark.asyncio
async def test_tool_get_scene_invalid_id_returns_error(db_session, sample_story):
    import uuid as _u
    result = await tool_get_scene(db_session, sample_story.id, scene_id=_u.uuid4())
    assert "error" in result


@pytest.mark.asyncio
async def test_tool_list_characters(db_session, sample_story, sample_character):
    result = await tool_list_characters(db_session, sample_story.id)
    names = {c["name"] for c in result["characters"]}
    assert "Marcus" in names


@pytest.mark.asyncio
async def test_tool_get_character_includes_bio(db_session, sample_story, sample_character):
    result = await tool_get_character(db_session, sample_story.id, character_id=sample_character.id)
    assert result["name"] == "Marcus"
    # Maps to bio in this codebase (Character has no `notes` column)
    assert result["notes"] == "A reluctant hero."


@pytest.mark.asyncio
async def test_tool_get_scene_summaries_range(db_session, sample_story, sample_scene):
    result = await tool_get_scene_summaries(db_session, sample_story.id, start=1, end=5)
    assert "scenes" in result
    ns = [s["n"] for s in result["scenes"]]
    assert 1 in ns


@pytest.mark.asyncio
async def test_tool_find_inconsistencies_returns_insights_shape(db_session, sample_story):
    # Empty story has no insights — should return {"insights": []} not error.
    result = await tool_find_inconsistencies(db_session, sample_story.id)
    assert "insights" in result
    assert isinstance(result["insights"], list)


from app.ai.tools.chat_tools import (
    preview_edit_scene_draft,
    preview_propose_scene,
    preview_update_character_note,
    preview_summarize_scene,
)


@pytest.mark.asyncio
async def test_preview_edit_scene_draft_returns_unified_diff(db_session, sample_story, sample_scene):
    from app.services import draft as draft_service
    await draft_service.upsert_draft(db_session, sample_story.id, sample_scene.id, sample_scene.org_id, "Old text.\n")
    preview = await preview_edit_scene_draft(
        db_session, sample_story.id, scene_id=sample_scene.id, new_text="New text.\n"
    )
    assert preview["kind"] == "diff"
    assert "@@" in preview["diff"]
    assert "+New text." in preview["diff"]


@pytest.mark.asyncio
async def test_preview_propose_scene(db_session, sample_story):
    preview = await preview_propose_scene(
        db_session, sample_story.id,
        after_id=None, summary="A new opening scene.", scene_n=1, title="Opening",
    )
    assert preview["kind"] == "scene_proposal"
    assert preview["summary"] == "A new opening scene."


@pytest.mark.asyncio
async def test_preview_update_character_note_appends(db_session, sample_story, sample_character):
    preview = await preview_update_character_note(
        db_session, sample_story.id,
        character_id=sample_character.id, note_text="New observation.", append=True,
    )
    assert preview["kind"] == "character_note"
    assert preview["after"].endswith("New observation.")


def test_write_tools_registry_shape():
    from app.ai.tools.chat_tools import WRITE_TOOLS
    names = {t["name"] for t in WRITE_TOOLS}
    assert {
        "edit_scene_draft",
        "propose_scene",
        "update_character_note",
        "summarize_scene",
    } == names


def test_write_tool_dicts_match_registry():
    from app.ai.tools.chat_tools import WRITE_TOOLS, WRITE_TOOL_PREVIEWS, WRITE_TOOL_APPLIERS
    names = {t["name"] for t in WRITE_TOOLS}
    assert names == set(WRITE_TOOL_PREVIEWS.keys())
    assert names == set(WRITE_TOOL_APPLIERS.keys())
