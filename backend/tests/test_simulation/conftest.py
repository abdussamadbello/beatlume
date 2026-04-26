import litellm
"""Shared fixtures for simulation/integration tests."""
import json
import pytest
from unittest.mock import AsyncMock, patch


class MockLLMResponse:
    def __init__(self, content: str):
        self.choices = [type("Choice", (), {
            "message": type("Message", (), {"content": content})()
        })()]


AI_RESPONSES = {
    "story_scaffolding": json.dumps({
        "title_suggestion": "Simulated Story",
        "genre": ["Literary"],
        "themes": ["Identity"],
        "acts": [
            {"act": 1, "label": "Setup", "scenes": [
                {"n": 1, "title": "Opening", "pov": "Iris", "location": "Town", "tension": 2, "tag": "setup", "summary": "Iris arrives."}
            ]},
            {"act": 2, "label": "Confrontation", "scenes": [
                {"n": 2, "title": "Conflict", "pov": "Iris", "location": "House", "tension": 7, "tag": "turning_point", "summary": "Argument erupts."}
            ]},
            {"act": 3, "label": "Resolution", "scenes": [
                {"n": 3, "title": "Ending", "pov": "Iris", "location": "Garden", "tension": 4, "tag": "resolution", "summary": "Peace found."}
            ]},
        ],
        "characters": [],
        "relationships": [],
    }),
    "scene_summarization": json.dumps({
        "summary": "Iris discovers the letter and reads it.",
        "beats": ["Finds envelope", "Opens letter", "Reads message"],
    }),
    "insight_generation": json.dumps([
        {"severity": "red", "category": "Pacing", "title": "Slow start", "body": "Act 1 tension is low.", "refs": ["S01"]}
    ]),
    "insight_synthesis": json.dumps([
        {"severity": "red", "category": "Character", "title": "Motivation unclear", "body": "Iris needs clearer desire.", "refs": ["S01", "S02"]}
    ]),
    "relationship_inference": json.dumps({
        "kind": "conflict", "weight": 0.8, "direction": "mutual",
        "reasoning": "Opposing goals.", "changed": False,
    }),
    "prose_continuation": "The rain began to fall as Iris stepped outside, the cold drops a welcome relief from the heat of the argument.",
}


@pytest.fixture
async def story_id(client, auth_headers):
    resp = await client.post("/api/stories", json={
        "title": "Simulation Story",
        "genres": ["Literary"],
    }, headers=auth_headers)
    return resp.json()["id"]


@pytest.fixture
def mock_ai():
    def get_response_for_task(task_type: str) -> str:
        return AI_RESPONSES.get(task_type, "Response.")

    async def fake_acompletion(model, messages, **kwargs):
        for key in AI_RESPONSES:
            if key in str(model) or key in str(messages):
                return MockLLMResponse(AI_RESPONSES[key])
        return MockLLMResponse("Default AI response.")

    with patch("litellm.acompletion", new_callable=AsyncMock, side_effect=fake_acompletion):
        yield
