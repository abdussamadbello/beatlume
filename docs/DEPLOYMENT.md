# Deployment Guide

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.12+ with [UV](https://docs.astral.sh/uv/)
- PostgreSQL 16 (running on localhost:5432)
- Redis 7 (running on localhost:6379)

### One-Command Setup

```bash
make setup
```

This runs: `install` → `db-create` → `migrate` → `seed`

Login with: `elena@beatlume.io` / `beatlume123`

### Running

```bash
make dev                  # Frontend (5173) + Backend (8000)
make celery-all           # All Celery workers + beat (for AI/export tasks)
make docker-up            # MinIO + Jaeger (optional)
```

### Environment

Copy and edit `.env`:

```bash
cp backend/.env.example backend/.env
```

All config is driven by environment variables. See `backend/.env.example` for the full list.

---

## Production Deployment

### Required Environment Variables

These MUST be set (no safe defaults):

```bash
# Security — generate a strong random key
JWT_SECRET_KEY=<random-64-char-string>

# Database — use production credentials
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/beatlume
DATABASE_URL_SYNC=postgresql://user:password@host:5432/beatlume

# Redis
REDIS_URL=redis://host:6379/0

# Environment flag — enables secure cookies, startup validation
ENVIRONMENT=production

# CORS — your frontend domain
CORS_ORIGINS=https://app.beatlume.com
```

### Optional (but recommended)

```bash
# OAuth (for social login)
OAUTH_GOOGLE_CLIENT_ID=<from-google-console>
OAUTH_GOOGLE_CLIENT_SECRET=<from-google-console>
OAUTH_GITHUB_CLIENT_ID=<from-github-settings>
OAUTH_GITHUB_CLIENT_SECRET=<from-github-settings>

# AI (at least one required for AI features)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# S3 (for export file storage)
S3_ENDPOINT_URL=https://s3.amazonaws.com
S3_ACCESS_KEY=<aws-access-key>
S3_SECRET_KEY=<aws-secret-key>
S3_BUCKET_EXPORTS=beatlume-exports
S3_BUCKET_ASSETS=beatlume-assets

# Telemetry
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-otel-collector:4317
LOG_FORMAT=json
LOG_LEVEL=INFO
```

### Startup Validation

In production (`ENVIRONMENT=production`), the app refuses to start if:
- `JWT_SECRET_KEY` is still the dev default
- `DATABASE_URL` contains `beatlume_dev` (dev credentials)

### Docker Deployment

The backend Dockerfile supports two targets:

```bash
# Build API image
docker build --target api -t beatlume-api ./backend

# Build worker image (same code, different CMD)
docker build --target worker -t beatlume-worker ./backend
```

Run:

```bash
# API server
docker run -p 8000:8000 --env-file .env beatlume-api

# Celery workers
docker run --env-file .env beatlume-worker celery -A app.tasks.celery_app worker -Q ai_fast -c 4
docker run --env-file .env beatlume-worker celery -A app.tasks.celery_app worker -Q ai_heavy -c 2
docker run --env-file .env beatlume-worker celery -A app.tasks.celery_app worker -Q export -c 2
docker run --env-file .env beatlume-worker celery -A app.tasks.celery_app beat
```

### Frontend Build

```bash
cd frontend
VITE_API_URL=https://api.beatlume.com npm run build
```

Outputs static files to `frontend/dist/`. Serve from any CDN or static host (Vercel, Netlify, Cloudflare Pages, nginx).

### Database Setup

```bash
# Create database
createdb -U postgres beatlume

# Run migrations
cd backend
PYTHONPATH=. DATABASE_URL_SYNC=postgresql://... uv run alembic upgrade head

# Seed sample data (optional)
PYTHONPATH=. uv run python -m app.seeds.sample_story
```

### Health Check

```
GET /health → 200 (all ok) or 503 (degraded)
```

Checks PostgreSQL and Redis connectivity. Use for load balancer health probes.

---

## Architecture Decisions

### Why RLS over application-level filtering?

Row-Level Security enforces data isolation at the PostgreSQL level. Even if application code has a bug that forgets to filter by `org_id`, the database won't return another organization's data. Defense in depth.

### Why Celery over FastAPI BackgroundTasks?

AI workflows take 30-120 seconds. FastAPI BackgroundTasks run in the same process — a slow AI task would starve HTTP request handling. Celery runs in separate worker processes with proper queue routing, retry logic, and timeout handling.

### Why TanStack Query over Zustand for server data?

TanStack Query handles caching, background refetching, optimistic updates, and loading/error states out of the box. Zustand would require manual implementation of all of these. Query also provides automatic cache invalidation when data changes.

### Why separate Celery queues?

Different tasks have different characteristics:
- `ai_fast` (prose continuation, summarization): user is waiting, needs fast response, 4 workers
- `ai_heavy` (insights, scaffolding): can take a minute, 2 workers
- `export` (PDF/DOCX generation): CPU-bound, 2 workers

Separate queues prevent a slow insight generation from blocking a user's prose continuation request.

---

## Monitoring

### Logs

JSON-structured with trace context:

```json
{
  "event": "unhandled_exception",
  "path": "/api/stories/uuid/scenes",
  "method": "POST",
  "error": "...",
  "trace_id": "abc123",
  "span_id": "def456",
  "timestamp": "2026-04-20T..."
}
```

### Traces

OpenTelemetry auto-instruments: FastAPI requests, SQLAlchemy queries, HTTP calls (LiteLLM), Celery tasks. View in Jaeger at `http://localhost:16686` (local) or your OTLP collector.

### Metrics

Custom metrics exported via OTLP:
- `ai.task.duration` — AI workflow execution time
- `ai.tokens.total` — LLM token consumption
- `analytics.compute.duration` — analytics computation time
- `export.duration` — export generation time
- `sse.connections.active` — open SSE connections

### Health Endpoint

`GET /health` returns dependency status. Use for:
- Kubernetes liveness/readiness probes
- Load balancer health checks
- Uptime monitoring
