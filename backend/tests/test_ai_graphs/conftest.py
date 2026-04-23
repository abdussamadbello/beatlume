import litellm
"""Shared fixtures for AI graph unit tests."""
import json
import pytest
from unittest.mock import AsyncMock, patch


class MockLLMResponse:
    def __init__(self, content: str):
        self.choices = [type("Choice", (), {
            "message": type("Message", (), {"content": content})()
        })()]


GRAPH_RESPONSES = {
    "story_scaffolding": json.dumps({
        "title_suggestion": "Test Story",
        "genre": ["Literary"],
        "themes": ["Identity"],
        "acts": [
            {
                "act": 1,
                "label": "Setup",
                "scenes": [
                    {
                        "n": 1,
                        "title": "Opening",
                        "pov": "Iris",
                        "location": "Town",
                        "tension": 2,
                        "tag": "setup",
                        "summary": "Iris arrives in town.",
                    }
                ],
            }
        ],
        "characters": [],
        "relationships": [],
    }),
    "scene_summarization": json.dumps({
        "summary": "Iris finds the mysterious letter.",
        "beats": ["Opens drawer", "Finds envelope", "Reads first line"],
    }),
    "insight_generation": json.dumps([
        {
            "severity": "red",
            "category": "Pacing",
            "title": "Flat tension in act 1",
            "body": "Tension stays at 2/10 throughout.",
            "refs": ["S01"],
        }
    ]),
    "insight_synthesis": json.dumps([
        {
            "severity": "red",
            "category": "Character Arc",
            "title": "Iris needs stronger motivation",
            "body": "Her desire is unclear in early scenes.",
            "refs": ["S01", "S02"],
        }
    ]),
    "relationship_inference": json.dumps({
        "kind": "conflict",
        "weight": 0.8,
        "direction": "mutual",
        "reasoning": "Clear opposition over the boundary.",
        "changed": False,
    }),
    "prose_continuation": "The wind shifted as Iris stepped onto the porch, her eyes fixed on the horizon where the storm clouds gathered like an army.",
}


@pytest.fixture
def mock_llm():
    """Mock LiteLLM to return a default valid response.

    For task-specific responses, use mock_llm_for_graph with set_response().
    """
    async def fake_acompletion(model, messages, **kwargs):
        return MockLLMResponse(GRAPH_RESPONSES["story_scaffolding"])

    with patch("litellm.acompletion", new_callable=AsyncMock, side_effect=fake_acompletion) as mock:
        yield mock


@pytest.fixture
def mock_llm_for():
    """Factory fixture: returns a mock pre-configured for a specific task type.

    Usage:
        async def test_something(mock_llm_for):
            mock = mock_llm_for("scene_summarization")
            # mock is now patched with the scene_summarization response
    """
    mocks = []

    def _make(task_type: str):
        response = MockLLMResponse(GRAPH_RESPONSES.get(task_type, "Response."))

        async def fake_acompletion(**kwargs):
            return response

        m = AsyncMock(side_effect=fake_acompletion)
        patcher = patch("litellm.acompletion", new=m)
        patcher.start()
        mocks.append(patcher)
        return m

    yield _make

    for p in mocks:
        p.stop()


@pytest.fixture
def mock_llm_for_graph():
    response = MockLLMResponse("default")

    async def fake_acompletion(**kwargs):
        return response

    async def set_response(content: str):
        nonlocal response
        response = MockLLMResponse(content)

    mock = AsyncMock(side_effect=fake_acompletion)
    mock.set_response = set_response

    with patch("litellm.acompletion", new=mock):
        yield mock
