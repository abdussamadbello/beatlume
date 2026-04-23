"""Tests for the insight LangGraph."""
import pytest
from app.ai.graphs.insight_graph import build_insight_graph
from app.ai.prompts import insight_analysis, insight_synthesis


@pytest.mark.asyncio
async def test_insight_graph_returns_result(mock_llm_for):
    mock_llm_for("insight_generation")
    graph = build_insight_graph()
    result = await graph.ainvoke({
        "story_id": "test-story-id",
        "story_context": {"title": "Test Story", "genre": "Literary"},
        "act_contexts": {
            "1": {"story_skeleton": "Act 1 skeleton", "act_scenes": "Scene 1 | Opening | POV: Iris"},
        },
        "chunk_findings": [],
    })
    assert result["final_insights"] is not None
    assert len(result["final_insights"]) > 0
    assert result.get("error") is None


@pytest.mark.asyncio
async def test_insight_graph_handles_empty_findings():
    from unittest.mock import AsyncMock, patch

    async def failing_acompletion(*args, **kwargs):
        raise Exception("LLM failed")

    with patch("app.ai.llm.acompletion", new_callable=AsyncMock, side_effect=failing_acompletion):
        graph = build_insight_graph()
        result = await graph.ainvoke({
            "story_id": "test-story-id",
            "story_context": {"title": "Test"},
            "act_contexts": {"1": {"story_skeleton": "skeleton"}},
            "chunk_findings": [],
        })
        assert result.get("error") is not None or result.get("final_insights") is not None


def test_insight_analysis_prompt_builds():
    from app.ai.context.assembler import AssembledContext
    ctx = AssembledContext(sections={
        "story_skeleton": "Skeleton",
        "act_scenes": "Scene 1 | Title | POV: Iris | Tension: 3/10",
    })
    messages = insight_analysis.build_prompt(ctx, {"title": "Test", "genre": "Literary"}, 1)
    assert len(messages) == 2


def test_insight_synthesis_prompt_builds():
    findings = [[
        {"severity": "red", "category": "Pacing", "title": "Flat", "body": "Tension low", "refs": ["S01"]}
    ]]
    messages = insight_synthesis.build_prompt(findings, {"title": "Test"})
    assert len(messages) == 2
