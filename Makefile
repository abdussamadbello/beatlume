# BeatLume Makefile
# Usage: make <target>

.PHONY: help install dev dev-stop dev-frontend dev-backend test test-backend test-frontend test-e2e test-e2e-live lint lint-backend lint-frontend \
        migrate migrate-new seed db-create db-reset db-fresh db-clear-alembic build clean reset \
        celery-fast celery-heavy celery-export celery-beat celery-all \
        docker-all docker-infra docker-api docker-frontend docker-down docker-clean docker-rebuild docker-db-fresh \
        observability-up observability-down observability-status observability-logs

# Load local env files when present
-include backend/.env
-include frontend/.env

# Development ports (overridable via environment or make args)
BACKEND_PORT ?= 8000
FRONTEND_PORT ?= 5173

# ============================================================================
# Help
# ============================================================================

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ============================================================================
# Install
# ============================================================================

install: ## Install all dependencies (frontend + backend)
	cd frontend && npm install
	cd backend && uv sync

install-frontend: ## Install frontend dependencies
	cd frontend && npm install

install-backend: ## Install backend dependencies
	cd backend && uv sync

# ============================================================================
# Development
# ============================================================================

dev: ## Start backend, all Celery workers + beat, and frontend (backend + Celery run in background)
	@echo "Starting backend on :$(BACKEND_PORT), Celery (fast/heavy/export/beat), and frontend on :$(FRONTEND_PORT)..."
	@make dev-backend &
	@make celery-all
	@make dev-frontend

# Script avoids pkill -f matching the shell that runs make (see scripts/dev-stop.sh).
dev-stop: ## Stop dev stack: Celery workers/beat, then uvicorn + Vite on dev ports
	@BACKEND_PORT=$(BACKEND_PORT) FRONTEND_PORT=$(FRONTEND_PORT) bash scripts/dev-stop.sh

dev-frontend: ## Start frontend dev server (port 5173)
	cd frontend && FRONTEND_PORT=$(FRONTEND_PORT) npm run dev

dev-backend: ## Start backend dev server (port 8000)
	cd backend && PYTHONPATH=. uv run uvicorn app.main:app --reload --port $(BACKEND_PORT)

# ============================================================================
# Testing
# ============================================================================

test: test-backend test-frontend ## Run all tests

test-backend: ## Run backend tests (pytest)
	cd backend && PYTHONPATH=. uv run pytest tests/ -v

test-backend-quick: ## Run backend tests (no verbose)
	cd backend && PYTHONPATH=. uv run pytest tests/ -q

test-frontend: ## Type-check frontend (TypeScript)
	cd frontend && npx tsc --noEmit

# E2E: requires PostgreSQL, Redis, migrated DB, seed, backend on :8000, then runs Playwright (starts Vite via config if needed).
test-e2e: ## Run frontend Playwright E2E (start backend first: make dev-backend)
	cd frontend && npm run test:e2e

# Live AI: needs Postgres, Redis, seed, OPENROUTER in backend/.env — `make dev` supplies API + Celery + Vite.
test-e2e-live: ## Playwright live scaffold E2E (set LIVE_AI_E2E via npm script; start stack with `make dev`)
	cd frontend && npm run test:e2e:live

# ============================================================================
# Linting
# ============================================================================

lint: lint-backend lint-frontend ## Lint everything

lint-backend: ## Lint backend (ruff)
	cd backend && uv run ruff check app/ tests/

lint-backend-fix: ## Lint + fix backend
	cd backend && uv run ruff check --fix app/ tests/

lint-frontend: ## Lint frontend (eslint)
	cd frontend && npx eslint src/

# ============================================================================
# Database
# ============================================================================

db-create: ## Create beatlume database and user in PostgreSQL
	PGPASSWORD=postgres psql -U postgres -h localhost -c "CREATE USER beatlume WITH PASSWORD 'beatlume_dev';" || true
	PGPASSWORD=postgres psql -U postgres -h localhost -c "CREATE DATABASE beatlume OWNER beatlume;" || true
	PGPASSWORD=postgres psql -U postgres -h localhost -c "GRANT ALL PRIVILEGES ON DATABASE beatlume TO beatlume;" || true
	PGPASSWORD=postgres psql -U postgres -h localhost -c "GRANT ALL ON SCHEMA public TO beatlume;" -d beatlume || true
	PGPASSWORD=postgres psql -U postgres -h localhost -d beatlume -f backend/migrations/init_rls.sql || true

db-reset: ## Wipe DB (all tables + alembic history), migrate from scratch, seed
	PGPASSWORD=postgres psql -U postgres -h localhost -c "DROP DATABASE IF EXISTS beatlume;"
	PGPASSWORD=postgres psql -U postgres -h localhost -c "CREATE DATABASE beatlume OWNER beatlume;"
	PGPASSWORD=postgres psql -U postgres -h localhost -c "GRANT ALL ON SCHEMA public TO beatlume;" -d beatlume
	PGPASSWORD=postgres psql -U postgres -h localhost -d beatlume -f backend/migrations/init_rls.sql
	cd backend && PYTHONPATH=. uv run alembic upgrade head
	cd backend && PYTHONPATH=. uv run python -m app.seeds.sample_story

db-fresh: db-reset ## Alias: full reset (same as db-reset)

db-clear-alembic: ## Delete all rows in alembic_version (empty DB: then migrate; else stamp head or db-reset)
	PGPASSWORD=postgres psql -U postgres -h localhost -d beatlume -c "DELETE FROM alembic_version;"

migrate: ## Run pending Alembic migrations
	cd backend && PYTHONPATH=. uv run alembic upgrade head

migrate-new: ## Generate new migration (usage: make migrate-new msg="description")
	cd backend && PYTHONPATH=. uv run alembic revision --autogenerate -m "$(msg)"

migrate-status: ## Show current migration status
	cd backend && PYTHONPATH=. uv run alembic current

seed: ## Seed sample story data
	cd backend && PYTHONPATH=. uv run python -m app.seeds.sample_story

# ============================================================================
# Celery Workers
# ============================================================================

# Unique -n avoids DuplicateNodenameWarning when several workers run on one machine.
celery-fast: ## Start Celery worker for ai_fast queue (concurrency=1 to avoid rate limits)
	cd backend && PYTHONPATH=. uv run celery -A app.tasks.celery_app worker -n fast@$$(hostname) -Q ai_fast -c 1 -l info

celery-heavy: ## Start Celery worker for ai_heavy queue (concurrency=1 to avoid rate limits)
	cd backend && PYTHONPATH=. uv run celery -A app.tasks.celery_app worker -n heavy@$$(hostname) -Q ai_heavy -c 1 -l info

celery-export: ## Start Celery worker for export queue
	cd backend && PYTHONPATH=. uv run celery -A app.tasks.celery_app worker -n export@$$(hostname) -Q export -c 2 -l info

celery-beat: ## Start Celery Beat scheduler
	cd backend && PYTHONPATH=. uv run celery -A app.tasks.celery_app beat -l info

celery-all: ## Start all Celery workers + beat (background; logs in same terminal)
	@echo "Starting Celery workers (ai_fast, ai_heavy, export, beat)..."
	@make celery-fast &
	@make celery-heavy &
	@make celery-export &
	@make celery-beat &

# ============================================================================
# Docker (all containers prefixed with beatlume-)
# ============================================================================

docker-all: ## Start full stack in Docker (postgres, redis, MinIO, observability, API, frontend)
	cd backend && docker compose up -d
	@sleep 5
	@echo ""
	@echo "✓ BeatLume full stack running in Docker!"
	@echo ""
	@echo "  API:               http://localhost:8000"
	@echo "  Frontend:          http://localhost:5173"
	@echo "  Postgres:          localhost:5432"
	@echo "  Redis:             localhost:6379"
	@echo "  MinIO console:     http://localhost:9001"
	@echo "  Jaeger (traces):   http://localhost:16686"
	@echo "  Prometheus:        http://localhost:9090"
	@echo "  Grafana:           http://localhost:3000  (admin/beatlume_dev)"
	@echo ""
	@echo "Note: For hot reload, use 'make docker-infra' + 'make dev'"

docker-infra: ## Start infrastructure only (postgres, redis, MinIO, observability) - then run 'make dev'
	cd backend && docker compose up -d postgres redis minio minio-setup jaeger prometheus grafana otel-collector
	@sleep 5
	@echo ""
	@echo "✓ BeatLume infrastructure ready! Run 'make dev' for hot reload."
	@echo ""
	@echo "  Postgres:          localhost:5432 (beatlume/beatlume_dev)"
	@echo "  Redis:             localhost:6379"
	@echo "  MinIO console:     http://localhost:9001"
	@echo "  Jaeger (traces):   http://localhost:16686"
	@echo "  Prometheus:        http://localhost:9090"
	@echo "  Grafana:           http://localhost:3000  (admin/beatlume_dev)"

docker-down: ## Stop all BeatLume Docker containers (keeps volumes / data)
	cd backend && docker compose down

docker-clean: ## Remove all BeatLume Docker containers, volumes, and orphan containers (WIPES DB)
	cd backend && docker compose down --volumes --remove-orphans

docker-rebuild: ## Rebuild api image (picks up backend code changes) and restart full stack — keeps volumes
	cd backend && docker compose down
	cd backend && docker compose build api
	cd backend && docker compose up -d
	@echo ""
	@echo "✓ Rebuilt and restarted. Follow api logs: docker logs -f beatlume-api-1"

reset: ## Full Tier-1 reset — wipe ALL volumes (DB + Redis + MinIO) and bring stack back up clean
	cd backend && docker compose down --volumes --remove-orphans
	cd backend && docker compose up -d
	@echo ""
	@echo "✓ Full reset done. migrate + seed re-ran. Login: elena@beatlume.io / beatlume123"
	@echo "  Tail logs: docker logs -f beatlume-api-1"

docker-db-fresh: ## Wipe ONLY the postgres volume and bring stack back up — migrate + seed re-run, other data kept
	cd backend && docker compose down
	@# Fail loudly if the volume can't be removed — previously `|| true` silently hid "volume in use"
	@# errors, leaving the old volume attached and the DB in its stale (broken) state.
	@if docker volume ls --format '{{.Name}}' | grep -qx beatlume_postgres_data; then \
		docker volume rm beatlume_postgres_data; \
	else \
		echo "(beatlume_postgres_data not present — fresh DB will be created on up)"; \
	fi
	cd backend && docker compose up -d
	@echo ""
	@echo "✓ DB wiped and re-seeded. Login: elena@beatlume.io / beatlume123"

# ============================================================================
# Observability (Jaeger, Prometheus, Grafana, OTel Collector)
# ============================================================================

observability-up: ## Start observability stack (Jaeger, Prometheus, Grafana, OTel Collector)
	cd backend && docker compose up -d jaeger prometheus grafana otel-collector
	@echo ""
	@echo "Observability stack started!"
	@echo "  Jaeger (traces):   http://localhost:16686"
	@echo "  Prometheus:        http://localhost:9090"
	@echo "  Grafana:           http://localhost:3000  (admin/beatlume_dev)"

observability-down: ## Stop observability stack
	cd backend && docker compose stop jaeger prometheus grafana otel-collector

observability-status: ## Show observability stack status and access URLs
	@echo "=== BeatLume Observability Stack ==="
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep beatlume || echo "No beatlume containers running"
	@echo ""
	@echo "=== Access URLs ==="
	@echo "  Jaeger (traces):   http://localhost:16686"
	@echo "  Prometheus:        http://localhost:9090"
	@echo "  Grafana:           http://localhost:3000  (admin/beatlume_dev)"

observability-logs: ## Show OTel Collector logs (trace/metric flow)
	docker logs beatlume-otel-collector-1 --tail 50 -f

# ============================================================================
# Build
# ============================================================================

build: ## Build frontend for production
	cd frontend && npm run build

# ============================================================================
# Cleanup
# ============================================================================

clean: ## Remove build artifacts and caches
	rm -rf frontend/dist frontend/node_modules/.vite
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find backend -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find backend -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true

# ============================================================================
# Quick Start
# ============================================================================

setup: install db-create migrate seed ## Full setup: install deps, create DB, migrate, seed
	@echo ""
	@echo "Setup complete! Run 'make dev' to start development."
	@echo "Login: elena@beatlume.io / beatlume123"
