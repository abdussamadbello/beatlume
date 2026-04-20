# BeatLume

A graph-driven AI fiction planner. Structure your novel with scene boards, character relationship graphs, tension curves, and AI-powered story analysis — all in a blueprint-aesthetic workspace.

## What It Does

BeatLume is a writing tool that treats fiction structurally. Authors plan their stories through interconnected views:

- **Scene Board** — Kanban-style board organized by act, with POV, tension scores, and drag-to-reorder
- **Relationship Graph** — Force-directed character relationship visualization (conflict, alliance, romance, mentor, secret, family edges) with temporal scrubbing
- **Tension Timeline** — Cubic-spline tension curve with peak detection, pacing analysis, and heatmap overlays
- **AI Insights** — Developmental editor analysis powered by LLM: flags pacing flatlines, character disappearances, untested relationships, structural gaps
- **Draft Editor** — Scene-locked prose editor with AI continuation that matches the author's voice
- **Manuscript** — Full manuscript view with chapter navigation and scroll progress
- **Export** — PDF, DOCX, ePub, and plain text with professional manuscript formatting

## Architecture

```
frontend/  React 19 + Vite + TanStack Router + TanStack Query + Zustand
backend/   FastAPI + SQLAlchemy 2 + PostgreSQL + LangGraph + Celery + Redis
```

**Frontend** — 27 routes, 14 API modules, blueprint design system (oklch colors, JetBrains Mono, Instrument Serif)

**Backend** — 46 API endpoints, 17 database tables with org-based Row-Level Security, 5 AI workflows, 4 export formats, OpenTelemetry observability

**AI Pipeline** — LangGraph orchestrates multi-step workflows. LiteLLM routes to different models by task complexity (fast model for summaries, powerful model for story analysis). A context engine assembles the right data for each prompt — retrieving, ranking, and truncating to fit token budgets.

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.12+
- PostgreSQL 16 (running locally)
- Redis 7 (running locally)
- [UV](https://docs.astral.sh/uv/) package manager

### Setup

```bash
git clone <repo-url> beatlume && cd beatlume
make setup
```

This installs all dependencies, creates the database, runs migrations, and seeds sample data.

**Seed credentials:** `elena@beatlume.io` / `beatlume123`

### Development

```bash
# Start both servers
make dev

# Or start separately
make dev-frontend    # localhost:5173
make dev-backend     # localhost:8000
```

### Testing

```bash
make test            # Run all tests
make test-backend    # 95 pytest tests
make test-frontend   # TypeScript type checking
make lint            # Ruff (backend) + ESLint (frontend)
```

## Tech Stack

### Frontend

| Tool | Purpose |
|------|---------|
| React 19 | UI framework |
| Vite 8 | Build tool |
| TanStack Router | File-based routing with type-safe params |
| TanStack Query v5 | Server state (caching, refetching, optimistic updates) |
| Zustand | Client state (auth, UI selections) |
| TypeScript 6 | Type safety |

### Backend

| Tool | Purpose |
|------|---------|
| FastAPI | Async API framework |
| SQLAlchemy 2 | Async ORM with PostgreSQL |
| Alembic | Database migrations |
| LangGraph | AI workflow orchestration |
| LiteLLM | Multi-provider LLM abstraction |
| Celery + Redis | Background task queue |
| ReportLab | PDF export |
| python-docx | DOCX export |
| ebooklib | ePub export |
| OpenTelemetry | Distributed tracing + metrics |
| structlog | Structured JSON logging |
| slowapi | Rate limiting |

### Infrastructure

| Tool | Purpose |
|------|---------|
| PostgreSQL 16 | Primary database with RLS |
| Redis 7 | Cache, Celery broker, pub/sub for SSE |
| MinIO | S3-compatible object storage (local dev) |
| Jaeger | Trace visualization |
| Docker Compose | Optional infrastructure services |

## Project Structure

```
beatlume/
├── frontend/
│   └── src/
│       ├── api/                 # TanStack Query hooks (14 modules)
│       ├── hooks/               # Custom hooks (SSE)
│       ├── components/
│       │   ├── chrome/          # AppShell, Sidebar, ChromeTop
│       │   ├── charts/          # TensionCurve, GraphRenderer
│       │   └── primitives/      # Tag, Btn, Label, Panel, TensionBar, etc.
│       ├── routes/              # File-based routes (27 files)
│       ├── styles/              # CSS tokens + global styles
│       ├── store.ts             # Zustand (auth + UI state)
│       └── types.ts             # TypeScript interfaces
│
├── backend/
│   ├── app/
│   │   ├── api/                 # FastAPI routers (15 modules)
│   │   ├── models/              # SQLAlchemy models (12 modules, 17 tables)
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── services/            # Business logic + analytics engine
│   │   ├── ai/
│   │   │   ├── context/         # Context retrieval, ranking, truncation
│   │   │   ├── graphs/          # LangGraph workflows (5)
│   │   │   ├── prompts/         # Prompt templates (6 modules)
│   │   │   └── llm.py           # LiteLLM client + model routing
│   │   ├── tasks/               # Celery task definitions
│   │   ├── export/              # PDF, DOCX, ePub, plaintext engines
│   │   ├── storage/             # S3/MinIO client
│   │   └── telemetry/           # OpenTelemetry + structlog
│   ├── migrations/              # Alembic migrations + RLS bootstrap
│   ├── tests/                   # pytest (95 tests)
│   └── docker-compose.yml       # Infrastructure services
│
├── docs/superpowers/
│   ├── specs/                   # Design specifications
│   └── plans/                   # Implementation plans
│
├── CLAUDE.md                    # Claude Code instructions
├── AGENTS.md                    # AI agent workflow guide
└── Makefile                     # Development commands
```

## API Overview

All story data scoped under `/api/stories/{storyId}/`:

| Domain | Endpoints | Description |
|--------|-----------|-------------|
| Auth | `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/refresh`, `/auth/oauth/{provider}` | JWT + OAuth2 (Google, GitHub) |
| Users | `/api/users/me` | Profile management |
| Stories | `/api/stories` | CRUD with list/filter |
| Scenes | `/api/stories/{id}/scenes` | CRUD + filter by act/pov/sort |
| Characters | `/api/stories/{id}/characters` | CRUD |
| Graph | `/api/stories/{id}/graph` | Nodes, edges, suggestions |
| Insights | `/api/stories/{id}/insights` | List, dismiss, AI generate |
| Draft | `/api/stories/{id}/draft/{sceneId}` | Read/write prose content |
| Core Config | `/api/stories/{id}/core/tree`, `/core/settings` | Story structure config |
| Manuscript | `/api/stories/{id}/manuscript` | Chapter read/update |
| Collaboration | `/api/stories/{id}/collaborators`, `/comments`, `/activity` | Team features |
| Analytics | `/api/stories/{id}/analytics/*` | Tension curve, pacing, presence, arcs, health, sparkline |
| AI | `/api/stories/{id}/ai/scaffold`, `/ai/relationships`, `/ai/summarize` | Trigger AI workflows |
| Export | `/api/stories/{id}/export` | PDF/DOCX/ePub/text generation |
| SSE | `/api/stories/{id}/events` | Real-time event stream |

## Multi-Tenancy

Organization-based with PostgreSQL Row-Level Security (RLS). Every data table has an `org_id` column. RLS policies enforce isolation at the database level — even buggy application code can't leak data across organizations.

## AI Workflows

Five LangGraph workflows, each with dedicated prompts and output validation:

| Workflow | Model Tier | What It Does |
|----------|-----------|-------------|
| Insight Generation | Powerful | Full structural analysis: pacing, characters, relationships, continuity |
| Prose Continuation | Standard | Continues scene prose matching the author's voice |
| Relationship Inference | Standard | Infers character relationships from shared scene prose |
| Scene Summarization | Fast | Generates summary + beats for a scene |
| Story Scaffolding | Powerful | Generates full story structure from a premise |

A **context engine** assembles the right data for each task — retrieving scenes/characters/prose from the database, ranking by relevance, and truncating to fit token budgets.

## Environment Variables

See `backend/.env.example` for all configuration options. Key groups:

- **Database:** `DATABASE_URL`, `DATABASE_URL_SYNC`
- **Redis:** `REDIS_URL`
- **Auth:** `JWT_SECRET_KEY` (must change in production), OAuth client IDs/secrets
- **AI:** `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, model configuration per tier
- **Storage:** S3 endpoint, credentials, bucket names
- **Telemetry:** OTLP endpoint, service name, log level

## Make Targets

```
make setup              Full setup: install, create DB, migrate, seed
make dev                Start frontend + backend dev servers
make test               Run all tests (backend + frontend)
make lint               Lint everything (ruff + eslint)
make db-reset           Drop, recreate, migrate, seed
make migrate            Run pending Alembic migrations
make seed               Seed sample story data
make celery-all         Start all Celery workers + beat
make build              Production frontend build
make help               Show all available commands
```

## License

Private. All rights reserved.
