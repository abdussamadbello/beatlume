# BeatLume

BeatLume is a graph-driven AI fiction workspace for planning, drafting, and exporting long-form stories.

It is not only a scene board or an analysis tool. The product guarantee is that a writer can move from setup to a complete, exportable manuscript inside the app, using AI-assisted scaffolding, scene drafting, manuscript assembly, and export.

## Product Guarantee

Every story workspace is expected to support this path:

1. Create a story and define the premise, structure, story type, and target word count.
2. Scaffold the story into scenes, characters, and initial relationship edges.
3. Refine the plan through scenes, beats, graph edits, analytics, and AI insights.
4. Generate prose scene by scene or run a full-manuscript pass.
5. Review the assembled manuscript and export it as PDF, DOCX, ePub, or plaintext.

That end-to-end path matters more than any isolated planning surface.

## What BeatLume Includes

- Guided setup for premise, structure, character seed data, and AI scaffold kickoff
- Story-scoped views for overview, scenes, beats, characters, graph, timeline, AI insights, draft, manuscript, collaboration, and export
- Async AI workflows for story scaffolding, insight generation, insight application, prose continuation, relationship inference, scene summarization, and full-manuscript generation
- Real-time task feedback over SSE for AI progress, completion, and errors
- Export pipeline for manuscript output in multiple formats
- Organization-scoped multi-tenancy enforced with PostgreSQL Row-Level Security

## Monorepo Layout

```text
beatlume/
├── frontend/               React + Vite + TanStack Router + TanStack Query + Zustand
├── backend/                FastAPI + SQLAlchemy + PostgreSQL + LangGraph + Celery
├── docs/                   Architecture, API, deployment, contribution, and product docs
├── scripts/                Local development helpers
├── CLAUDE.md               Product and repo context for coding agents
├── AGENTS.md               Agent workflow rules for this repo
└── Makefile                Common setup, dev, test, and infra commands
```

## Architecture At A Glance

```text
Frontend routes/components
  -> TanStack Query hooks
    -> FastAPI routes
      -> services
        -> SQLAlchemy + PostgreSQL
        -> Celery tasks for AI/export
          -> Redis pub/sub
            -> SSE back to the browser
```

### Frontend

- React 19
- Vite
- TanStack Router
- TanStack Query
- Zustand
- TypeScript

### Backend

- FastAPI
- SQLAlchemy 2 async
- PostgreSQL 16
- Alembic
- LangGraph
- LiteLLM
- Celery + Redis
- OpenTelemetry + structlog

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.12+
- `uv`
- PostgreSQL running locally on `localhost:5432`
- Redis running locally on `localhost:6379`

Local development defaults:

- PostgreSQL database: `beatlume`
- PostgreSQL user: `beatlume`
- PostgreSQL password: `beatlume_dev`
- Redis URL: `redis://localhost:6379/0`

### One-Time Setup

```bash
make setup
```

This installs dependencies, creates the database, runs migrations, and seeds local data.

Seed login:

- Email: `elena@beatlume.io`
- Password: `beatlume123`

### Run The App

```bash
make dev
```

Useful variants:

```bash
make dev-backend
make dev-frontend
make dev-stop
make celery-all
```

Default local URLs:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`
- Health check: `http://localhost:8000/health`

## Testing And Validation

Repo-local commands:

```bash
make test
make test-backend
make test-frontend
make test-e2e
make lint
```

Direct commands used most often:

```bash
cd backend && PYTHONPATH=. uv run pytest tests/ -v
cd frontend && npx tsc --noEmit
```

## Key Workflows

### Story Creation And Scaffold

The setup wizard creates the story record first, then can immediately trigger `/api/stories/{storyId}/ai/scaffold` using the writer's premise, structure, target word count, genres, and seed characters.

The scaffold flow persists:

- scenes
- characters
- graph edges inferred from scaffold relationships

### Whole-Manuscript Generation

BeatLume supports both scene-level prose continuation and story-wide drafting through `/api/stories/{storyId}/ai/generate-manuscript`.

That job:

- walks scenes in order
- can skip scenes that already have prose
- can resume from a scene number
- emits progress and error events over SSE
- updates draft and manuscript-facing views as work completes

### Analytics And Explainable Insights

The analytics layer computes:

- tension curves
- pacing
- character presence
- character arcs
- health score
- sparklines

AI insights sit on top of those structural signals and route users back to the relevant story view instead of acting like a detached chatbot.

## Development Conventions

### Frontend

- Server state lives in TanStack Query hooks under `frontend/src/api`
- Auth and ephemeral UI state live in `frontend/src/store.ts`
- Story pages use TanStack Router file routes like `stories.$storyId.*.tsx`
- Styling is inline `CSSProperties` plus shared CSS tokens

### Backend

- Routes live in `backend/app/api`
- Services work directly with SQLAlchemy sessions
- Models live in `backend/app/models`
- AI prompts, context assembly, and graphs live under `backend/app/ai`
- Async AI and export jobs run through Celery tasks in `backend/app/tasks`

### Multi-Tenancy

BeatLume uses organization-scoped Row-Level Security. For org-scoped tables:

- inserts must set `org_id`
- queries do not need explicit `org_id` filters when the request session is configured through `get_current_org`

## Documentation Map

- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) - deeper developer handbook for local architecture, workflows, and implementation patterns
- [docs/API.md](./docs/API.md) - current API surface, async task behavior, and SSE model
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - deeper systems and algorithms document
- [docs/PRINCIPLES.md](./docs/PRINCIPLES.md) - engineering and AI design principles (the *why* behind the architecture)
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) - local and production deployment guidance
- [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) - contribution workflow
- [docs/PRD.md](./docs/PRD.md) - product requirements background
- [docs/superpowers/plans](./docs/superpowers/plans) - implementation plans
- [docs/superpowers/specs](./docs/superpowers/specs) - design and engineering specs

## Notes For Contributors

- Read the existing docs and recent code before changing architecture or workflow
- Always use real UUIDs from the API or database; never invent identifiers
- Backend commands should use `PYTHONPATH=.`
- Avoid putting API data in Zustand; use Query cache instead
- The repo may have unrelated local changes in flight; do not revert them casually

## License

Private. All rights reserved.
