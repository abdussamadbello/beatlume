# Contributing to BeatLume

Read these first:

- [README.md](../README.md) for the product overview and setup path
- [DEVELOPMENT.md](./DEVELOPMENT.md) for architecture, workflow, and implementation patterns
- [API.md](./API.md) for the HTTP surface

## Getting Started

```bash
make setup
make dev
```

Login:

- `elena@beatlume.io`
- `beatlume123`

## Development Workflow

1. Create a branch: `git checkout -b feat/my-feature`
2. Make changes
3. Run tests: `make test`
4. Run lint: `make lint`
5. Commit with descriptive message
6. Open a PR

## Code Conventions

### Backend (Python)

- **Formatting:** Ruff with line-length 100
- **Naming:** snake_case everywhere. Enums lowercase (`StoryStatus.in_progress`)
- **Architecture:** Routes → Services → Models (no repository layer)
- **Testing:** pytest + pytest-asyncio. Every new endpoint needs a test.
- **Types:** Type hints on all function signatures
- **Imports:** stdlib, then third-party, then local (`app.*`)
- **PYTHONPATH:** Always `PYTHONPATH=.` when running commands

### Frontend (TypeScript)

- **Styling:** Inline `CSSProperties` objects. CSS custom properties from tokens.
- **State:** TanStack Query for server data, Zustand for UI state only
- **Routes:** File-based TanStack Router. Story routes use `stories.$storyId.*` pattern
- **Types:** All entities have UUID `id: string`. Types in `types.ts`
- **Components:** Functional components only. No class components.

### Commits

Use conventional commits:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `test:` adding tests
- `chore:` maintenance
- `security:` security fix
- `ops:` infrastructure/deployment
- `data:` database changes

## Adding Features

### New API Endpoint

1. Schema: `backend/app/schemas/<domain>.py`
2. Service: `backend/app/services/<domain>.py`
3. Router: `backend/app/api/<domain>.py`
4. Wire: `backend/app/api/router.py` (if new file)
5. Test: `backend/tests/test_<domain>.py`
6. Frontend hook: `frontend/src/api/<domain>.ts`

### New Database Table

1. Model: `backend/app/models/<name>.py` (inherit `OrgScopedMixin` if org-scoped)
2. Export: `backend/app/models/__init__.py`
3. Migration: `PYTHONPATH=. uv run alembic revision --autogenerate -m "add <name>"`
4. Add RLS policy if org-scoped (in migration)
5. Apply: `PYTHONPATH=. uv run alembic upgrade head`

### New Frontend View

1. Route: `frontend/src/routes/stories.$storyId.<name>.tsx`
2. Use `createFileRoute('/stories/$storyId/<name>')`
3. Fetch via `useQuery` hooks from `src/api/`
4. No `AppShell`/`Sidebar` wrapping (layout handles it)
5. Handle loading: `if (isLoading) return <LoadingState />`

### New AI Workflow

1. Prompt: `backend/app/ai/prompts/<name>.py` (`build_prompt` + `validate_output`)
2. Graph: `backend/app/ai/graphs/<name>_graph.py`
3. Task: `backend/app/tasks/ai_tasks.py`
4. Endpoint: `backend/app/api/ai.py`
5. Frontend mutation: `frontend/src/api/ai.ts`

## Testing

```bash
make test-backend
make test-backend-quick
make test-frontend
make lint
```

Backend tests use a real PostgreSQL database (same instance, tables created/dropped per test).

## Design System

Blueprint aesthetic throughout:

- **Colors:** oklch-based. `--ink` (dark), `--paper` (warm white), `--blue`, `--amber`, `--red`
- **Fonts:** JetBrains Mono (labels, data), Instrument Serif (titles), Inter Tight (body)
- **Borders:** 1px solid `var(--ink)` or `var(--line)`
- **Spacing:** 4px grid

See `frontend/src/styles/tokens.css` for all design tokens.
