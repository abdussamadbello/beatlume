# BeatLume — Claude Code Instructions

## Project Overview

BeatLume is a graph-driven AI fiction planner SaaS. Monorepo with two apps:

- `frontend/` — React 19 + Vite + TanStack Router + TanStack Query + Zustand
- `backend/` — FastAPI + SQLAlchemy 2 (async) + PostgreSQL + LangGraph + Celery + Redis

## Tech Stack

### Frontend
- **Framework:** React 19, Vite 8, TypeScript 6
- **Routing:** TanStack Router (file-based, `src/routes/`)
- **Server state:** TanStack Query v5 (hooks in `src/api/`)
- **UI state:** Zustand (auth persisted to localStorage, UI ephemeral)
- **Design:** Blueprint aesthetic — oklch colors, JetBrains Mono, Instrument Serif, Inter Tight

### Backend
- **Framework:** FastAPI (async), Python 3.12, UV package manager
- **Database:** PostgreSQL 16 + SQLAlchemy 2 (async) + Alembic + org-based RLS
- **AI:** LangGraph (workflows) + LiteLLM (multi-provider LLM) + tiktoken
- **Tasks:** Celery 5 + Redis (broker + result backend + pub/sub)
- **Export:** ReportLab (PDF), python-docx (DOCX), ebooklib (ePub), plain text
- **Storage:** S3-compatible (MinIO local, real S3 prod)
- **Telemetry:** OpenTelemetry + structlog

## Architecture

### Backend Layers
```
API Routes (app/api/) → Services (app/services/) → Models (app/models/)
                              ↓
                        AI Graphs (app/ai/graphs/) → LiteLLM
                              ↓
                        Celery Tasks (app/tasks/)
```
No repository layer — services work directly with SQLAlchemy sessions.

### Frontend Layers
```
Routes (src/routes/) → Components → useQuery/useMutation (src/api/) → Backend API
                                  → useStore (src/store.ts) for UI-only state
```

### Multi-tenancy
Organization-based RLS. Every request sets `app.current_org_id` on the PostgreSQL session via `get_current_org` dependency. All org-scoped tables have RLS policies.

### Route Structure
Story views are scoped: `/stories/{storyId}/scenes`, `/stories/{storyId}/graph`, etc.
Non-story pages are flat: `/login`, `/dashboard`, `/settings`, `/pricing`.

## Commands

### Frontend
```bash
cd frontend
npm install              # install deps
npm run dev              # dev server (localhost:5173)
npm run build            # production build
npx tsc --noEmit         # type check
```

### Backend
```bash
cd backend
uv sync                              # install deps
PYTHONPATH=. uv run uvicorn app.main:app --reload --port 8000  # dev server
PYTHONPATH=. uv run pytest tests/ -v  # run tests (94 tests)
PYTHONPATH=. uv run alembic upgrade head           # run migrations
PYTHONPATH=. uv run alembic revision --autogenerate -m "description"  # new migration
PYTHONPATH=. uv run python -m app.seeds.sample_story  # seed sample data
```

### Infrastructure
```bash
# PostgreSQL and Redis must be running locally
# Default: postgres at localhost:5432 (user: beatlume, pass: beatlume_dev, db: beatlume)
# Default: redis at localhost:6379

# Or use Docker Compose for all services:
cd backend && docker compose up -d
```

## Conventions

### Backend
- **File structure:** One model per file, one router per domain, one service per domain
- **Naming:** snake_case everywhere. Enums are lowercase (`StoryStatus.in_progress`)
- **Auth:** JWT access (15 min) + refresh (7 days, httpOnly cookie). `get_current_user` and `get_current_org` dependencies
- **API responses:** Lists return `{items: [], total: int}`. Create returns 201. Delete returns 204. Async ops return 202 with `{task_id}`
- **Errors:** Return `{detail: str, code: str}`
- **PYTHONPATH:** Always set `PYTHONPATH=.` when running backend commands
- **Tests:** pytest + pytest-asyncio, async test client with DB fixtures in conftest.py

### Frontend
- **Routes:** File-based TanStack Router. Story routes use `stories.$storyId.*.tsx` pattern
- **Data fetching:** TanStack Query hooks in `src/api/`. Never fetch data in components directly
- **State:** Zustand only for auth (persisted) and UI state (selections, modes). Server data in Query cache
- **Styling:** Inline CSSProperties objects. CSS custom properties from `src/styles/tokens.css`
- **Types:** All entities have UUID `id: string`. Types in `src/types.ts`
- **Components:** Shared primitives in `src/components/primitives/`. Charts in `src/components/charts/`

## Key Files

### Backend
- `app/main.py` — FastAPI app factory with lifespan, CORS, router
- `app/config.py` — Pydantic Settings (all config from env vars)
- `app/deps.py` — `get_db`, `get_current_user`, `get_current_org`, `get_story`
- `app/models/base.py` — SQLAlchemy Base, OrgScopedMixin, TimestampMixin
- `app/api/router.py` — aggregates all 15 routers
- `app/ai/llm.py` — LiteLLM client with model tier routing
- `app/ai/context/assembler.py` — context engine for AI prompts
- `app/tasks/celery_app.py` — Celery config with queue routing

### Frontend
- `src/main.tsx` — React root with QueryClientProvider + RouterProvider
- `src/store.ts` — Zustand: auth slice (persisted) + UI slice (ephemeral)
- `src/api/client.ts` — fetch wrapper with auth interceptor + token refresh
- `src/routes/stories.$storyId.tsx` — story layout (Sidebar + Outlet + SSE)
- `src/types.ts` — all TypeScript interfaces
- `src/components/chrome/Sidebar.tsx` — story-scoped navigation

## Database

17 tables, 14 with RLS. Key tables: organizations, users, memberships, stories, scenes, characters, character_nodes, character_edges, insights, draft_contents, core_config_nodes, core_settings, manuscript_chapters, collaborators, comments, activity_events, export_jobs.

Seed user: `elena@beatlume.io` / `beatlume123`

## Do NOT

- Add mock data or hardcoded data to components — all data comes from API
- Import from `src/data/` in route files — those are legacy mock modules
- Use `useStore` for server data — use TanStack Query hooks from `src/api/`
- Skip `PYTHONPATH=.` when running backend commands
- Create repository layer — services access SQLAlchemy directly
- Add comments/docstrings to code you didn't change
