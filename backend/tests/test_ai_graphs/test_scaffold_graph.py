"""Tests for the scaffold LangGraph."""
import pytest
from app.ai.graphs.scaffold_graph import build_scaffold_graph
from app.ai.prompts import story_scaffolding


@pytest.mark.asyncio
async def test_scaffold_graph_returns_result(mock_llm):
    graph = build_scaffold_graph()
    result = await graph.ainvoke({
        "premise": "A woman returns to her hometown",
        "structure_type": "3-act",
        "target_words": 80000,
        "genres": ["Literary"],
        "characters": [],
    })
    assert result["result"] is not None
    assert "acts" in result["result"]
    assert result.get("error") is None


@pytest.mark.asyncio
async def test_scaffold_graph_handles_llm_error():
    from unittest.mock import AsyncMock, patch

    async def failing_acompletion(*args, **kwargs):
        raise Exception("LLM connection failed")

    with patch("app.ai.llm.acompletion", new_callable=AsyncMock, side_effect=failing_acompletion):
        graph = build_scaffold_graph()
        result = await graph.ainvoke({
            "premise": "Test premise",
            "structure_type": "3-act",
            "target_words": 50000,
            "genres": [],
            "characters": [],
        })
        assert result["error"] is not None
        assert "LLM connection failed" in result["error"]


def test_scaffold_prompt_builds():
    messages = story_scaffolding.build_prompt(
        "A woman returns to her hometown",
        "3-act",
        80000,
        ["Literary"],
        [{"name": "Iris", "role": "Protagonist"}],
    )
    assert len(messages) == 2
    assert "scaffold" in messages[0]["content"].lower()


def test_scaffold_validation_rejects_missing_acts():
    invalid = '{"title_suggestion": "Test", "genre": [], "themes": [], "characters": [], "relationships": []}'
    try:
        story_scaffolding.validate_output(invalid)
        assert False, "Should have raised ValueError for missing acts"
    except (ValueError, KeyError):
        pass
