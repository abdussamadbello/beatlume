# BeatLume — Agent Instructions

Instructions for AI agents (Claude Code, Copilot, Codex, etc.) working on this project.

## Quick Context

BeatLume is a graph-driven AI fiction planner. Monorepo: `frontend/` (React + TanStack) and `backend/` (FastAPI + PostgreSQL + LangGraph + Celery).

**Product guarantee:** the app’s committed outcome is that a user can **generate a full, exportable story (whole manuscript)** via AI after setup—not only planning or single-scene features. See `CLAUDE.md` → *Product guarantee*.

Read `CLAUDE.md` for full project docs. This file covers agent-specific workflow guidance.

## Before You Start

1. **Check what exists.** Run `git log --oneline -10` and read relevant files before making changes.
2. **Run tests before and after.** Backend: `cd backend && PYTHONPATH=. uv run pytest tests/ -v`. Frontend: `cd frontend && npx tsc --noEmit`.
3. **Don't guess IDs.** All entities use UUIDs. Check the database or API response for real IDs.
4. **Set PYTHONPATH.** Every backend command needs `PYTHONPATH=.` since we don't use `pip install -e .`.

## Working on the Backend

### Adding a new API endpoint

1. Add Pydantic schema in `backend/app/schemas/<domain>.py`
2. Add service function in `backend/app/services/<domain>.py` (works with SQLAlchemy session directly)
3. Add route in `backend/app/api/<domain>.py`
4. Register router in `backend/app/api/router.py` (if new file)
5. Write test in `backend/tests/test_<domain>.py`
6. Run `PYTHONPATH=. uv run pytest tests/ -v`

### Adding a new database model

1. Create model in `backend/app/models/<name>.py` — inherit `OrgScopedMixin` if org-scoped
2. Export from `backend/app/models/__init__.py`
3. Run `PYTHONPATH=. uv run alembic revision --autogenerate -m "add <name> table"`
4. Review migration, add RLS policy if org-scoped
5. Run `PYTHONPATH=. uv run alembic upgrade head`

### Adding a new AI workflow

1. Create prompt module in `backend/app/ai/prompts/<name>.py` with `build_prompt()` + `validate_output()`
2. Create LangGraph in `backend/app/ai/graphs/<name>_graph.py`
3. Create Celery task in `backend/app/tasks/ai_tasks.py`
4. Add API trigger endpoint in `backend/app/api/ai.py`
5. Test prompt build/validation in `backend/tests/test_ai_prompts.py`

### RLS rules

Every org-scoped table has RLS enabled. When querying, the `get_current_org` dependency sets `app.current_org_id` on the session. You don't need to filter by `org_id` in queries — RLS handles it. But you DO need to set `org_id` when inserting.

## Working on the Frontend

### Adding a new view

1. Create route file: `frontend/src/routes/stories.$storyId.<name>.tsx`
2. Use `createFileRoute('/stories/$storyId/<name>')` 
3. Get `storyId` via `Route.useParams()`
4. Fetch data via hooks from `src/api/<domain>.ts`
5. Handle loading: `if (isLoading) return <LoadingState />`
6. No `AppShell`/`Sidebar` wrapping — the story layout handles it
7. Run `npx tsc --noEmit`

### Adding a new API hook

1. Add to the appropriate file in `frontend/src/api/<domain>.ts`
2. Follow the pattern: `useQuery` for reads, `useMutation` for writes
3. Query keys: `['stories', storyId, '<domain>']`
4. Invalidate related caches in `onSuccess`

### State rules

- **Server data → TanStack Query** (useQuery/useMutation from `src/api/`)
- **Auth state → Zustand** (persisted to localStorage: `accessToken`, `currentUser`)
- **UI state → Zustand** (ephemeral: `selectedNodeId`, `activeSceneN`, `editMode`, etc.)
- **Never** put API data in Zustand. Never fetch in components without a hook.

### Styling

- Inline `CSSProperties` objects — no CSS modules, no Tailwind
- Use CSS custom properties from `src/styles/tokens.css`: `var(--ink)`, `var(--paper)`, `var(--blue)`, etc.
- Fonts: `var(--font-mono)` (JetBrains Mono), `var(--font-serif)` (Instrument Serif), `var(--font-sans)` (Inter Tight)
- Blueprint aesthetic: warm paper background, ink borders, monospace labels

## Testing

### Backend (pytest)
```bash
cd backend
PYTHONPATH=. uv run pytest tests/ -v           # all tests
PYTHONPATH=. uv run pytest tests/test_auth.py -v  # specific file
PYTHONPATH=. uv run pytest tests/ -k "test_name"  # specific test
```

Tests use real PostgreSQL (localhost:5432). The conftest creates/drops all tables per test.

### Frontend
```bash
cd frontend
npx tsc --noEmit   # type check all files
```

**E2E (Playwright)** — needs PostgreSQL, Redis, migrated DB, seed (`make migrate seed`), and the API on `http://localhost:8000`. For a full stack (API + Celery + Vite), use `make dev` in one terminal; stop with `make dev-stop`. Or run only the API (`make dev-backend` or `PYTHONPATH=. uv run uvicorn app.main:app --reload --port 8000`), then:

The suite uses a **setup** project that logs in once and saves `playwright/.auth/user.json` so repeated tests do not hit the backend **5/min** limit on `POST /auth/login`. Auth tests run in a separate project without that session.

```bash
cd frontend
npm run test:e2e          # headless
npm run test:e2e:headed  # with browser
npm run test:e2e:ui      # Playwright UI
# or from repo root:
make test-e2e
```

Playwright starts (or reuses) the Vite dev server with `VITE_API_URL=http://localhost:8000` (see `frontend/playwright.config.ts`). Login for seeded data: `elena@beatlume.io` / `beatlume123`.

## Infrastructure

- **PostgreSQL:** localhost:5432, user `beatlume`, password `beatlume_dev`, database `beatlume`
- **Redis:** localhost:6379
- **Both must be running** for backend tests and API to work
- **Docker Compose** in `backend/docker-compose.yml` for MinIO, Jaeger (optional services)
- **Don't** start duplicate PostgreSQL/Redis containers — they're already running on this machine

## Project Structure

```
beatlume/
├── CLAUDE.md                    # Claude Code instructions
├── AGENTS.md                    # This file
├── Makefile                     # Dev commands
├── frontend/
│   ├── src/
│   │   ├── api/                 # TanStack Query hooks (16 modules incl. chat, auth-lifecycle)
│   │   ├── hooks/               # Custom hooks (useSSE)
│   │   ├── components/          # UI components (chrome, charts, primitives)
│   │   ├── routes/              # TanStack Router file-based routes
│   │   ├── data/                # Legacy mock data (DO NOT import in routes)
│   │   ├── styles/              # CSS tokens + global styles
│   │   ├── store.ts             # Zustand (auth + UI only)
│   │   ├── types.ts             # All TypeScript interfaces
│   │   └── main.tsx             # App entry point
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── api/                 # FastAPI routers (17 modules)
│   │   ├── models/              # SQLAlchemy models (14 modules)
│   │   ├── schemas/             # Pydantic schemas (14 modules)
│   │   ├── services/            # Business logic + analytics/
│   │   ├── ai/                  # LangGraph + LiteLLM + context engine
│   │   ├── tasks/               # Celery tasks
│   │   ├── export/              # PDF/DOCX/ePub/plaintext engines
│   │   ├── storage/             # S3/MinIO client
│   │   ├── telemetry/           # OpenTelemetry + structlog
│   │   ├── seeds/               # Database seed scripts
│   │   ├── config.py            # Pydantic Settings
│   │   ├── deps.py              # FastAPI dependencies
│   │   └── main.py              # App factory
│   ├── migrations/              # Alembic migrations
│   ├── tests/                   # pytest (~240 tests across 25 files)
│   ├── pyproject.toml           # UV project config
│   └── docker-compose.yml       # Infrastructure services
└── docs/superpowers/
    ├── specs/                   # Design specifications
    └── plans/                   # Implementation plans
```
