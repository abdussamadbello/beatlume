"""Tests for the prose LangGraph."""
import pytest
from app.ai.graphs.prose_graph import build_prose_graph
from app.ai.prompts import prose_continuation


@pytest.mark.asyncio
async def test_prose_graph_returns_result(mock_llm_for):
    mock_llm_for("prose_continuation")
    graph = build_prose_graph()
    result = await graph.ainvoke({
        "story_id": "test-story-id",
        "scene_id": "test-scene-id",
        "scene_n": 1,
        "pov": "Iris",
        "scene": {"n": 1, "title": "Opening", "pov": "Iris", "tension": 3, "act": 1, "location": "Garden"},
        "story_context": {"genre": "Literary", "tense": "past", "tone": "literary"},
        "pov_character": {"name": "Iris", "role": "Protagonist", "desire": "truth", "flaw": "distrust"},
        "context": {"story_skeleton": "skeleton", "prior_scene_prose": "prior text"},
    })
    assert result["result"] is not None
    assert len(result["result"]) > 0
    assert result.get("error") is None


@pytest.mark.asyncio
async def test_prose_graph_errors_without_context():
    graph = build_prose_graph()
    result = await graph.ainvoke({
        "story_id": "test-story-id",
        "scene_id": "test-scene-id",
        "scene_n": 1,
        "pov": "Iris",
        "scene": {"n": 1, "title": "Opening", "pov": "Iris", "tension": 3, "act": 1, "location": ""},
        "story_context": {"genre": "Literary", "tense": "past", "tone": "literary"},
        "pov_character": None,
        "context": None,
    })
    assert result.get("error") is not None


@pytest.mark.asyncio
async def test_prose_graph_handles_llm_error():
    from unittest.mock import AsyncMock, patch

    async def failing_acompletion(*args, **kwargs):
        raise Exception("LLM unavailable")

    with patch("app.ai.llm.acompletion", new_callable=AsyncMock, side_effect=failing_acompletion):
        graph = build_prose_graph()
        result = await graph.ainvoke({
            "story_id": "test-story-id",
            "scene_id": "test-scene-id",
            "scene_n": 1,
            "pov": "Iris",
            "scene": {"n": 1, "title": "Opening", "pov": "Iris", "tension": 3, "act": 1, "location": ""},
            "story_context": {"genre": "Literary", "tense": "past", "tone": "literary"},
            "pov_character": None,
            "context": {"story_skeleton": "skeleton"},
        })
        assert result.get("error") is not None


def test_prose_prompt_builds():
    from app.ai.context.assembler import AssembledContext
    ctx = AssembledContext(sections={
        "story_skeleton": "Test skeleton",
        "prior_scene_prose": "Prior prose...",
        "current_scene_prose": "Current prose...",
    })
    scene = {"n": 3, "title": "The Letter", "pov": "Iris", "tension": 6, "act": 1, "location": "Kitchen"}
    story_ctx = {"genre": "Literary", "tense": "past", "tone": "literary"}
    pov = {"name": "Iris", "role": "Protagonist", "desire": "truth", "flaw": "distrust"}
    messages = prose_continuation.build_prompt(ctx, scene, story_ctx, pov)
    assert len(messages) == 2
    assert "ghostwriter" in messages[0]["content"].lower()
