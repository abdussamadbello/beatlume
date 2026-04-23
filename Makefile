# BeatLume Makefile
# Usage: make <target>

.PHONY: help install dev dev-stop dev-frontend dev-backend test test-backend test-frontend test-e2e test-e2e-live lint lint-backend lint-frontend \
        migrate migrate-new seed db-create db-reset db-fresh db-clear-alembic build clean \
        celery-fast celery-heavy celery-export celery-beat celery-all \
        docker-up docker-down

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
celery-fast: ## Start Celery worker for ai_fast queue
	cd backend && PYTHONPATH=. uv run celery -A app.tasks.celery_app worker -n fast@$$(hostname) -Q ai_fast -c 4 -l info

celery-heavy: ## Start Celery worker for ai_heavy queue
	cd backend && PYTHONPATH=. uv run celery -A app.tasks.celery_app worker -n heavy@$$(hostname) -Q ai_heavy -c 2 -l info

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
# Docker (optional services: MinIO, Jaeger)
# ============================================================================

docker-up: ## Start Docker services (MinIO, Jaeger)
	cd backend && docker compose up -d minio minio-setup jaeger

docker-down: ## Stop Docker services
	cd backend && docker compose down

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
