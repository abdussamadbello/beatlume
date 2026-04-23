import litellm
"""Tests for the relationship LangGraph."""
import pytest
from app.ai.graphs.relationship_graph import build_relationship_graph
from app.ai.prompts import relationship_inference


@pytest.mark.asyncio
async def test_relationship_graph_returns_result(mock_llm_for):
    mock_llm_for("relationship_inference")
    graph = build_relationship_graph()
    result = await graph.ainvoke({
        "pairs": [
            {
                "char_a": {"name": "Iris", "role": "Protagonist", "desire": "truth", "flaw": "distrust"},
                "char_b": {"name": "Cole", "role": "Antagonist", "desire": "power", "flaw": "pride"},
                "shared_scenes": [{"n": 3}],
                "prose_excerpts": ["They argued about the boundary."],
                "existing_edge": None,
            }
        ],
        "results": [],
    })
    assert len(result["results"]) == 1
    assert result["results"][0]["char_a"] == "Iris"
    assert result["results"][0]["char_b"] == "Cole"
    assert result.get("error") is None


@pytest.mark.asyncio
async def test_relationship_graph_handles_llm_error():
    from unittest.mock import AsyncMock, patch

    async def failing_acompletion(*args, **kwargs):
        raise Exception("LLM timeout")

    with patch("litellm.acompletion", new_callable=AsyncMock, side_effect=failing_acompletion):
        graph = build_relationship_graph()
        result = await graph.ainvoke({
            "pairs": [
                {
                    "char_a": {"name": "Iris", "role": "Protagonist"},
                    "char_b": {"name": "Cole", "role": "Antagonist"},
                    "shared_scenes": [],
                    "prose_excerpts": [],
                    "existing_edge": None,
                }
            ],
            "results": [],
        })
        assert len(result["results"]) == 1
        assert result["results"][0]["error"] is not None


def test_relationship_prompt_builds():
    messages = relationship_inference.build_prompt(
        {"name": "Iris", "role": "Protagonist", "desire": "truth", "flaw": "distrust"},
        {"name": "Cole", "role": "Antagonist", "desire": "power", "flaw": "pride"},
        [{"n": 3}],
        ["They argued."],
        None,
    )
    assert len(messages) == 2


def test_relationship_validation_rejects_bad_kind():
    invalid = '{"kind": "invalid_kind", "weight": 0.5, "direction": "mutual", "reasoning": "test", "changed": false}'
    try:
        relationship_inference.validate_output(invalid)
        assert False, "Should have raised ValueError"
    except (ValueError, KeyError):
        pass
