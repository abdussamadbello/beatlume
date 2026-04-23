"""Tests for the summary LangGraph."""
import pytest
from app.ai.graphs.summary_graph import build_summary_graph
from app.ai.prompts import scene_summarization


@pytest.mark.asyncio
async def test_summary_graph_returns_result(mock_llm_for):
    """Summary graph produces a valid summary with mocked LLM."""
    mock_llm_for("scene_summarization")
    graph = build_summary_graph()
    result = await graph.ainvoke({
        "scene": {"n": 1, "title": "Opening", "pov": "Iris", "tension": 3, "act": 1, "location": "Garden"},
        "prose": "Iris walked through the garden, noticing the overgrown roses and the broken fountain.",
        "pov_character": None,
    })
    assert result["result"] is not None
    assert "summary" in result["result"]
    assert "beats" in result["result"]
    assert result.get("error") is None


@pytest.mark.asyncio
async def test_summary_graph_handles_llm_error():
    """Summary graph captures LLM errors without crashing."""
    from unittest.mock import AsyncMock, patch

    async def failing_acompletion(*args, **kwargs):
        raise Exception("Timeout")

    with patch("app.ai.llm.acompletion", new_callable=AsyncMock, side_effect=failing_acompletion):
        graph = build_summary_graph()
        result = await graph.ainvoke({
            "scene": {"n": 1, "title": "Test", "pov": "", "tension": 0, "act": 1, "location": ""},
            "prose": "Some prose.",
            "pov_character": None,
        })
        assert result["error"] is not None


def test_summary_prompt_builds():
    """Summary prompt is built correctly from scene + prose."""
    messages = scene_summarization.build_prompt(
        {"n": 1, "title": "Opening", "pov": "Iris", "tension": 3, "act": 1, "location": "Garden"},
        "Iris walked through the garden...",
        None,
    )
    assert len(messages) == 2


def test_summary_validation_rejects_missing_summary():
    """Summary validation fails when summary key is missing."""
    invalid = '{"beats": ["beat1"]}'
    try:
        scene_summarization.validate_output(invalid)
        assert False, "Should have raised ValueError"
    except (ValueError, KeyError):
        pass
