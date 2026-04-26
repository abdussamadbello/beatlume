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
