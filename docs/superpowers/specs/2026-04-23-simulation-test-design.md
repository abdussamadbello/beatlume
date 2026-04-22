# Simulation Test Design — Beatlume

## Overview

Three-layer testing strategy covering all Beatlume domains: AI graph unit tests, backend integration scenarios, and Playwright E2E browser tests.

## Architecture

### Layer 1: AI Graph Unit Tests
- **Tool:** pytest + mocked LiteLLM
- **Location:** `backend/tests/test_ai_graphs/`
- **Purpose:** Test each LangGraph's prompt building, execution logic, and output validation in isolation
- **Graphs covered:** scaffold, summary, insight, relationship, prose

### Layer 2: Backend Integration Tests
- **Tool:** pytest + mocked Celery/LLM + existing conftest DB fixtures
- **Location:** `backend/tests/test_simulation/`
- **Purpose:** Simulate complete user journeys through the API across all domains
- **Scenarios:** full writing flow, character analysis flow, export flow

### Layer 3: Playwright E2E Tests
- **Tool:** @playwright/test + Playwright MCP for visual inspection
- **Location:** `frontend/tests/e2e/`
- **Purpose:** Validate critical user journeys in the browser with real UI selectors
- **Specs:** auth, story creation, scene editing, character analysis, export

## Directory Structure

```
backend/tests/
├── conftest.py                          # existing
├── test_ai_graphs/                      # NEW
│   ├── conftest.py                      # LLM mock fixtures
│   ├── test_scaffold_graph.py
│   ├── test_summary_graph.py
│   ├── test_insight_graph.py
│   ├── test_relationship_graph.py
│   └── test_prose_graph.py
└── test_simulation/                     # NEW
    ├── conftest.py                      # shared fixtures (mock LLM, mock Celery, auth)
    ├── test_full_writing_flow.py
    ├── test_character_analysis_flow.py
    └── test_export_flow.py

frontend/tests/                          # NEW
├── playwright.config.ts
├── fixtures/
│   └── seed.ts                          # API seed before E2E suite
└── e2e/
    ├── auth.spec.ts
    ├── story-creation.spec.ts
    ├── scene-editing.spec.ts
    ├── character-analysis.spec.ts
    └── export.spec.ts
```

## Test Scenarios

### AI Graph Unit Tests

| Graph | Inputs | Mocked LLM Response | Assertions |
|-------|--------|---------------------|------------|
| scaffold | story + scenes + beats | structured outline JSON | output matches schema, nodes created |
| summary | scene content | condensed text | output is shorter than input, preserves key elements |
| insight | character/scene context | insight objects with type + text | insights are non-empty, typed correctly |
| relationship | character list | nodes + edges JSON | graph is connected, edge weights valid |
| prose | beats + scene context | prose paragraph | output is coherent text, respects tone settings |

Each graph test also covers:
- Invalid inputs → ValidationError
- Missing context → appropriate error
- Malformed LLM response → caught and re-raised

### Backend Integration Scenarios

**test_full_writing_flow:**
1. POST /api/auth/login → get token
2. POST /api/stories → create story
3. POST /api/stories/{id}/scenes → add 3 scenes
4. POST /api/stories/{id}/scenes/{id}/beats → add beats to each scene
5. POST /api/ai/scaffold → trigger scaffold graph (mocked)
6. GET /api/stories/{id}/scenes → verify structure updated
7. POST /api/ai/summary → trigger summary (mocked)
8. GET /api/stories/{id}/scenes/{id} → verify summary stored

**test_character_analysis_flow:**
1. Auth + create story
2. POST /api/stories/{id}/characters → add 4 characters
3. POST /api/stories/{id}/characters/{id}/edges → add relationships
4. POST /api/ai/relationships → trigger relationship graph (mocked)
5. GET /api/stories/{id}/characters → verify character graph populated
6. POST /api/ai/insights → trigger insight generation (mocked)
7. GET /api/stories/{id}/insights → verify insights created

**test_export_flow:**
1. Auth + create story with scenes and content
2. POST /api/stories/{id}/core-settings → set tone, genre, POV
3. POST /api/ai/prose → trigger prose generation (mocked)
4. POST /api/export/pdf → export PDF, verify 202 + task_id
5. POST /api/export/docx → export DOCX, verify 202 + task_id
6. POST /api/export/epub → export ePub, verify 202 + task_id
7. GET /api/export-jobs → verify all completed

### Playwright E2E Scenarios

| Spec | Steps | Assertions |
|------|-------|------------|
| auth.spec.ts | Navigate to /login → enter credentials → submit | Redirected to /dashboard, user name visible |
| auth.spec.ts | Wait for token expiry → navigate | Auto-refresh or redirect to /login |
| story-creation.spec.ts | Dashboard → "New Story" → fill form → save | Story appears in list, clickable |
| scene-editing.spec.ts | Open story → add scene → edit content → save | Scene appears in sidebar, content persists |
| scene-editing.spec.ts | Reorder scenes via drag or controls | Order reflected in sidebar |
| character-analysis.spec.ts | Add characters → link → trigger AI | Results visible in character view |
| export.spec.ts | Trigger export from story menu | Download initiated, file received |

## Mock Strategy

### LLM Mock (Backend)
```python
@pytest.fixture
def mock_llm():
    responses = {
        "scaffold": {"structure": [...], "notes": "..."},
        "summary": "condensed scene text...",
        "insight": [{"type": "motivation", "text": "..."}],
        "relationship": {"nodes": [...], "edges": [...]},
        "prose": "generated prose paragraph..."
    }
    with patch("app.ai.llm.litellm.acompletion") as mock:
        mock.return_value = build_mock_response(responses)
        yield mock
```

### Celery Mock (Integration)
```python
@pytest.fixture
def mock_celery():
    with patch("app.tasks.ai_tasks.apply_async") as mock:
        # Execute task function directly, return result synchronously
        yield mock
```

### Playwright E2E Seed
Before the E2E suite:
1. POST /api/auth/login → store token in test config
2. POST /api/stories → create seed story, store storyId
3. Each test starts from known state, cleans up after itself

## Error Handling Validation

| Layer | What's tested |
|-------|---------------|
| AI Graph unit | Invalid prompts raise ValidationError, malformed LLM responses caught |
| Backend integration | API returns 400/409/422 with {detail, code}, RLS isolation (org A can't see org B) |
| Playwright E2E | UI shows error toast, page doesn't crash, user can recover |

## Execution Commands

```bash
# All backend tests
cd backend && PYTHONPATH=. uv run pytest tests/ -v

# Simulation tests only
cd backend && PYTHONPATH=. uv run pytest tests/test_simulation/ -v

# AI graph tests only
cd backend && PYTHONPATH=. uv run pytest tests/test_ai_graphs/ -v

# All Playwright E2E
cd frontend && npx playwright test

# Specific E2E test
cd frontend && npx playwright test story-creation
```

## Dependencies

- Backend: pytest, pytest-asyncio (already installed)
- Frontend: @playwright/test (add to package.json), playwright MCP (already available)

## Playwright MCP Integration

After implementation, use Playwright MCP to:
1. Navigate to each page in the running app
2. Capture screenshots to verify visual correctness
3. Read DOM structure to extract real CSS selectors
4. Update E2E tests with accurate selectors based on actual UI
