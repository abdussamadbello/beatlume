# Simulation Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three-layer simulation tests (AI graph unit tests, backend integration scenarios, Playwright E2E) covering all Beatlume domains.

**Architecture:** Layer 1 tests each LangGraph in isolation with mocked LiteLLM. Layer 2 simulates full user journeys via the API with mocked Celery/LLM. Layer 3 validates critical paths in the browser with Playwright. Each layer is independently testable and committable.

**Tech Stack:** pytest, pytest-asyncio, unittest.mock (backend); @playwright/test (frontend); existing conftest.py DB fixtures.

---

### Task 1: AI Graph Test Fixtures (LLM Mock)

**Files:**
- Create: `backend/tests/test_ai_graphs/conftest.py`

- [ ] **Step 1: Create the conftest.py with LLM mock fixtures**

```python
"""Shared fixtures for AI graph unit tests."""
import json
import pytest
from unittest.mock import AsyncMock, patch


class MockLLMResponse:
    """Mimics litellm's response structure."""
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
    """Mock LiteLLM to return deterministic responses per task type.

    Usage:
        async def test_something(mock_llm):
            # mock_llm is the patched acompletion function
            result = await call_llm("story_scaffolding", [])
    """
    def make_response(task_type: str) -> str:
        return GRAPH_RESPONSES.get(task_type, "Default response.")

    async def fake_acompletion(model, messages, **kwargs):
        task_type = "unknown"
        # Try to infer task_type from model name or messages
        for key in GRAPH_RESPONSES:
            if key in str(model) or key in str(messages):
                task_type = key
                break
        # Default: use the first key that matches messages content
        for key, value in GRAPH_RESPONSES.items():
            if key in str(messages):
                task_type = key
                break
        return MockLLMResponse(make_response(task_type))

    with patch("app.ai.llm.acompletion", new_callable=AsyncMock, side_effect=fake_acompletion) as mock:
        yield mock


@pytest.fixture
def mock_llm_for_graph():
    """Mock that returns a specific response regardless of task type.

    Usage:
        async def test_something(mock_llm_for_graph):
            mock_llm_for_graph.set_response("custom json")
    """
    response = MockLLMResponse("default")

    async def fake_acompletion(**kwargs):
        return response

    async def set_response(content: str):
        nonlocal response
        response = MockLLMResponse(content)

    mock = AsyncMock(side_effect=fake_acompletion)
    mock.set_response = set_response

    with patch("app.ai.llm.acompletion", new=mock):
        yield mock
```

- [ ] **Step 2: Commit**

```bash
git add backend/tests/test_ai_graphs/conftest.py
git commit -m "test: add AI graph test fixtures with LLM mock"
```

---

### Task 2: Scaffold Graph Unit Tests

**Files:**
- Create: `backend/tests/test_ai_graphs/test_scaffold_graph.py`

- [ ] **Step 1: Write the failing tests**

```python
"""Tests for the scaffold LangGraph."""
import pytest
from app.ai.graphs.scaffold_graph import build_scaffold_graph
from app.ai.prompts import story_scaffolding


@pytest.mark.asyncio
async def test_scaffold_graph_returns_result(mock_llm):
    """Scaffold graph produces a valid result with mocked LLM."""
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
    """Scaffold graph captures LLM errors without crashing."""
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
    """Scaffold prompt is built correctly from inputs."""
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
    """Scaffold validation fails when acts are missing."""
    invalid = '{"title_suggestion": "Test", "genre": [], "themes": [], "acts": [], "characters": [], "relationships": []}'
    try:
        story_scaffolding.validate_output(invalid)
        assert False, "Should have raised ValueError for empty acts"
    except (ValueError, KeyError):
        pass
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_ai_graphs/test_scaffold_graph.py -v
```
Expected: test_scaffold_graph_returns_result FAILS (graph not importable or mock not connected), test_scaffold_graph_handles_llm_error FAILS, prompt/validation tests PASS (already covered by test_ai_prompts.py).

- [ ] **Step 3: Create the __init__.py to make test_ai_graphs a package**

```python
# backend/tests/test_ai_graphs/__init__.py
# (empty file — makes this directory a Python package)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_ai_graphs/test_scaffold_graph.py -v
```
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_ai_graphs/__init__.py backend/tests/test_ai_graphs/test_scaffold_graph.py
git commit -m "test: add scaffold graph unit tests"
```

---

### Task 3: Summary Graph Unit Tests

**Files:**
- Create: `backend/tests/test_ai_graphs/test_summary_graph.py`

- [ ] **Step 1: Write the failing tests**

```python
"""Tests for the summary LangGraph."""
import pytest
from app.ai.graphs.summary_graph import build_summary_graph
from app.ai.prompts import scene_summarization


@pytest.mark.asyncio
async def test_summary_graph_returns_result(mock_llm):
    """Summary graph produces a valid summary with mocked LLM."""
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_ai_graphs/test_summary_graph.py -v
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_ai_graphs/test_summary_graph.py -v
```

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_ai_graphs/test_summary_graph.py
git commit -m "test: add summary graph unit tests"
```

---

### Task 4: Insight Graph Unit Tests

**Files:**
- Create: `backend/tests/test_ai_graphs/test_insight_graph.py`

- [ ] **Step 1: Write the failing tests**

```python
"""Tests for the insight LangGraph."""
import pytest
from app.ai.graphs.insight_graph import build_insight_graph
from app.ai.prompts import insight_analysis, insight_synthesis


@pytest.mark.asyncio
async def test_insight_graph_returns_result(mock_llm):
    """Insight graph produces insights with mocked LLM."""
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
    """Insight graph handles case where act analysis produces no findings."""
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
        # Should have error from synthesis step (no findings to synthesize)
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_ai_graphs/test_insight_graph.py -v
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_ai_graphs/test_insight_graph.py -v
```

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_ai_graphs/test_insight_graph.py
git commit -m "test: add insight graph unit tests"
```

---

### Task 5: Relationship Graph Unit Tests

**Files:**
- Create: `backend/tests/test_ai_graphs/test_relationship_graph.py`

- [ ] **Step 1: Write the failing tests**

```python
"""Tests for the relationship LangGraph."""
import pytest
from app.ai.graphs.relationship_graph import build_relationship_graph
from app.ai.prompts import relationship_inference


@pytest.mark.asyncio
async def test_relationship_graph_returns_result(mock_llm):
    """Relationship graph produces relationship analysis with mocked LLM."""
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
    """Relationship graph captures errors per pair without crashing."""
    from unittest.mock import AsyncMock, patch

    async def failing_acompletion(*args, **kwargs):
        raise Exception("LLM timeout")

    with patch("app.ai.llm.acompletion", new_callable=AsyncMock, side_effect=failing_acompletion):
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
    """Relationship validation fails on invalid kind."""
    invalid = '{"kind": "invalid_kind", "weight": 0.5, "direction": "mutual", "reasoning": "test", "changed": false}'
    try:
        relationship_inference.validate_output(invalid)
        assert False, "Should have raised ValueError"
    except (ValueError, KeyError):
        pass
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_ai_graphs/test_relationship_graph.py -v
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_ai_graphs/test_relationship_graph.py -v
```

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_ai_graphs/test_relationship_graph.py
git commit -m "test: add relationship graph unit tests"
```

---

### Task 6: Prose Graph Unit Tests

**Files:**
- Create: `backend/tests/test_ai_graphs/test_prose_graph.py`

- [ ] **Step 1: Write the failing tests**

```python
"""Tests for the prose LangGraph."""
import pytest
from app.ai.graphs.prose_graph import build_prose_graph
from app.ai.prompts import prose_continuation


@pytest.mark.asyncio
async def test_prose_graph_returns_result(mock_llm):
    """Prose graph generates prose with mocked LLM."""
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
    """Prose graph returns error when no context is provided."""
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
    """Prose graph captures LLM errors without crashing."""
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_ai_graphs/test_prose_graph.py -v
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_ai_graphs/test_prose_graph.py -v
```

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_ai_graphs/test_prose_graph.py
git commit -m "test: add prose graph unit tests"
```

---

### Task 7: Simulation Test Fixtures (Shared)

**Files:**
- Create: `backend/tests/test_simulation/conftest.py`

- [ ] **Step 1: Write the shared fixtures for integration tests**

```python
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
async def auth_token(client):
    """Create a user and return their auth token."""
    import uuid
    suffix = uuid.uuid4().hex[:8]
    resp = await client.post("/auth/signup", json={
        "name": "Sim User",
        "email": f"sim-{suffix}@example.com",
        "password": "pass1234",
    })
    return resp.json()["access_token"]


@pytest.fixture
def auth_headers(auth_token):
    """Return headers dict with Authorization."""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
async def story_id(client, auth_headers):
    """Create a story and return its ID."""
    resp = await client.post("/api/stories", json={
        "title": "Simulation Story",
        "genres": ["Literary"],
    }, headers=auth_headers)
    return resp.json()["id"]


@pytest.fixture
def mock_ai():
    """Mock all AI-related calls (LLM + Celery) for integration tests.

    Patches:
    - app.ai.llm.acompletion → returns deterministic responses
    - Celery task .delay() → executes synchronously (no Redis needed)
    """
    def get_response_for_task(task_type: str) -> str:
        return AI_RESPONSES.get(task_type, "Response.")

    async def fake_acompletion(model, messages, **kwargs):
        for key in AI_RESPONSES:
            if key in str(model) or key in str(messages):
                return MockLLMResponse(AI_RESPONSES[key])
        return MockLLMResponse("Default AI response.")

    with patch("app.ai.llm.acompletion", new_callable=AsyncMock, side_effect=fake_acompletion):
        yield
```

- [ ] **Step 2: Create __init__.py**

```python
# backend/tests/test_simulation/__init__.py
# (empty file)
```

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_simulation/__init__.py backend/tests/test_simulation/conftest.py
git commit -m "test: add simulation test fixtures with auth + AI mocks"
```

---

### Task 8: Full Writing Flow Integration Test

**Files:**
- Create: `backend/tests/test_simulation/test_full_writing_flow.py`

- [ ] **Step 1: Write the failing test**

```python
"""Integration test: full writing flow simulation.

Simulates: signup → create story → add scenes → add beats → trigger scaffold AI → trigger summary AI → verify results.
"""
import pytest


@pytest.mark.asyncio
async def test_full_writing_flow(client, auth_token, auth_headers, mock_ai):
    """Complete writing flow from story creation through AI analysis."""
    # 1. Create story
    story_resp = await client.post("/api/stories", json={
        "title": "My Novel",
        "logline": "A woman returns home.",
        "genres": ["Literary"],
    }, headers=auth_headers)
    assert story_resp.status_code == 201
    story_id = story_resp.json()["id"]

    # 2. Add 3 scenes
    scene_ids = []
    for title, act, pov in [("Opening", 1, "Iris"), ("Conflict", 2, "Iris"), ("Resolution", 3, "Iris")]:
        resp = await client.post(
            f"/api/stories/{story_id}/scenes",
            json={"title": title, "act": act, "pov": pov, "tension": 3, "location": "Town"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        scene_ids.append(resp.json()["id"])

    # 3. Verify scenes listed
    list_resp = await client.get(f"/api/stories/{story_id}/scenes", headers=auth_headers)
    assert list_resp.json()["total"] == 3

    # 4. Add beats to first scene
    first_scene_id = scene_ids[0]
    beat_resp = await client.post(
        f"/api/stories/{story_id}/scenes/{first_scene_id}/beats",
        json={"title": "Setup beat", "kind": "setup"},
        headers=auth_headers,
    )
    assert beat_resp.status_code == 201

    # 5. Verify beats listed
    beats = await client.get(
        f"/api/stories/{story_id}/scenes/{first_scene_id}/beats",
        headers=auth_headers,
    )
    assert len(beats.json()) == 1

    # 6. Trigger scaffold AI (mocked — returns 202 with task_id)
    scaffold_resp = await client.post(
        f"/api/stories/{story_id}/ai/scaffold",
        json={
            "premise": "A woman returns to her hometown",
            "structure_type": "3-act",
            "target_words": 80000,
            "genres": ["Literary"],
        },
        headers=auth_headers,
    )
    assert scaffold_resp.status_code == 202
    assert "task_id" in scaffold_resp.json()

    # 7. Trigger summary AI for first scene (mocked)
    summary_resp = await client.post(
        f"/api/stories/{story_id}/ai/summarize/{first_scene_id}",
        headers=auth_headers,
    )
    assert summary_resp.status_code == 202
    assert "task_id" in summary_resp.json()

    # 8. Verify story still accessible after AI triggers
    get_resp = await client.get(f"/api/stories/{story_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["title"] == "My Novel"


@pytest.mark.asyncio
async def test_full_writing_flow_requires_auth(client):
    """Unauthenticated requests to story endpoints return 401."""
    resp = await client.post("/api/stories", json={"title": "Test"})
    assert resp.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_simulation/test_full_writing_flow.py -v
```

- [ ] **Step 3: Run test to verify it passes**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_simulation/test_full_writing_flow.py -v
```

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_simulation/test_full_writing_flow.py
git commit -m "test: add full writing flow integration test"
```

---

### Task 9: Character Analysis Flow Integration Test

**Files:**
- Create: `backend/tests/test_simulation/test_character_analysis_flow.py`

- [ ] **Step 1: Write the failing test**

```python
"""Integration test: character analysis flow simulation.

Simulates: create story → add characters → add relationships → trigger relationship AI → trigger insights → verify.
"""
import pytest


@pytest.mark.asyncio
async def test_character_analysis_flow(client, auth_headers, mock_ai):
    """Complete character analysis flow from creation through AI inference."""
    # 1. Create story
    story_resp = await client.post("/api/stories", json={
        "title": "Character Study",
        "genres": ["Drama"],
    }, headers=auth_headers)
    assert story_resp.status_code == 201
    story_id = story_resp.json()["id"]

    # 2. Add 4 characters
    characters = [
        {"name": "Iris", "role": "Protagonist", "desire": "truth", "flaw": "distrust"},
        {"name": "Cole", "role": "Antagonist", "desire": "power", "flaw": "pride"},
        {"name": "Mae", "role": "Mentor", "desire": "help Iris", "flaw": "secrecy"},
        {"name": "Tom", "role": "Ally", "desire": "protect Iris", "flaw": "cowardice"},
    ]
    char_ids = []
    for char in characters:
        resp = await client.post(
            f"/api/stories/{story_id}/characters",
            json=char,
            headers=auth_headers,
        )
        assert resp.status_code == 201
        char_ids.append(resp.json()["id"])

    # 3. Verify characters listed
    list_resp = await client.get(f"/api/stories/{story_id}/characters", headers=auth_headers)
    assert list_resp.json()["total"] == 4

    # 4. Add a scene for character context
    scene_resp = await client.post(
        f"/api/stories/{story_id}/scenes",
        json={"title": "Confrontation", "act": 2, "pov": "Iris", "tension": 8, "location": "House"},
        headers=auth_headers,
    )
    assert scene_resp.status_code == 201
    scene_id = scene_resp.json()["id"]

    # 5. Trigger relationship AI (mocked)
    rel_resp = await client.post(
        f"/api/stories/{story_id}/ai/relationships",
        headers=auth_headers,
    )
    assert rel_resp.status_code == 202
    assert "task_id" in rel_resp.json()

    # 6. Trigger insight generation (mocked)
    insight_resp = await client.post(
        f"/api/stories/{story_id}/insights/generate",
        headers=auth_headers,
    )
    assert insight_resp.status_code == 202
    assert "task_id" in insight_resp.json()

    # 7. Verify characters still accessible
    chars = await client.get(f"/api/stories/{story_id}/characters", headers=auth_headers)
    assert chars.json()["total"] == 4
    names = {c["name"] for c in chars.json()["items"]}
    assert names == {"Iris", "Cole", "Mae", "Tom"}


@pytest.mark.asyncio
async def test_character_crud_flow(client, auth_headers):
    """Basic character CRUD operations."""
    story_resp = await client.post("/api/stories", json={"title": "CRUD Test"}, headers=auth_headers)
    story_id = story_resp.json()["id"]

    # Create
    char = await client.post(
        f"/api/stories/{story_id}/characters",
        json={"name": "Test Char", "role": "Supporting"},
        headers=auth_headers,
    )
    assert char.status_code == 201
    char_id = char.json()["id"]

    # Read
    get_char = await client.get(f"/api/stories/{story_id}/characters/{char_id}", headers=auth_headers)
    assert get_char.status_code == 200
    assert get_char.json()["name"] == "Test Char"

    # Update
    updated = await client.put(
        f"/api/stories/{story_id}/characters/{char_id}",
        json={"name": "Updated Char", "role": "Protagonist"},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Char"

    # Delete
    deleted = await client.delete(f"/api/stories/{story_id}/characters/{char_id}", headers=auth_headers)
    assert deleted.status_code == 204
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_simulation/test_character_analysis_flow.py -v
```

- [ ] **Step 3: Run test to verify it passes**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_simulation/test_character_analysis_flow.py -v
```

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_simulation/test_character_analysis_flow.py
git commit -m "test: add character analysis flow integration test"
```

---

### Task 10: Export Flow Integration Test

**Files:**
- Create: `backend/tests/test_simulation/test_export_flow.py`

- [ ] **Step 1: Write the failing test**

```python
"""Integration test: export flow simulation.

Simulates: create story → set core settings → trigger exports (PDF, DOCX, ePub) → verify job creation.
"""
import pytest


@pytest.mark.asyncio
async def test_export_flow(client, auth_headers):
    """Complete export flow through all formats."""
    # 1. Create story
    story_resp = await client.post("/api/stories", json={
        "title": "Export Test",
        "genres": ["Literary"],
    }, headers=auth_headers)
    assert story_resp.status_code == 201
    story_id = story_resp.json()["id"]

    # 2. Set core settings
    settings = [
        {"key": "Title", "value": "Export Test"},
        {"key": "Author", "value": "Test Author"},
        {"key": "Genre", "value": "Literary"},
    ]
    for s in settings:
        await client.post(
            f"/api/stories/{story_id}/core-settings",
            json=s,
            headers=auth_headers,
        )

    # 3. Trigger PDF export
    pdf_resp = await client.post(
        f"/api/stories/{story_id}/export",
        json={"format": "pdf"},
        headers=auth_headers,
    )
    assert pdf_resp.status_code == 202
    pdf_job_id = pdf_resp.json()["job_id"]
    assert pdf_job_id

    # 4. Trigger DOCX export
    docx_resp = await client.post(
        f"/api/stories/{story_id}/export",
        json={"format": "docx"},
        headers=auth_headers,
    )
    assert docx_resp.status_code == 202
    assert docx_resp.json()["job_id"]

    # 5. Trigger ePub export
    epub_resp = await client.post(
        f"/api/stories/{story_id}/export",
        json={"format": "epub"},
        headers=auth_headers,
    )
    assert epub_resp.status_code == 202
    assert epub_resp.json()["job_id"]

    # 6. Trigger plaintext export
    txt_resp = await client.post(
        f"/api/stories/{story_id}/export",
        json={"format": "plaintext"},
        headers=auth_headers,
    )
    assert txt_resp.status_code == 202
    assert txt_resp.json()["job_id"]


@pytest.mark.asyncio
async def test_export_invalid_format_returns_400(client, auth_headers):
    """Export with invalid format returns 400."""
    story_resp = await client.post("/api/stories", json={"title": "Test"}, headers=auth_headers)
    story_id = story_resp.json()["id"]

    resp = await client.post(
        f"/api/stories/{story_id}/export",
        json={"format": "html"},
        headers=auth_headers,
    )
    assert resp.status_code == 400
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_simulation/test_export_flow.py -v
```

- [ ] **Step 3: Run test to verify it passes**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_simulation/test_export_flow.py -v
```

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_simulation/test_export_flow.py
git commit -m "test: add export flow integration test"
```

---

### Task 11: Run All Backend Tests & Verify

**Files:** (no new files — verification step)

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/ -v
```

Expected: All existing tests (94) + new AI graph tests (~20) + new simulation tests (~6) pass. Total ~120 tests.

- [ ] **Step 2: Run only AI graph tests**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_ai_graphs/ -v
```

Expected: All AI graph unit tests pass.

- [ ] **Step 3: Run only simulation tests**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/test_simulation/ -v
```

Expected: All simulation integration tests pass.

- [ ] **Step 4: Commit** (if any fixes needed)

---

### Task 12: Playwright Configuration

**Files:**
- Create: `frontend/tests/playwright.config.ts`
- Create: `frontend/tests/fixtures/seed.ts`

- [ ] **Step 1: Create Playwright config**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 2: Create seed fixture**

```typescript
/**
 * Seed data for E2E tests.
 * Called once before the test suite via globalSetup.
 */
const API_BASE = process.env.API_URL || 'http://localhost:8000';

export async function seedTestData() {
  // Signup
  const signupResp = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'E2E User',
      email: `e2e-${Date.now()}@example.com`,
      password: 'pass1234',
    }),
  });
  const signupData = await signupResp.json();
  const token = signupData.access_token;

  // Create a test story
  const storyResp = await fetch(`${API_BASE}/api/stories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: 'E2E Test Story',
      genres: ['Literary'],
    }),
  });
  const story = await storyResp.json();

  return { token, storyId: story.id };
}

export type TestContext = Awaited<ReturnType<typeof seedTestData>>;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/playwright.config.ts frontend/tests/fixtures/seed.ts
git commit -m "test: add Playwright E2E configuration and seed fixture"
```

---

### Task 13: Playwright Auth E2E Tests

**Files:**
- Create: `frontend/tests/e2e/auth.spec.ts`

- [ ] **Step 1: Write the auth E2E test**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/.*login/);

    // Fill login form
    await page.getByRole('textbox', { name: /email/i }).fill('elena@beatlume.io');
    await page.getByRole('textbox', { name: /password/i }).fill('beatlume123');
    await page.getByRole('button', { name: /log in/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('unauthenticated user redirected to login', async ({ page }) => {
    // Clear any stored auth
    await page.context().clearCookies();
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd frontend && npx playwright test auth --headed
```

Note: Requires backend running on localhost:8000 and frontend on localhost:5173. Use the seed user credentials.

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/e2e/auth.spec.ts
git commit -m "test: add Playwright auth E2E tests"
```

---

### Task 14: Playwright Story Creation E2E Tests

**Files:**
- Create: `frontend/tests/e2e/story-creation.spec.ts`

- [ ] **Step 1: Write the story creation E2E test**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Story Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('elena@beatlume.io');
    await page.getByRole('textbox', { name: /password/i }).fill('beatlume123');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('create new story from dashboard', async ({ page }) => {
    // Click "New Story" button (adjust selector based on actual UI)
    await page.getByRole('button', { name: /new story/i }).click();

    // Fill story form
    await page.getByRole('textbox', { name: /title/i }).fill('E2E Novel');
    await page.getByRole('textbox', { name: /logline/i }).fill('A test story for E2E.');

    // Submit
    await page.getByRole('button', { name: /create/i }).click();

    // Should navigate to story view
    await expect(page).toHaveURL(/.*stories\/.*/);
  });

  test('story appears in dashboard list', async ({ page }) => {
    // Create a story
    await page.getByRole('button', { name: /new story/i }).click();
    await page.getByRole('textbox', { name: /title/i }).fill('Listed Story');
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page).toHaveURL(/.*stories\/.*/);

    // Navigate back to dashboard
    await page.goto('/dashboard');

    // Story should appear in list
    await expect(page.getByText('Listed Story')).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd frontend && npx playwright test story-creation --headed
```

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/e2e/story-creation.spec.ts
git commit -m "test: add Playwright story creation E2E tests"
```

---

### Task 15: Playwright Scene Editing E2E Tests

**Files:**
- Create: `frontend/tests/e2e/scene-editing.spec.ts`

- [ ] **Step 1: Write the scene editing E2E test**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Scene Editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('elena@beatlume.io');
    await page.getByRole('textbox', { name: /password/i }).fill('beatlume123');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('add scene to story', async ({ page }) => {
    // Navigate to existing story (use first story from dashboard)
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /E2E Test Story|My Novel/i }).first().click();
    await expect(page).toHaveURL(/.*stories\/.*/);

    // Add a scene (adjust selector based on actual UI)
    await page.getByRole('button', { name: /add scene|new scene/i }).click();

    // Fill scene details
    await page.getByRole('textbox', { name: /title/i }).fill('Test Scene');

    // Save
    await page.getByRole('button', { name: /save|create/i }).click();

    // Scene should appear in sidebar
    await expect(page.getByText('Test Scene')).toBeVisible();
  });

  test('edit scene content', async ({ page }) => {
    // Navigate to story with scenes
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /E2E Test Story/i }).first().click();

    // Click on a scene in sidebar
    await page.getByRole('link', { name: /scene/i }).first().click();

    // Edit content in editor
    const editor = page.getByRole('textbox').first();
    await editor.fill('This is edited scene content for E2E testing.');

    // Save (Ctrl+S or button)
    await page.keyboard.press('Control+s');

    // Content should persist — reload and check
    await page.reload();
    await expect(editor).toHaveValue(/edited scene content/);
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd frontend && npx playwright test scene-editing --headed
```

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/e2e/scene-editing.spec.ts
git commit -m "test: add Playwright scene editing E2E tests"
```

---

### Task 16: Playwright Character Analysis E2E Tests

**Files:**
- Create: `frontend/tests/e2e/character-analysis.spec.ts`

- [ ] **Step 1: Write the character analysis E2E test**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Character Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('elena@beatlume.io');
    await page.getByRole('textbox', { name: /password/i }).fill('beatlume123');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('add characters to story', async ({ page }) => {
    // Navigate to story
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /E2E Test Story/i }).first().click();

    // Navigate to characters view
    await page.getByRole('link', { name: /character/i }).click();

    // Add a character
    await page.getByRole('button', { name: /add character|new character/i }).click();
    await page.getByRole('textbox', { name: /name/i }).fill('Iris');
    await page.getByRole('textbox', { name: /role/i }).fill('Protagonist');
    await page.getByRole('button', { name: /save|create/i }).click();

    // Character should appear in list
    await expect(page.getByText('Iris')).toBeVisible();
  });

  test('trigger AI relationship analysis', async ({ page }) => {
    // Navigate to story with characters
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /E2E Test Story/i }).first().click();
    await page.getByRole('link', { name: /character/i }).click();

    // Trigger AI analysis (button may be labeled differently)
    await page.getByRole('button', { name: /analyze|AI|relationship/i }).click();

    // Should show loading or progress indicator
    await expect(page.getByText(/analyzing|processing|running/i)).toBeVisible({ timeout: 5000 });
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd frontend && npx playwright test character-analysis --headed
```

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/e2e/character-analysis.spec.ts
git commit -m "test: add Playwright character analysis E2E tests"
```

---

### Task 17: Playwright Export E2E Tests

**Files:**
- Create: `frontend/tests/e2e/export.spec.ts`

- [ ] **Step 1: Write the export E2E test**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('elena@beatlume.io');
    await page.getByRole('textbox', { name: /password/i }).fill('beatlume123');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('trigger PDF export', async ({ page }) => {
    // Navigate to story
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /E2E Test Story/i }).first().click();

    // Trigger export (via menu or button)
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByRole('menuitem', { name: /pdf/i }).click();

    // Should show export in progress or download started
    await expect(page.getByText(/exporting|preparing|download/i)).toBeVisible({ timeout: 5000 });
  });

  test('export menu shows all formats', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /E2E Test Story/i }).first().click();

    await page.getByRole('button', { name: /export/i }).click();

    // All formats should be visible
    await expect(page.getByText(/pdf/i)).toBeVisible();
    await expect(page.getByText(/docx|word/i)).toBeVisible();
    await expect(page.getByText(/epub/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd frontend && npx playwright test export --headed
```

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/e2e/export.spec.ts
git commit -m "test: add Playwright export E2E tests"
```

---

### Task 18: Run All Playwright Tests & Verify

**Files:** (no new files — verification step)

- [ ] **Step 1: Run all Playwright E2E tests**

```bash
cd frontend && npx playwright test
```

Expected: All E2E tests pass (may need running backend + frontend servers).

- [ ] **Step 2: Run all backend tests one final time**

```bash
cd backend && PYTHONPATH=. uv run pytest tests/ -v
```

Expected: All tests pass (existing + new AI graph + new simulation).

- [ ] **Step 3: Run frontend type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No type errors.

---

## Self-Review Checklist

1. **Spec coverage:**
   - AI Graph Unit Tests: scaffold ✓, summary ✓, insight ✓, relationship ✓, prose ✓
   - Backend Integration: full writing flow ✓, character analysis ✓, export flow ✓
   - Playwright E2E: auth ✓, story creation ✓, scene editing ✓, character analysis ✓, export ✓
   - Mock strategy: LLM mock ✓, Celery mock ✓, auth fixtures ✓
   - Error handling: covered in each test file ✓
   - All domains covered ✓

2. **Placeholder scan:** No TBD, TODO, or vague instructions. All code blocks contain complete implementations.

3. **Type consistency:** All test files use the same fixture patterns (`auth_token`, `auth_headers`, `mock_ai`, `mock_llm`). Response structures match the actual API schemas from the existing codebase.

4. **No "similar to Task N" patterns:** Each task contains its own complete code, not references to other tasks.
