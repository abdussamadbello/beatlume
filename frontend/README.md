# BeatLume — Frontend

Web app for BeatLume: graph-driven AI fiction planning. This package is a React SPA that talks to the FastAPI backend in `../backend`.

## Stack

- **React 19** + **TypeScript**
- **Vite 8** (dev server + build)
- **TanStack Router** — file-based routes under `src/routes/`
- **TanStack Query** — server state in `src/api/`
- **Zustand** — auth (persisted) and UI-only state in `src/store.ts`

Styling uses inline `CSSProperties` and tokens from `src/styles/tokens.css` (see repo root `CLAUDE.md` for full conventions).

## Prerequisites

- **Node.js** (current LTS is fine) and npm
- **Backend API** running (default `http://localhost:8000`) unless you point `VITE_API_URL` elsewhere

From the monorepo root you can run `make dev` to start backend + frontend together.

## Setup

```bash
cd frontend
npm install
cp .env.example .env   # optional; defaults match local dev
```

## Environment

Create `frontend/.env` (or copy `.env.example`). Vite exposes only variables prefixed with `VITE_` to the app, except `FRONTEND_PORT` which is read in `vite.config.ts` for the dev server.

| Variable | Purpose |
|----------|---------|
| `FRONTEND_PORT` | Dev server port (default `5173`). Must match what you use in the browser. |
| `VITE_API_URL` | Backend base URL for API calls and SSE (default `http://localhost:8000`). |

If you change the API port, set `VITE_API_URL` to the same origin (e.g. `http://localhost:8001`) and align `backend/.env` `BACKEND_PORT` + backend CORS if needed.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (HMR) |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck only (used in CI / `make test-frontend`) |
| `npm run test:e2e` | Playwright E2E (requires backend on :8000; see repo `AGENTS.md`) |
| `npm run test:e2e:headed` | E2E with visible browser |
| `npm run test:e2e:ui` | Playwright UI mode |

## Local development

**Option A — monorepo Makefile (recommended)**

```bash
# from repo root
make dev
```

Ports come from `backend/.env` and `frontend/.env` when present (see root `Makefile`).

**Option B — frontend only**

```bash
cd frontend
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173/`).

## Project layout

```
src/
  api/           # TanStack Query hooks + fetch client (single source for HTTP)
  routes/        # TanStack Router file routes; story routes use stories.$storyId.*
  components/    # UI (chrome/, charts/, primitives/, …)
  hooks/         # e.g. useSSE
  styles/        # tokens.css, global.css
  store.ts       # Zustand: auth + UI state only
  types.ts       # Shared TypeScript types
  main.tsx       # Entry + providers
```

- **Server data** → TanStack Query in `src/api/`, not Zustand.
- **`src/data/`** — legacy mock modules; do not import from new route code.

## Related docs

- Repo-wide architecture and commands: `../CLAUDE.md`
- Agent workflow: `../AGENTS.md`
