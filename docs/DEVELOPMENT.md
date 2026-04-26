# BeatLume Development Handbook

This is the practical developer guide for working in BeatLume. It connects the repo layout, request flow, async AI model, and implementation conventions that are spread across the rest of the doc set.

Read this with:

- [README.md](../README.md) for the high-level product and setup view
- [API.md](./API.md) for the HTTP surface
- [ARCHITECTURE.md](./ARCHITECTURE.md) for system and algorithm detail
- [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution workflow

## Product Mental Model

BeatLume is a fiction workspace with a planner-first UI, but the committed product outcome is stronger than planning alone:

1. set up a story
2. scaffold structure
3. analyze and revise structure
4. generate prose
5. assemble and export a complete manuscript

When choosing what to build, protect that end-to-end path.

## Monorepo Structure

```text
frontend/
  src/
    api/               TanStack Query hooks by domain
    components/        Reusable UI pieces
    hooks/             App hooks such as SSE
    routes/            TanStack Router file routes
    styles/            Tokens and globals
    store.ts           Zustand for auth and ephemeral UI state

backend/
  app/
    api/               FastAPI routers
    models/            SQLAlchemy models
    schemas/           Pydantic request/response models
    services/          Business logic and analytics
    ai/                Prompting, context assembly, graphs, model calls
    tasks/             Celery tasks
    export/            Export engines
    telemetry/         Logging, tracing, metrics
    storage/           S3/MinIO integration
  tests/               pytest suite
  migrations/          Alembic migrations
```

## Local Runtime

### Required Services

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

Local defaults:

- database: `beatlume`
- user: `beatlume`
- password: `beatlume_dev`
- Redis URL: `redis://localhost:6379/0`

Optional local infra such as MinIO, Jaeger, Prometheus, Grafana, and the OTEL collector lives in `backend/docker-compose.yml`.

### Common Commands

```bash
make setup
make dev
make dev-stop
make test
make lint
```

Backend commands should use `PYTHONPATH=.`:

```bash
cd backend && PYTHONPATH=. uv run pytest tests/ -v
cd backend && PYTHONPATH=. uv run uvicorn app.main:app --reload --port 8000
cd backend && PYTHONPATH=. uv run alembic upgrade head
```

Frontend validation:

```bash
cd frontend && npx tsc --noEmit
```

## Request And Data Flow

### Synchronous CRUD Path

```text
Route component
  -> domain hook in frontend/src/api
    -> api client
      -> FastAPI router
        -> service
          -> SQLAlchemy session
            -> PostgreSQL
```

### Async AI/Export Path

```text
UI action
  -> POST trigger endpoint
    -> Celery task queued
      -> task opens fresh async DB session
        -> AI graph / export service runs
          -> Redis pub/sub event published
            -> SSE endpoint streams event
              -> frontend store/query cache updates
```

This pattern is the default whenever work is slow, model-bound, or export-bound.

## Frontend Guide

### Routing

Frontend routing is file-based with TanStack Router.

Patterns:

- global pages: `login.tsx`, `dashboard.tsx`, `setup.tsx`
- story layout: `stories.$storyId.tsx`
- story views: `stories.$storyId.scenes.tsx`, `stories.$storyId.graph.tsx`, `stories.$storyId.ai.tsx`
- detail pages: `stories.$storyId.scenes.$id.tsx`, `stories.$storyId.characters.$id.tsx`

Story pages inherit layout from the story route. Do not wrap them in an additional app shell.

### Data Ownership Rules

- server data belongs in TanStack Query
- auth state belongs in Zustand
- ephemeral UI state belongs in Zustand
- API data should not be copied into Zustand

The repo already organizes hooks by backend domain. Extend those instead of fetching directly in components.

### Styling

BeatLume uses:

- inline `CSSProperties`
- CSS custom properties from `frontend/src/styles/tokens.css`
- blueprint-style warm paper / ink visual language

Avoid introducing Tailwind, CSS modules, or a competing design system.

### SSE Integration

`frontend/src/hooks/useSSE.ts` is the client bridge for story-scoped events.

The hook:

- requests a short-lived SSE token
- opens `EventSource`
- listens for AI, export, activity, and comment events
- updates the Zustand AI task store
- invalidates the relevant TanStack Query caches

If you add a new async task type, update this hook and the AI panel/task store behavior.

## Backend Guide

### Layering

BeatLume keeps a direct route -> service -> model structure.

- `app/api`: HTTP handling and dependency resolution
- `app/services`: business logic
- `app/models`: ORM models and constraints
- `app/schemas`: request/response contracts

There is no repository layer. Services work directly with SQLAlchemy sessions.

### Dependencies

Common FastAPI dependencies in `app/deps.py` provide:

- DB session
- current user
- current org
- current story

Those dependencies are also what make RLS-safe querying workable.

### Org Scoping And RLS

Every org-scoped table uses PostgreSQL Row-Level Security.

Implications:

- requests set `app.current_org_id` on the DB session
- read queries do not need manual `org_id` filtering in normal request flow
- inserts must still set `org_id`
- if you add a new org-scoped table, the migration must also add the relevant RLS policy

### Models And Migrations

When adding a model:

1. create the SQLAlchemy model in `backend/app/models`
2. export it from `backend/app/models/__init__.py`
3. generate an Alembic revision
4. review the migration carefully
5. add RLS setup for org-scoped tables

### Services

Service modules are domain-oriented:

- `story.py`
- `scene.py`
- `character.py`
- `graph.py`
- `collaboration.py`
- analytics services under `services/analytics`

Prefer small, composable service functions over router-heavy logic.

## AI System Guide

### Main Pieces

- `app/ai/prompts`: prompt builders and output validators
- `app/ai/context`: retrieval, ranking, formatting, token budgeting
- `app/ai/graphs`: LangGraph workflows
- `app/ai/llm.py`: model call abstraction
- `app/tasks/ai_tasks.py`: Celery task entry points and SSE publishing

### Why The Task Layer Matters

AI tasks do more than call a model. They are also responsible for:

- opening a safe async DB session
- setting org context
- publishing progress and completion events
- handling partial failure and retry behavior
- persisting outputs back into scenes, draft, graph, or insights

### Core AI Flows

#### Story Scaffold

Input:

- premise
- structure type
- target word count
- genres
- seed characters

Output persisted to the story:

- scenes
- characters
- graph edges

#### Prose Continuation

Input:

- story context
- scene context
- prior prose
- resolved settings

Behavior:

- streams chunks to the UI
- validates the generated output
- persists the updated draft

#### Full Manuscript

This is the product-critical drafting path.

The job iterates through scenes in order and can:

- skip already-written scenes
- target a specific act
- resume from a scene number
- continue when one scene fails, depending on failure mode

If you touch this path, think about:

- retry behavior
- task time limits
- partial recovery
- frontend progress semantics
- export compatibility afterward

## Analytics Guide

Analytics endpoints are read-only computations over story data.

Current structural outputs include:

- tension curve
- pacing analysis
- character presence matrix
- character arcs
- health score
- sparkline downsampling

When adding a metric:

1. implement the service logic
2. expose it through `app/api/analytics.py` if it is client-facing
3. update the frontend hook/module
4. add tests for both service behavior and API shape if relevant

## Export Guide

Exports are async jobs.

Current supported formats:

- PDF
- DOCX
- ePub
- plaintext

The export path prefers chapter data from manuscript chapters. If manuscript chapter data is missing, it can assemble output from scene drafts. That fallback matters because AI drafting and manuscript editing are not always completed in the same order.

## Common Implementation Recipes

### Add A New API Endpoint

1. add or update schema in `backend/app/schemas`
2. add or update service logic in `backend/app/services`
3. add route in `backend/app/api`
4. register the router if it is new
5. add backend tests
6. add or update frontend hook in `frontend/src/api`
7. connect the route to the relevant UI page

### Add A New Story View

1. create a route file in `frontend/src/routes`
2. use the story-scoped filename pattern when relevant
3. fetch data through hooks in `frontend/src/api`
4. handle loading and empty states explicitly
5. rely on the story layout instead of re-wrapping the page

### Add A New Async AI Action

1. add prompt module and output validation
2. add or update a LangGraph workflow
3. add a Celery task entry point
4. expose a trigger endpoint
5. teach `useSSE` how to react to the event type
6. update UI task surfaces if the action is user-facing
7. add backend tests for prompt/task/API behavior

## Testing Strategy

### Backend

- pytest
- async test client
- real PostgreSQL database
- per-test setup/teardown through fixtures

Focus areas:

- API contracts
- service behavior
- AI prompt validation
- task resilience
- analytics correctness

### Frontend

- TypeScript type-checking as the baseline validation
- Playwright for E2E coverage

Playwright relies on a seeded environment and a logged-in setup project to avoid repeatedly hitting the login rate limit.

## Troubleshooting

### AI Trigger Returns But Nothing Updates In The UI

Check:

- Celery workers are running
- Redis is running
- the SSE connection is live
- the frontend knows how to handle that event type

### Backend Tests Fail On Database Connection

Check:

- PostgreSQL is running locally
- the BeatLume DB and user exist
- migrations are current

### Story Data Appears Cross-Org Or Missing

Check:

- the request path is using the normal FastAPI dependencies
- `org_id` is set on inserts
- the migration configured RLS correctly

### Export Job Fails

Check:

- Redis availability for job status
- export worker availability
- whether manuscript chapter data exists, or scene drafts are sufficient for fallback assembly

## Keep These Constraints In Mind

- do not guess UUIDs
- do not bypass `PYTHONPATH=.`
- do not move server data into Zustand
- do not add a repository layer
- do not treat planning-only work as equivalent to the full-manuscript guarantee
