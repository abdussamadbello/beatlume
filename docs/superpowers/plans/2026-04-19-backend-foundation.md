# BeatLume Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the BeatLume backend foundation: UV project, Docker Compose infrastructure, FastAPI app factory, Pydantic Settings, SQLAlchemy async engine, all ORM models, Alembic migrations with RLS policies, and a health check that proves everything is wired together.

**Architecture:** Layered monolith — FastAPI app with SQLAlchemy 2 async models, PostgreSQL 16 with org-based RLS, Redis, MinIO, and Jaeger in Docker Compose. UV manages Python dependencies. Alembic handles migrations with RLS policy creation.

**Tech Stack:** Python 3.12, UV, FastAPI, SQLAlchemy 2 (async), asyncpg, Alembic, PostgreSQL 16, Redis 7, MinIO, Jaeger, Docker Compose, pydantic-settings, structlog

---

## File Structure

### New Files (Plan 1)

| File | Responsibility |
|------|---------------|
| `backend/pyproject.toml` | UV project config, all dependencies |
| `backend/Dockerfile` | Multi-stage build (api + worker targets) |
| `backend/docker-compose.yml` | All services: api, postgres, redis, minio, jaeger |
| `backend/.env.example` | Template env vars |
| `backend/.env` | Local dev env vars (gitignored) |
| `backend/alembic.ini` | Alembic config |
| `backend/migrations/env.py` | Alembic env with async engine |
| `backend/migrations/init_rls.sql` | RLS bootstrap SQL |
| `backend/migrations/versions/.gitkeep` | Empty dir for migrations |
| `backend/app/__init__.py` | Empty package init |
| `backend/app/main.py` | FastAPI app factory, lifespan, CORS |
| `backend/app/config.py` | Pydantic Settings from env |
| `backend/app/deps.py` | get_db dependency |
| `backend/app/models/__init__.py` | Model barrel export |
| `backend/app/models/base.py` | Declarative base, OrgScopedMixin, timestamps |
| `backend/app/models/user.py` | User, Organization, Membership |
| `backend/app/models/story.py` | Story |
| `backend/app/models/scene.py` | Scene |
| `backend/app/models/character.py` | Character |
| `backend/app/models/graph.py` | CharacterNode, CharacterEdge |
| `backend/app/models/insight.py` | Insight |
| `backend/app/models/draft.py` | DraftContent |
| `backend/app/models/core.py` | CoreConfigNode, CoreSetting |
| `backend/app/models/manuscript.py` | ManuscriptChapter |
| `backend/app/models/collaboration.py` | Collaborator, Comment, ActivityEvent, ExportJob |
| `backend/tests/__init__.py` | Test package |
| `backend/tests/conftest.py` | Shared fixtures (async engine, session, app) |
| `backend/tests/test_health.py` | Health endpoint test |
| `backend/tests/test_models.py` | Model creation + RLS test |

### Modified Files

| File | Changes |
|------|---------|
| `backend/app/main.py` (existing stub) | Replace with full app factory |
| `backend/requirements.txt` (existing) | Delete — replaced by pyproject.toml |

---

### Task 1: UV Project Setup

**Files:**
- Create: `backend/pyproject.toml`
- Delete: `backend/requirements.txt`

- [ ] **Step 1: Initialize UV project**

Delete the old `requirements.txt` and create `pyproject.toml`:

```bash
cd /home/abdussamadbello/beatlume/backend
rm requirements.txt
```

Create `backend/pyproject.toml`:

```toml
[project]
name = "beatlume-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "python-multipart>=0.0.9",
    "sqlalchemy[asyncio]>=2.0",
    "asyncpg>=0.30",
    "alembic>=1.14",
    "psycopg2-binary>=2.9",
    "python-jose[cryptography]>=3.3",
    "passlib[bcrypt]>=1.7",
    "httpx>=0.27",
    "langgraph>=0.2",
    "litellm>=1.50",
    "tiktoken>=0.8",
    "celery[redis]>=5.4",
    "redis>=5.0",
    "reportlab>=4.2",
    "python-docx>=1.1",
    "ebooklib>=0.18",
    "boto3>=1.35",
    "opentelemetry-api>=1.27",
    "opentelemetry-sdk>=1.27",
    "opentelemetry-exporter-otlp>=1.27",
    "opentelemetry-instrumentation-fastapi>=0.48b0",
    "opentelemetry-instrumentation-sqlalchemy>=0.48b0",
    "opentelemetry-instrumentation-httpx>=0.48b0",
    "opentelemetry-instrumentation-celery>=0.48b0",
    "structlog>=24.4",
    "pydantic-settings>=2.5",
    "numpy>=2.1",
    "scipy>=1.14",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3",
    "pytest-asyncio>=0.24",
    "pytest-cov>=5.0",
    "httpx>=0.27",
    "factory-boy>=3.3",
    "faker>=30.0",
    "ruff>=0.7",
    "mypy>=1.11",
]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "SIM"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.mypy]
python_version = "3.12"
plugins = ["sqlalchemy.ext.mypy.plugin"]
```

- [ ] **Step 2: Install dependencies with UV**

```bash
cd /home/abdussamadbello/beatlume/backend
uv sync
```

Expected: `.venv/` created, `uv.lock` generated, all packages installed.

- [ ] **Step 3: Verify Python environment**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run python -c "import fastapi; import sqlalchemy; import alembic; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd /home/abdussamadbello/beatlume
git add backend/pyproject.toml backend/uv.lock
git rm backend/requirements.txt
git commit -m "build: replace requirements.txt with UV pyproject.toml"
```

---

### Task 2: Docker Compose Infrastructure

**Files:**
- Create: `backend/docker-compose.yml`
- Create: `backend/Dockerfile`
- Create: `backend/.env.example`
- Create: `backend/.env`
- Create: `backend/.gitignore`

- [ ] **Step 1: Create Dockerfile**

Create `backend/Dockerfile`:

```dockerfile
# --- Base stage ---
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install UV
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install dependencies
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy application
COPY . .

# --- API target ---
FROM base AS api
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# --- Worker target ---
FROM base AS worker
CMD ["uv", "run", "celery", "-A", "app.tasks.celery_app", "worker", "-l", "info"]
```

- [ ] **Step 2: Create docker-compose.yml**

Create `backend/docker-compose.yml`:

```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: api
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - .:/app
    command: uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: beatlume
      POSTGRES_USER: beatlume
      POSTGRES_PASSWORD: beatlume_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations/init_rls.sql:/docker-entrypoint-initdb.d/01_rls.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U beatlume"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: beatlume
      MINIO_ROOT_PASSWORD: beatlume_dev
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"

  minio-setup:
    image: minio/mc:latest
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      sleep 3 &&
      mc alias set local http://minio:9000 beatlume beatlume_dev &&
      mc mb local/beatlume-exports --ignore-existing &&
      mc mb local/beatlume-assets --ignore-existing &&
      exit 0
      "

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"
      - "4317:4317"
      - "4318:4318"
    environment:
      COLLECTOR_OTLP_ENABLED: "true"

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

- [ ] **Step 3: Create .env.example and .env**

Create `backend/.env.example`:

```bash
# Database
DATABASE_URL=postgresql+asyncpg://beatlume:beatlume_dev@localhost:5432/beatlume
DATABASE_URL_SYNC=postgresql://beatlume:beatlume_dev@localhost:5432/beatlume

# Redis
REDIS_URL=redis://localhost:6379/0

# S3 / MinIO
S3_ENDPOINT_URL=http://localhost:9000
S3_ACCESS_KEY=beatlume
S3_SECRET_KEY=beatlume_dev
S3_BUCKET_EXPORTS=beatlume-exports
S3_BUCKET_ASSETS=beatlume-assets
S3_PRESIGNED_EXPIRY=3600

# Auth
JWT_SECRET_KEY=dev-secret-change-in-production
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=
OAUTH_GITHUB_CLIENT_ID=
OAUTH_GITHUB_CLIENT_SECRET=

# AI / LLM
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
AI_MODEL_FAST=gpt-4o-mini
AI_MODEL_STANDARD=gpt-4o
AI_MODEL_POWERFUL=claude-sonnet-4-6
AI_MODEL_SCAFFOLD=claude-sonnet-4-6

# Telemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=beatlume-api
LOG_LEVEL=INFO
LOG_FORMAT=json

# App
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
ENVIRONMENT=development
```

Copy `.env.example` to `.env`:

```bash
cp backend/.env.example backend/.env
```

- [ ] **Step 4: Create .gitignore for backend**

Create `backend/.gitignore`:

```
.env
.venv/
__pycache__/
*.pyc
.mypy_cache/
.pytest_cache/
.ruff_cache/
*.egg-info/
dist/
build/
```

- [ ] **Step 5: Commit**

```bash
cd /home/abdussamadbello/beatlume
git add backend/Dockerfile backend/docker-compose.yml backend/.env.example backend/.gitignore
git commit -m "infra: add Docker Compose with Postgres, Redis, MinIO, Jaeger"
```

---

### Task 3: Pydantic Settings Configuration

**Files:**
- Create: `backend/app/config.py`

- [ ] **Step 1: Create config module**

Create `backend/app/config.py`:

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://beatlume:beatlume_dev@localhost:5432/beatlume"
    database_url_sync: str = "postgresql://beatlume:beatlume_dev@localhost:5432/beatlume"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # S3
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "beatlume"
    s3_secret_key: str = "beatlume_dev"
    s3_bucket_exports: str = "beatlume-exports"
    s3_bucket_assets: str = "beatlume-assets"
    s3_presigned_expiry: int = 3600

    # Auth
    jwt_secret_key: str = "dev-secret-change-in-production"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7
    oauth_google_client_id: str = ""
    oauth_google_client_secret: str = ""
    oauth_github_client_id: str = ""
    oauth_github_client_secret: str = ""

    # AI
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    ai_model_fast: str = "gpt-4o-mini"
    ai_model_standard: str = "gpt-4o"
    ai_model_powerful: str = "claude-sonnet-4-6"
    ai_model_scaffold: str = "claude-sonnet-4-6"

    # Telemetry
    otel_exporter_otlp_endpoint: str = "http://localhost:4317"
    otel_service_name: str = "beatlume-api"
    log_level: str = "INFO"
    log_format: str = "json"

    # App
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174"]
    environment: str = "development"

    model_config = {"env_file": ".env", "case_sensitive": False}


settings = Settings()
```

- [ ] **Step 2: Verify config loads**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run python -c "from app.config import settings; print(settings.database_url)"
```

Expected: `postgresql+asyncpg://beatlume:beatlume_dev@localhost:5432/beatlume`

- [ ] **Step 3: Commit**

```bash
cd /home/abdussamadbello/beatlume
git add backend/app/config.py
git commit -m "feat: add Pydantic Settings configuration"
```

---

### Task 4: SQLAlchemy Base & OrgScopedMixin

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/base.py`

- [ ] **Step 1: Create models package init**

Create `backend/app/models/__init__.py`:

```python
from app.models.base import Base, OrgScopedMixin
from app.models.user import User, Organization, Membership
from app.models.story import Story
from app.models.scene import Scene
from app.models.character import Character
from app.models.graph import CharacterNode, CharacterEdge
from app.models.insight import Insight
from app.models.draft import DraftContent
from app.models.core import CoreConfigNode, CoreSetting
from app.models.manuscript import ManuscriptChapter
from app.models.collaboration import Collaborator, Comment, ActivityEvent, ExportJob

__all__ = [
    "Base",
    "OrgScopedMixin",
    "User",
    "Organization",
    "Membership",
    "Story",
    "Scene",
    "Character",
    "CharacterNode",
    "CharacterEdge",
    "Insight",
    "DraftContent",
    "CoreConfigNode",
    "CoreSetting",
    "ManuscriptChapter",
    "Collaborator",
    "Comment",
    "ActivityEvent",
    "ExportJob",
]
```

- [ ] **Step 2: Create base module with OrgScopedMixin**

Create `backend/app/models/base.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, declared_attr


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    """Adds created_at and updated_at columns."""

    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now(),
    )


class OrgScopedMixin:
    """Mixin for all org-scoped tables. Adds org_id FK + index for RLS."""

    @declared_attr
    def org_id(cls) -> Mapped[uuid.UUID]:
        return mapped_column(
            ForeignKey("organizations.id"),
            index=True,
        )
```

- [ ] **Step 3: Verify import**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run python -c "from app.models.base import Base, OrgScopedMixin, TimestampMixin; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd /home/abdussamadbello/beatlume
git add backend/app/models/base.py
git commit -m "feat: add SQLAlchemy declarative base with OrgScopedMixin"
```

---

### Task 5: User, Organization, Membership Models

**Files:**
- Create: `backend/app/models/user.py`

- [ ] **Step 1: Create user models**

Create `backend/app/models/user.py`:

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class PlanType(str, enum.Enum):
    FREE = "free"
    PRO = "pro"
    TEAM = "team"


class MembershipRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True)

    members: Mapped[list["Membership"]] = relationship(back_populates="organization")


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    plan: Mapped[PlanType] = mapped_column(default=PlanType.FREE)
    oauth_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    oauth_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    active_org_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id"), nullable=True
    )

    memberships: Mapped[list["Membership"]] = relationship(back_populates="user")
    active_org: Mapped[Organization | None] = relationship(foreign_keys=[active_org_id])


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("user_id", "org_id", name="uq_membership"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"))
    role: Mapped[MembershipRole] = mapped_column(default=MembershipRole.VIEWER)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    user: Mapped[User] = relationship(back_populates="memberships")
    organization: Mapped[Organization] = relationship(back_populates="members")
```

- [ ] **Step 2: Verify import**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run python -c "from app.models.user import User, Organization, Membership; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /home/abdussamadbello/beatlume
git add backend/app/models/user.py
git commit -m "feat: add User, Organization, Membership models"
```

---

### Task 6: Story Model

**Files:**
- Create: `backend/app/models/story.py`

- [ ] **Step 1: Create story model**

Create `backend/app/models/story.py`:

```python
import enum
import uuid

from sqlalchemy import ARRAY, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin, TimestampMixin


class StoryStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Story(Base, OrgScopedMixin, TimestampMixin):
    __tablename__ = "stories"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500))
    genres: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    target_words: Mapped[int] = mapped_column(default=80000)
    draft_number: Mapped[int] = mapped_column(default=1)
    status: Mapped[StoryStatus] = mapped_column(default=StoryStatus.NOT_STARTED)
    structure_type: Mapped[str] = mapped_column(String(50), default="3-act")
```

- [ ] **Step 2: Verify import**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run python -c "from app.models.story import Story, StoryStatus; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /home/abdussamadbello/beatlume
git add backend/app/models/story.py
git commit -m "feat: add Story model"
```

---

### Task 7: Scene Model

**Files:**
- Create: `backend/app/models/scene.py`

- [ ] **Step 1: Create scene model**

Create `backend/app/models/scene.py`:

```python
import uuid

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin, TimestampMixin


class Scene(Base, OrgScopedMixin, TimestampMixin):
    __tablename__ = "scenes"
    __table_args__ = (UniqueConstraint("story_id", "n", name="uq_scene_number"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id"))
    n: Mapped[int]
    title: Mapped[str] = mapped_column(String(500))
    pov: Mapped[str] = mapped_column(String(255))
    tension: Mapped[int] = mapped_column(default=5)
    act: Mapped[int] = mapped_column(default=1)
    location: Mapped[str] = mapped_column(String(500), default="")
    tag: Mapped[str] = mapped_column(String(100), default="")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
```

- [ ] **Step 2: Verify import**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run python -c "from app.models.scene import Scene; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /home/abdussamadbello/beatlume
git add backend/app/models/scene.py
git commit -m "feat: add Scene model"
```

---

### Task 8: Character Model

**Files:**
- Create: `backend/app/models/character.py`

- [ ] **Step 1: Create character model**

Create `backend/app/models/character.py`:

```python
import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin, TimestampMixin


class Character(Base, OrgScopedMixin, TimestampMixin):
    __tablename__ = "characters"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id"))
    name: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(100), default="")
    desire: Mapped[str] = mapped_column(Text, default="")
    flaw: Mapped[str] = mapped_column(Text, default="")
    scene_count: Mapped[int] = mapped_column(default=0)
    longest_gap: Mapped[int] = mapped_column(default=0)
```

- [ ] **Step 2: Verify import**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run python -c "from app.models.character import Character; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /home/abdussamadbello/beatlume
git add backend/app/models/character.py
git commit -m "feat: add Character model"
```

---

### Task 9: Graph Models (CharacterNode, CharacterEdge)

**Files:**
- Create: `backend/app/models/graph.py`

- [ ] **Step 1: Create graph models**

Create `backend/app/models/graph.py`:

```python
import enum
import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin


class NodeType(str, enum.Enum):
    HUB = "hub"
    MINOR = "minor"


class EdgeKind(str, enum.Enum):
    CONFLICT = "conflict"
    ALLIANCE = "alliance"
    ROMANCE = "romance"
    MENTOR = "mentor"
    SECRET = "secret"
    FAMILY = "family"


class EdgeProvenance(str, enum.Enum):
    AUTHOR = "author"
    AI_ACCEPTED = "ai_accepted"
    AI_PENDING = "ai_pending"
    SCAFFOLD = "scaffold"


class CharacterNode(Base, OrgScopedMixin):
    __tablename__ = "character_nodes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id"))
    character_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("characters.id"))
    x: Mapped[float] = mapped_column(default=0.0)
    y: Mapped[float] = mapped_column(default=0.0)
    label: Mapped[str] = mapped_column(String(255))
    initials: Mapped[str] = mapped_column(String(10))
    node_type: Mapped[NodeType | None] = mapped_column(nullable=True)
    first_appearance_scene: Mapped[int] = mapped_column(default=1)


class CharacterEdge(Base, OrgScopedMixin):
    __tablename__ = "character_edges"
    __table_args__ = (
        UniqueConstraint("story_id", "source_node_id", "target_node_id", name="uq_edge"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id"))
    source_node_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("character_nodes.id"))
    target_node_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("character_nodes.id"))
    kind: Mapped[EdgeKind]
    weight: Mapped[float] = mapped_column(default=0.5)
    provenance: Mapped[EdgeProvenance] = mapped_column(default=EdgeProvenance.AUTHOR)
    evidence: Mapped[list] = mapped_column(JSONB, default=list)
    first_evidenced_scene: Mapped[int] = mapped_column(default=1)
```

- [ ] **Step 2: Verify import**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run python -c "from app.models.graph import CharacterNode, CharacterEdge, EdgeKind, EdgeProvenance; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /home/abdussamadbello/beatlume
git add backend/app/models/graph.py
git commit -m "feat: add CharacterNode and CharacterEdge models"
```

---

### Task 10: Insight, DraftContent, Core Models

**Files:**
- Create: `backend/app/models/insight.py`
- Create: `backend/app/models/draft.py`
- Create: `backend/app/models/core.py`

- [ ] **Step 1: Create insight model**

Create `backend/app/models/insight.py`:

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import ARRAY, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin


class InsightSeverity(str, enum.Enum):
    RED = "red"
    AMBER = "amber"
    BLUE = "blue"


class Insight(Base, OrgScopedMixin):
    __tablename__ = "insights"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id"))
    severity: Mapped[InsightSeverity]
    category: Mapped[str] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    refs: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    dismissed: Mapped[bool] = mapped_column(default=False)
    generated_at: Mapped[datetime] = mapped_column(server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
```

- [ ] **Step 2: Create draft content model**

Create `backend/app/models/draft.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin


class DraftContent(Base, OrgScopedMixin):
    __tablename__ = "draft_contents"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id"))
    scene_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenes.id"))
    content: Mapped[str] = mapped_column(Text, default="")
    word_count: Mapped[int] = mapped_column(default=0)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
```

- [ ] **Step 3: Create core config models**

Create `backend/app/models/core.py`:

```python
import enum
import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin


class CoreKind(str, enum.Enum):
    STORY = "story"
    PART = "part"
    CHAP = "chap"
    SCENE = "scene"
    BEAT = "beat"


class CoreConfigNode(Base, OrgScopedMixin):
    __tablename__ = "core_config_nodes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id"))
    depth: Mapped[int] = mapped_column(default=0)
    label: Mapped[str] = mapped_column(String(255))
    kind: Mapped[CoreKind]
    active: Mapped[bool] = mapped_column(default=False)
    sort_order: Mapped[int] = mapped_column(default=0)


class CoreSetting(Base, OrgScopedMixin):
    __tablename__ = "core_settings"
    __table_args__ = (UniqueConstraint("story_id", "key", name="uq_core_setting"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id"))
    key: Mapped[str] = mapped_column(String(100))
    value: Mapped[str] = mapped_column(String(1000))
    source: Mapped[str] = mapped_column(String(100), default="")
    tag: Mapped[str | None] = mapped_column(String(100), nullable=True)
```

- [ ] **Step 4: Verify imports**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run python -c "from app.models.insight import Insight; from app.models.draft import DraftContent; from app.models.core import CoreConfigNode, CoreSetting; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
cd /home/abdussamadbello/beatlume
git add backend/app/models/insight.py backend/app/models/draft.py backend/app/models/core.py
git commit -m "feat: add Insight, DraftContent, CoreConfigNode, CoreSetting models"
```

---

### Task 11: Manuscript & Collaboration Models

**Files:**
- Create: `backend/app/models/manuscript.py`
- Create: `backend/app/models/collaboration.py`

- [ ] **Step 1: Create manuscript model**

Create `backend/app/models/manuscript.py`:

```python
import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin


class ManuscriptChapter(Base, OrgScopedMixin):
    __tablename__ = "manuscript_chapters"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id"))
    num: Mapped[int]
    title: Mapped[str] = mapped_column(String(500))
    content: Mapped[str] = mapped_column(Text, default="")
    sort_order: Mapped[int] = mapped_column(default=0)
```

- [ ] **Step 2: Create collaboration models**

Create `backend/app/models/collaboration.py`:

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin


class CollaboratorRole(str, enum.Enum):
    AUTHOR = "author"
    EDITOR = "editor"
    READER = "reader"


class ExportFormat(str, enum.Enum):
    PDF = "pdf"
    DOCX = "docx"
    EPUB = "epub"
    PLAINTEXT = "plaintext"


class ExportStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Collaborator(Base, OrgScopedMixin):
    __tablename__ = "collaborators"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    role: Mapped[CollaboratorRole] = mapped_column(default=CollaboratorRole.READER)
    invited_at: Mapped[datetime] = mapped_column(server_default=func.now())
    accepted_at: Mapped[datetime | None] = mapped_column(nullable=True)


class Comment(Base, OrgScopedMixin):
    __tablename__ = "comments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id"))
    scene_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("scenes.id"), nullable=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class ActivityEvent(Base, OrgScopedMixin):
    __tablename__ = "activity_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100))
    detail: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class ExportJob(Base, OrgScopedMixin):
    __tablename__ = "export_jobs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id"))
    format: Mapped[ExportFormat]
    status: Mapped[ExportStatus] = mapped_column(default=ExportStatus.PENDING)
    options: Mapped[dict] = mapped_column(JSONB, default=dict)
    file_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
```

- [ ] **Step 3: Verify imports**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run python -c "from app.models.manuscript import ManuscriptChapter; from app.models.collaboration import Collaborator, Comment, ActivityEvent, ExportJob; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd /home/abdussamadbello/beatlume
git add backend/app/models/manuscript.py backend/app/models/collaboration.py
git commit -m "feat: add ManuscriptChapter, Collaborator, Comment, ActivityEvent, ExportJob models"
```

---

### Task 12: Verify All Models Import Together

**Files:**
- Modify: `backend/app/models/__init__.py` (already created in Task 4)

- [ ] **Step 1: Verify barrel export**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run python -c "
from app.models import (
    Base, User, Organization, Membership, Story, Scene, Character,
    CharacterNode, CharacterEdge, Insight, DraftContent,
    CoreConfigNode, CoreSetting, ManuscriptChapter,
    Collaborator, Comment, ActivityEvent, ExportJob,
)
print(f'Tables: {len(Base.metadata.tables)}')
for name in sorted(Base.metadata.tables.keys()):
    print(f'  {name}')
"
```

Expected: 16 tables listed (organizations, users, memberships, stories, scenes, characters, character_nodes, character_edges, insights, draft_contents, core_config_nodes, core_settings, manuscript_chapters, collaborators, comments, activity_events, export_jobs).

- [ ] **Step 2: Commit models __init__**

```bash
cd /home/abdussamadbello/beatlume
git add backend/app/models/__init__.py
git commit -m "feat: add models barrel export"
```

---

### Task 13: Alembic Setup & Initial Migration

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/migrations/env.py`
- Create: `backend/migrations/init_rls.sql`
- Create: `backend/migrations/versions/.gitkeep`

- [ ] **Step 1: Create alembic.ini**

Create `backend/alembic.ini`:

```ini
[alembic]
script_location = migrations
sqlalchemy.url = postgresql://beatlume:beatlume_dev@localhost:5432/beatlume

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
```

- [ ] **Step 2: Create migrations/env.py**

Create `backend/migrations/env.py`:

```python
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import settings
from app.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = settings.database_url_sync
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine."""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.database_url_sync
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        # Use sync URL for Alembic since it uses sync operations internally
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # Use sync engine for Alembic (async is not needed for migrations)
    from sqlalchemy import engine_from_config

    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.database_url_sync
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 3: Create migrations/script.py.mako**

Create `backend/migrations/script.py.mako`:

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 4: Create init_rls.sql**

Create `backend/migrations/init_rls.sql`:

```sql
-- Bootstrap RLS support for BeatLume
-- This runs on first PostgreSQL container init via docker-entrypoint-initdb.d

-- Set a default value for the RLS session variable
ALTER DATABASE beatlume SET app.current_org_id = '00000000-0000-0000-0000-000000000000';

-- Helper function for RLS policies
CREATE OR REPLACE FUNCTION current_org_id() RETURNS uuid AS $$
  SELECT current_setting('app.current_org_id', true)::uuid;
$$ LANGUAGE SQL STABLE;
```

- [ ] **Step 5: Create versions/.gitkeep**

```bash
mkdir -p /home/abdussamadbello/beatlume/backend/migrations/versions
touch /home/abdussamadbello/beatlume/backend/migrations/versions/.gitkeep
```

- [ ] **Step 6: Commit**

```bash
cd /home/abdussamadbello/beatlume
git add backend/alembic.ini backend/migrations/
git commit -m "feat: add Alembic config, migrations env, and RLS bootstrap SQL"
```

---

### Task 14: Database Dependency & FastAPI App Factory

**Files:**
- Create: `backend/app/deps.py`
- Modify: `backend/app/main.py` (replace existing stub)

- [ ] **Step 1: Create database dependency**

Create `backend/app/deps.py`:

```python
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
```

- [ ] **Step 2: Replace app/main.py with full app factory**

Replace the contents of `backend/app/main.py` with:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.deps import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="BeatLume API",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
```

- [ ] **Step 3: Verify app starts**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run python -c "from app.main import app; print(app.title)"
```

Expected: `BeatLume API`

- [ ] **Step 4: Commit**

```bash
cd /home/abdussamadbello/beatlume
git add backend/app/deps.py backend/app/main.py
git commit -m "feat: add async DB dependency and FastAPI app factory"
```

---

### Task 15: Test Infrastructure & Health Check Test

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_health.py`

- [ ] **Step 1: Create test package**

Create `backend/tests/__init__.py` (empty file):

```python
```

- [ ] **Step 2: Create conftest with test fixtures**

Create `backend/tests/conftest.py`:

```python
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_app


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

- [ ] **Step 3: Write health check test**

Create `backend/tests/test_health.py`:

```python
import pytest


@pytest.mark.asyncio
async def test_health_returns_ok(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 4: Run the test**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run pytest tests/test_health.py -v
```

Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
cd /home/abdussamadbello/beatlume
git add backend/tests/
git commit -m "test: add health check test with async client fixture"
```

---

### Task 16: Model Tests

**Files:**
- Create: `backend/tests/test_models.py`

- [ ] **Step 1: Write model import and metadata test**

Create `backend/tests/test_models.py`:

```python
import uuid

from app.models import (
    Base,
    User,
    Organization,
    Membership,
    Story,
    Scene,
    Character,
    CharacterNode,
    CharacterEdge,
    Insight,
    DraftContent,
    CoreConfigNode,
    CoreSetting,
    ManuscriptChapter,
    Collaborator,
    Comment,
    ActivityEvent,
    ExportJob,
)
from app.models.user import PlanType, MembershipRole
from app.models.story import StoryStatus
from app.models.graph import EdgeKind, EdgeProvenance, NodeType
from app.models.insight import InsightSeverity
from app.models.core import CoreKind
from app.models.collaboration import CollaboratorRole, ExportFormat, ExportStatus


def test_all_tables_registered():
    """All 17 tables are registered in SQLAlchemy metadata."""
    table_names = sorted(Base.metadata.tables.keys())
    expected = sorted([
        "organizations",
        "users",
        "memberships",
        "stories",
        "scenes",
        "characters",
        "character_nodes",
        "character_edges",
        "insights",
        "draft_contents",
        "core_config_nodes",
        "core_settings",
        "manuscript_chapters",
        "collaborators",
        "comments",
        "activity_events",
        "export_jobs",
    ])
    assert table_names == expected


def test_org_scoped_tables_have_org_id():
    """All org-scoped tables have an org_id column."""
    org_scoped_tables = [
        "stories", "scenes", "characters", "character_nodes", "character_edges",
        "insights", "draft_contents", "core_config_nodes", "core_settings",
        "manuscript_chapters", "collaborators", "comments", "activity_events",
        "export_jobs",
    ]
    for table_name in org_scoped_tables:
        table = Base.metadata.tables[table_name]
        column_names = [c.name for c in table.columns]
        assert "org_id" in column_names, f"{table_name} missing org_id column"


def test_user_model_defaults():
    """User model has correct defaults."""
    user = User(
        email="test@example.com",
        name="Test User",
    )
    assert user.plan == PlanType.FREE
    assert user.password_hash is None
    assert user.avatar_url is None
    assert user.oauth_provider is None


def test_story_model_defaults():
    """Story model has correct defaults."""
    story = Story(title="My Story", org_id=uuid.uuid4())
    assert story.status == StoryStatus.NOT_STARTED
    assert story.draft_number == 1
    assert story.target_words == 80000
    assert story.structure_type == "3-act"


def test_scene_model_fields():
    """Scene model has all required fields."""
    table = Base.metadata.tables["scenes"]
    column_names = [c.name for c in table.columns]
    required = ["id", "org_id", "story_id", "n", "title", "pov", "tension", "act", "location", "tag", "summary"]
    for col in required:
        assert col in column_names, f"Scene missing column: {col}"


def test_edge_kind_enum_values():
    """EdgeKind has all 6 relationship types."""
    assert set(EdgeKind) == {
        EdgeKind.CONFLICT, EdgeKind.ALLIANCE, EdgeKind.ROMANCE,
        EdgeKind.MENTOR, EdgeKind.SECRET, EdgeKind.FAMILY,
    }


def test_edge_provenance_enum_values():
    """EdgeProvenance tracks source of edge creation."""
    assert set(EdgeProvenance) == {
        EdgeProvenance.AUTHOR, EdgeProvenance.AI_ACCEPTED,
        EdgeProvenance.AI_PENDING, EdgeProvenance.SCAFFOLD,
    }


def test_insight_severity_enum_values():
    """InsightSeverity has red, amber, blue."""
    assert set(InsightSeverity) == {
        InsightSeverity.RED, InsightSeverity.AMBER, InsightSeverity.BLUE,
    }


def test_export_format_enum_values():
    """ExportFormat covers all 4 output types."""
    assert set(ExportFormat) == {
        ExportFormat.PDF, ExportFormat.DOCX,
        ExportFormat.EPUB, ExportFormat.PLAINTEXT,
    }


def test_unique_constraints():
    """Key unique constraints are defined."""
    # Scene: unique(story_id, n)
    scene_table = Base.metadata.tables["scenes"]
    constraint_names = [c.name for c in scene_table.constraints if hasattr(c, "name") and c.name]
    assert "uq_scene_number" in constraint_names

    # CharacterEdge: unique(story_id, source_node_id, target_node_id)
    edge_table = Base.metadata.tables["character_edges"]
    constraint_names = [c.name for c in edge_table.constraints if hasattr(c, "name") and c.name]
    assert "uq_edge" in constraint_names

    # CoreSetting: unique(story_id, key)
    setting_table = Base.metadata.tables["core_settings"]
    constraint_names = [c.name for c in setting_table.constraints if hasattr(c, "name") and c.name]
    assert "uq_core_setting" in constraint_names
```

- [ ] **Step 2: Run model tests**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run pytest tests/test_models.py -v
```

Expected: All tests pass (10 tests).

- [ ] **Step 3: Commit**

```bash
cd /home/abdussamadbello/beatlume
git add backend/tests/test_models.py
git commit -m "test: add model structure and enum validation tests"
```

---

### Task 17: Docker Compose Smoke Test

**Files:**
- No new files — uses existing docker-compose.yml

- [ ] **Step 1: Start infrastructure services**

```bash
cd /home/abdussamadbello/beatlume/backend
docker compose up -d postgres redis
```

Expected: Both services start and pass health checks.

- [ ] **Step 2: Verify PostgreSQL is accessible**

```bash
docker compose exec postgres psql -U beatlume -c "SELECT 1;"
```

Expected: Returns `1`.

- [ ] **Step 3: Verify RLS bootstrap ran**

```bash
docker compose exec postgres psql -U beatlume -c "SELECT current_setting('app.current_org_id', true);"
```

Expected: Returns `00000000-0000-0000-0000-000000000000`.

- [ ] **Step 4: Verify Redis is accessible**

```bash
docker compose exec redis redis-cli ping
```

Expected: `PONG`.

- [ ] **Step 5: Generate and run initial migration**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run alembic revision --autogenerate -m "initial tables"
uv run alembic upgrade head
```

Expected: Migration file created in `migrations/versions/`, all 17 tables created in PostgreSQL.

- [ ] **Step 6: Verify tables exist**

```bash
docker compose exec postgres psql -U beatlume -c "\dt"
```

Expected: 17 tables listed plus `alembic_version`.

- [ ] **Step 7: Enable RLS on all org-scoped tables**

After the initial migration runs, we need to add RLS policies. Create a second migration manually.

```bash
cd /home/abdussamadbello/beatlume/backend
uv run alembic revision -m "enable RLS on org-scoped tables"
```

Then edit the generated migration file to contain:

```python
"""enable RLS on org-scoped tables

Revision ID: <auto-generated>
Revises: <auto-generated>
Create Date: <auto-generated>
"""
from typing import Sequence, Union

from alembic import op

revision: str = "<auto-generated>"
down_revision: Union[str, None] = "<auto-generated>"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ORG_SCOPED_TABLES = [
    "stories",
    "scenes",
    "characters",
    "character_nodes",
    "character_edges",
    "insights",
    "draft_contents",
    "core_config_nodes",
    "core_settings",
    "manuscript_chapters",
    "collaborators",
    "comments",
    "activity_events",
    "export_jobs",
]


def upgrade() -> None:
    for table in ORG_SCOPED_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY org_isolation ON {table} "
            f"USING (org_id = current_setting('app.current_org_id')::uuid)"
        )
        op.execute(
            f"CREATE POLICY org_isolation_insert ON {table} "
            f"FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id')::uuid)"
        )


def downgrade() -> None:
    for table in ORG_SCOPED_TABLES:
        op.execute(f"DROP POLICY IF EXISTS org_isolation_insert ON {table}")
        op.execute(f"DROP POLICY IF EXISTS org_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
```

Run it:

```bash
cd /home/abdussamadbello/beatlume/backend
uv run alembic upgrade head
```

- [ ] **Step 8: Verify RLS is enabled**

```bash
docker compose exec postgres psql -U beatlume -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true ORDER BY tablename;"
```

Expected: 14 tables listed with `rowsecurity = true`.

- [ ] **Step 9: Commit migration files**

```bash
cd /home/abdussamadbello/beatlume
git add backend/migrations/versions/
git commit -m "feat: add initial migration and RLS policies for all org-scoped tables"
```

---

### Task 18: Start API and End-to-End Health Check

**Files:**
- No new files — verification task

- [ ] **Step 1: Start the full stack**

```bash
cd /home/abdussamadbello/beatlume/backend
docker compose up -d
```

Expected: All services running (api, postgres, redis, minio, jaeger).

- [ ] **Step 2: Hit health endpoint**

```bash
curl -s http://localhost:8000/health | python3 -m json.tool
```

Expected:

```json
{
    "status": "ok"
}
```

- [ ] **Step 3: Run all tests**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run pytest tests/ -v
```

Expected: All tests pass (11 total: 1 health + 10 model tests).

- [ ] **Step 4: Verify Jaeger UI is accessible**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:16686
```

Expected: `200`

- [ ] **Step 5: Verify MinIO console is accessible**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:9001
```

Expected: `200`

- [ ] **Step 6: Stop services**

```bash
cd /home/abdussamadbello/beatlume/backend
docker compose down
```

---

## Verification Checklist

After all tasks complete, verify:

1. `uv run python -c "from app.models import *; print(len(Base.metadata.tables))"` → `17`
2. `uv run pytest tests/ -v` → all pass
3. `docker compose up -d` → all services healthy
4. `curl http://localhost:8000/health` → `{"status": "ok"}`
5. PostgreSQL has 17 tables + `alembic_version`
6. RLS enabled on 14 org-scoped tables
7. `current_org_id()` function exists in PostgreSQL
8. Jaeger UI at `http://localhost:16686` loads
9. MinIO console at `http://localhost:9001` loads
10. Redis responds to `PING` with `PONG`
