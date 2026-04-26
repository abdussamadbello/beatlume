# AI Slideout Story-Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Chat tab to the existing AI slideout in the story-scoped layout. Chat threads are persistent per-story, auto-aware of the active scene, and the LLM has curated read tools (auto-executed) plus write tools (rendered as inline approval cards in the thread).

**Architecture:** Two new SQLAlchemy models with org-scoped RLS (`chat_threads`, `chat_messages`) → a `ChatService` that orchestrates a LangGraph tool-calling agent → SSE streaming endpoint matching existing `useSSE` patterns → tab-shell `AIPanel` rewrite plus six new chat React components. Every write tool routes through an existing service path; the chat introduces zero parallel mutation logic.

**Tech Stack:** Backend: FastAPI, SQLAlchemy 2 (async), Alembic, LangGraph, LiteLLM, Pydantic. Frontend: React 19, TanStack Query v5, Zustand, TanStack Router. Both follow existing project patterns (`OrgScopedMixin`, `TimestampMixin`, fetch wrapper, SSE event types).

**Spec:** `docs/superpowers/specs/2026-04-26-ai-fab-chat-design.md`

**Working directory:** Run all commands from the repo root unless noted. Backend commands prepend `PYTHONPATH=.` per CLAUDE.md.

---

## Phase A — Backend data layer

### Task 1: Define ChatThread and ChatMessage models

**Files:**
- Create: `backend/app/models/chat_thread.py`
- Create: `backend/app/models/chat_message.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_models.py` (extend)

- [ ] **Step 1: Write the failing model tests**

Append to `backend/tests/test_models.py`:

```python
import uuid
from datetime import datetime

import pytest
from sqlalchemy import select

from app.models.chat_thread import ChatThread
from app.models.chat_message import ChatMessage, ChatMessageRole, ToolCallStatus


@pytest.mark.asyncio
async def test_chat_thread_persists(db_session, sample_org, sample_story):
    thread = ChatThread(
        org_id=sample_org.id,
        story_id=sample_story.id,
        title=None,
    )
    db_session.add(thread)
    await db_session.commit()
    await db_session.refresh(thread)

    assert isinstance(thread.id, uuid.UUID)
    assert thread.archived_at is None
    assert isinstance(thread.created_at, datetime)
    assert isinstance(thread.updated_at, datetime)


@pytest.mark.asyncio
async def test_chat_message_persists_with_tool_call(db_session, sample_org, sample_story):
    thread = ChatThread(org_id=sample_org.id, story_id=sample_story.id)
    db_session.add(thread)
    await db_session.flush()

    msg = ChatMessage(
        org_id=sample_org.id,
        thread_id=thread.id,
        role=ChatMessageRole.assistant,
        content="I will edit scene 1.",
        tool_calls=[{"name": "edit_scene_draft", "arguments": {"scene_id": "x"}}],
        tool_call_status=ToolCallStatus.proposed,
        tool_call_result={"diff": "@@ -1 +1 @@\n-old\n+new"},
    )
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)

    assert msg.role == ChatMessageRole.assistant
    assert msg.tool_call_status == ToolCallStatus.proposed
    assert msg.tool_calls[0]["name"] == "edit_scene_draft"


@pytest.mark.asyncio
async def test_chat_thread_cascades_messages_on_delete(db_session, sample_org, sample_story):
    thread = ChatThread(org_id=sample_org.id, story_id=sample_story.id)
    db_session.add(thread)
    await db_session.flush()
    msg = ChatMessage(
        org_id=sample_org.id,
        thread_id=thread.id,
        role=ChatMessageRole.user,
        content="hello",
    )
    db_session.add(msg)
    await db_session.commit()

    await db_session.delete(thread)
    await db_session.commit()

    rows = (await db_session.execute(select(ChatMessage).where(ChatMessage.id == msg.id))).all()
    assert rows == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_models.py -k chat -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.models.chat_thread'`

- [ ] **Step 3: Create the ChatThread model**

`backend/app/models/chat_thread.py`:

```python
import uuid

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin, TimestampMixin


class ChatThread(Base, OrgScopedMixin, TimestampMixin):
    __tablename__ = "chat_threads"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("stories.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    archived_at: Mapped["DateTime | None"] = mapped_column(DateTime(timezone=True), nullable=True)
```

- [ ] **Step 4: Create the ChatMessage model**

`backend/app/models/chat_message.py`:

```python
import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin, TimestampMixin


class ChatMessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    tool = "tool"


class ToolCallStatus(str, enum.Enum):
    proposed = "proposed"
    applied = "applied"
    rejected = "rejected"


class ChatMessage(Base, OrgScopedMixin, TimestampMixin):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    thread_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("chat_threads.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[ChatMessageRole] = mapped_column(
        Enum(ChatMessageRole, name="chat_message_role"),
    )
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    tool_calls: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    tool_call_status: Mapped[ToolCallStatus | None] = mapped_column(
        Enum(ToolCallStatus, name="tool_call_status"),
        nullable=True,
    )
    tool_call_result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
```

- [ ] **Step 5: Register in models package**

Modify `backend/app/models/__init__.py` — add at end:

```python
from app.models.chat_thread import ChatThread  # noqa: F401
from app.models.chat_message import ChatMessage, ChatMessageRole, ToolCallStatus  # noqa: F401
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_models.py -k chat -v`
Expected: 3 passed

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/chat_thread.py backend/app/models/chat_message.py backend/app/models/__init__.py backend/tests/test_models.py
git commit -m "feat(chat): add ChatThread and ChatMessage models"
```

---

### Task 2: Alembic migration with RLS policies

**Files:**
- Create: `backend/alembic/versions/<autogenerated>_add_chat_tables.py`
- Test: `backend/tests/test_chat_rls.py`

- [ ] **Step 1: Write the failing RLS test**

`backend/tests/test_chat_rls.py`:

```python
import uuid

import pytest
from sqlalchemy import text

from app.models.chat_thread import ChatThread


@pytest.mark.asyncio
async def test_chat_threads_rls_isolates_by_org(db_session, sample_org, second_org, sample_story):
    # Insert a thread under sample_org
    thread = ChatThread(org_id=sample_org.id, story_id=sample_story.id)
    db_session.add(thread)
    await db_session.commit()

    # Set RLS to second_org's session and confirm the row is invisible
    await db_session.execute(text("SET LOCAL app.current_org_id = :oid"), {"oid": str(second_org.id)})
    rows = (await db_session.execute(text("SELECT id FROM chat_threads"))).all()
    assert all(r[0] != thread.id for r in rows)

    # Switch back and confirm visible
    await db_session.execute(text("SET LOCAL app.current_org_id = :oid"), {"oid": str(sample_org.id)})
    rows = (await db_session.execute(text("SELECT id FROM chat_threads"))).all()
    assert any(r[0] == thread.id for r in rows)
```

If `second_org` fixture doesn't exist in `conftest.py`, add it (see existing `sample_org` fixture for shape — second org with second user/membership).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_chat_rls.py -v`
Expected: FAIL — table does not exist yet.

- [ ] **Step 3: Generate the migration**

Run from `backend/`:
```bash
PYTHONPATH=. uv run alembic revision --autogenerate -m "add_chat_tables"
```

This produces a file like `alembic/versions/abc123_add_chat_tables.py`. Open it and replace its body with the explicit version below — autogenerate will get the columns right but won't create the RLS policies.

- [ ] **Step 4: Edit the migration to include RLS**

Replace the migration body with:

```python
"""add_chat_tables

Revision ID: <leave>
Revises: <leave - autogenerate sets this>
Create Date: <leave>
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "<leave>"
down_revision = "<leave>"
branch_labels = None
depends_on = None


def upgrade() -> None:
    role_enum = sa.Enum("user", "assistant", "tool", name="chat_message_role")
    status_enum = sa.Enum("proposed", "applied", "rejected", name="tool_call_status")
    role_enum.create(op.get_bind(), checkfirst=True)
    status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "chat_threads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("story_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("stories.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_chat_threads_story_archived", "chat_threads", ["story_id", "archived_at"])

    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("thread_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("chat_threads.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("role", role_enum, nullable=False),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("tool_calls", postgresql.JSONB, nullable=True),
        sa.Column("tool_call_status", status_enum, nullable=True),
        sa.Column("tool_call_result", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_chat_messages_thread_created", "chat_messages", ["thread_id", "created_at"])

    # RLS policies — same pattern as existing org-scoped tables.
    op.execute("ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY chat_threads_org_isolation ON chat_threads "
        "USING (org_id = current_setting('app.current_org_id', true)::uuid)"
    )
    op.execute(
        "CREATE POLICY chat_messages_org_isolation ON chat_messages "
        "USING (org_id = current_setting('app.current_org_id', true)::uuid)"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS chat_messages_org_isolation ON chat_messages")
    op.execute("DROP POLICY IF EXISTS chat_threads_org_isolation ON chat_threads")
    op.drop_index("ix_chat_messages_thread_created", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_index("ix_chat_threads_story_archived", table_name="chat_threads")
    op.drop_table("chat_threads")
    op.execute("DROP TYPE IF EXISTS tool_call_status")
    op.execute("DROP TYPE IF EXISTS chat_message_role")
```

If existing migrations use a different RLS policy syntax (e.g., `FOR ALL TO PUBLIC USING ...`), copy that exact form from the closest existing migration. Read `backend/alembic/versions/` and pick the most recent org-scoped migration for reference.

- [ ] **Step 5: Run the migration locally**

Run: `cd backend && PYTHONPATH=. uv run alembic upgrade head`
Expected: migration succeeds; `\d chat_threads` in psql shows the table.

- [ ] **Step 6: Run RLS test to verify it passes**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_chat_rls.py -v`
Expected: 1 passed

- [ ] **Step 7: Commit**

```bash
git add backend/alembic/versions/ backend/tests/test_chat_rls.py
git commit -m "feat(chat): alembic migration for chat tables with org RLS"
```

---

## Phase B — Backend service & CRUD routes

### Task 3: ChatService — thread CRUD

**Files:**
- Create: `backend/app/services/chat_service.py`
- Create: `backend/app/schemas/chat.py`
- Test: `backend/tests/test_chat_service.py`

- [ ] **Step 1: Write failing tests for create/list/archive**

`backend/tests/test_chat_service.py`:

```python
import pytest

from app.services import chat_service


@pytest.mark.asyncio
async def test_create_thread_returns_unarchived_thread(db_session, sample_org, sample_story):
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    assert thread.archived_at is None
    assert thread.story_id == sample_story.id


@pytest.mark.asyncio
async def test_list_threads_excludes_archived_by_default(db_session, sample_org, sample_story):
    a = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    b = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    await chat_service.archive_thread(db_session, b.id)

    rows, total = await chat_service.list_threads(db_session, sample_story.id)
    ids = {t.id for t in rows}
    assert a.id in ids
    assert b.id not in ids
    assert total == 1


@pytest.mark.asyncio
async def test_archive_thread_sets_archived_at(db_session, sample_org, sample_story):
    t = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    await chat_service.archive_thread(db_session, t.id)
    await db_session.refresh(t)
    assert t.archived_at is not None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_chat_service.py -v`
Expected: FAIL with import error.

- [ ] **Step 3: Implement the schemas**

`backend/app/schemas/chat.py`:

```python
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.chat_message import ChatMessageRole, ToolCallStatus


class ChatThreadRead(BaseModel):
    id: uuid.UUID
    story_id: uuid.UUID
    title: str | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatMessageRead(BaseModel):
    id: uuid.UUID
    thread_id: uuid.UUID
    role: ChatMessageRole
    content: str | None
    tool_calls: list[dict[str, Any]] | None
    tool_call_status: ToolCallStatus | None
    tool_call_result: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SendMessageRequest(BaseModel):
    content: str
    active_scene_id: uuid.UUID | None = None


class RejectToolCallRequest(BaseModel):
    reason: str | None = None
```

- [ ] **Step 4: Implement the service (thread CRUD only)**

`backend/app/services/chat_service.py`:

```python
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_thread import ChatThread


async def create_thread(
    db: AsyncSession,
    org_id: uuid.UUID,
    story_id: uuid.UUID,
    title: str | None = None,
) -> ChatThread:
    thread = ChatThread(org_id=org_id, story_id=story_id, title=title)
    db.add(thread)
    await db.commit()
    await db.refresh(thread)
    return thread


async def list_threads(
    db: AsyncSession,
    story_id: uuid.UUID,
    include_archived: bool = False,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[ChatThread], int]:
    base = select(ChatThread).where(ChatThread.story_id == story_id)
    count_base = select(func.count()).select_from(ChatThread).where(ChatThread.story_id == story_id)
    if not include_archived:
        base = base.where(ChatThread.archived_at.is_(None))
        count_base = count_base.where(ChatThread.archived_at.is_(None))
    query = base.order_by(ChatThread.updated_at.desc()).offset(offset).limit(limit)
    rows = list((await db.execute(query)).scalars().all())
    total = (await db.execute(count_base)).scalar() or 0
    return rows, total


async def get_thread(db: AsyncSession, thread_id: uuid.UUID) -> ChatThread | None:
    return (await db.execute(select(ChatThread).where(ChatThread.id == thread_id))).scalar_one_or_none()


async def archive_thread(db: AsyncSession, thread_id: uuid.UUID) -> ChatThread | None:
    thread = await get_thread(db, thread_id)
    if thread is None:
        return None
    thread.archived_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(thread)
    return thread
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_chat_service.py -v`
Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/chat_service.py backend/app/schemas/chat.py backend/tests/test_chat_service.py
git commit -m "feat(chat): chat_service thread CRUD + Pydantic schemas"
```

---

### Task 4: ChatService — message persistence and listing

**Files:**
- Modify: `backend/app/services/chat_service.py`
- Modify: `backend/tests/test_chat_service.py`

- [ ] **Step 1: Append failing tests**

Append to `backend/tests/test_chat_service.py`:

```python
from app.models.chat_message import ChatMessageRole, ToolCallStatus


@pytest.mark.asyncio
async def test_persist_user_message(db_session, sample_org, sample_story):
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    msg = await chat_service.persist_message(
        db_session,
        org_id=sample_org.id,
        thread_id=thread.id,
        role=ChatMessageRole.user,
        content="What does Marcus want?",
    )
    assert msg.role == ChatMessageRole.user
    assert msg.tool_calls is None


@pytest.mark.asyncio
async def test_list_messages_orders_chronologically(db_session, sample_org, sample_story):
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    a = await chat_service.persist_message(db_session, sample_org.id, thread.id, ChatMessageRole.user, content="first")
    b = await chat_service.persist_message(db_session, sample_org.id, thread.id, ChatMessageRole.assistant, content="second")
    rows, total = await chat_service.list_messages(db_session, thread.id)
    assert [r.id for r in rows] == [a.id, b.id]
    assert total == 2


@pytest.mark.asyncio
async def test_persist_proposed_tool_call(db_session, sample_org, sample_story):
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    msg = await chat_service.persist_message(
        db_session,
        org_id=sample_org.id,
        thread_id=thread.id,
        role=ChatMessageRole.assistant,
        content="Editing scene 1.",
        tool_calls=[{"name": "edit_scene_draft", "arguments": {"scene_id": "abc", "new_text": "x"}}],
        tool_call_status=ToolCallStatus.proposed,
        tool_call_result={"diff": "@@ -1 +1 @@\n-old\n+new"},
    )
    assert msg.tool_call_status == ToolCallStatus.proposed
    assert msg.tool_call_result["diff"].startswith("@@")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_chat_service.py -k message -v`
Expected: FAIL with `AttributeError: module 'app.services.chat_service' has no attribute 'persist_message'`

- [ ] **Step 3: Add the message functions to chat_service**

Append to `backend/app/services/chat_service.py`:

```python
from app.models.chat_message import ChatMessage, ChatMessageRole, ToolCallStatus


async def persist_message(
    db: AsyncSession,
    org_id: uuid.UUID,
    thread_id: uuid.UUID,
    role: ChatMessageRole,
    *,
    content: str | None = None,
    tool_calls: list[dict] | None = None,
    tool_call_status: ToolCallStatus | None = None,
    tool_call_result: dict | None = None,
) -> ChatMessage:
    msg = ChatMessage(
        org_id=org_id,
        thread_id=thread_id,
        role=role,
        content=content,
        tool_calls=tool_calls,
        tool_call_status=tool_call_status,
        tool_call_result=tool_call_result,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def list_messages(
    db: AsyncSession,
    thread_id: uuid.UUID,
    offset: int = 0,
    limit: int = 200,
) -> tuple[list[ChatMessage], int]:
    base = select(ChatMessage).where(ChatMessage.thread_id == thread_id)
    count_base = select(func.count()).select_from(ChatMessage).where(ChatMessage.thread_id == thread_id)
    query = base.order_by(ChatMessage.created_at.asc()).offset(offset).limit(limit)
    rows = list((await db.execute(query)).scalars().all())
    total = (await db.execute(count_base)).scalar() or 0
    return rows, total


async def get_message(db: AsyncSession, message_id: uuid.UUID) -> ChatMessage | None:
    return (await db.execute(select(ChatMessage).where(ChatMessage.id == message_id))).scalar_one_or_none()
```

- [ ] **Step 4: Run tests**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_chat_service.py -v`
Expected: all (6) passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/chat_service.py backend/tests/test_chat_service.py
git commit -m "feat(chat): persist_message and list_messages in chat_service"
```

---

### Task 5: API routes for thread/message CRUD (no streaming yet)

**Files:**
- Create: `backend/app/api/chat.py`
- Modify: `backend/app/api/router.py`
- Test: `backend/tests/test_chat_api.py`

- [ ] **Step 1: Write failing API tests**

`backend/tests/test_chat_api.py`:

```python
import pytest

from app.models.chat_message import ChatMessageRole
from app.services import chat_service


@pytest.mark.asyncio
async def test_create_thread_endpoint(client, auth_headers, sample_story):
    resp = await client.post(
        f"/api/stories/{sample_story.id}/chat/threads",
        headers=auth_headers,
        json={},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["story_id"] == str(sample_story.id)
    assert body["archived_at"] is None


@pytest.mark.asyncio
async def test_list_threads_endpoint_returns_paginated_shape(client, auth_headers, sample_story):
    resp = await client.get(
        f"/api/stories/{sample_story.id}/chat/threads",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert "total" in body


@pytest.mark.asyncio
async def test_get_messages_endpoint(client, auth_headers, db_session, sample_org, sample_story):
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    await chat_service.persist_message(
        db_session, sample_org.id, thread.id, ChatMessageRole.user, content="hi"
    )
    resp = await client.get(
        f"/api/chat/threads/{thread.id}/messages",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["content"] == "hi"


@pytest.mark.asyncio
async def test_delete_thread_archives(client, auth_headers, db_session, sample_org, sample_story):
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    resp = await client.delete(
        f"/api/chat/threads/{thread.id}",
        headers=auth_headers,
    )
    assert resp.status_code == 204
    await db_session.refresh(thread)
    assert thread.archived_at is not None


@pytest.mark.asyncio
async def test_thread_not_found_returns_404_for_other_org(
    client, second_org_auth_headers, db_session, sample_org, sample_story
):
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    resp = await client.get(
        f"/api/chat/threads/{thread.id}/messages",
        headers=second_org_auth_headers,
    )
    assert resp.status_code == 404  # not 403 — we don't leak existence
```

If `second_org_auth_headers` doesn't exist in `conftest.py`, add it as a fixture mirroring `auth_headers` but using a second org/user.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_chat_api.py -v`
Expected: FAIL with 404 on every endpoint (not registered yet).

- [ ] **Step 3: Implement the routes**

`backend/app/api/chat.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_org, get_current_user, get_db, get_story
from app.models.story import Story
from app.models.user import Organization
from app.schemas.chat import ChatMessageRead, ChatThreadRead
from app.services import chat_service

# Story-scoped routes (require story access via dep)
story_router = APIRouter(prefix="/api/stories/{story_id}/chat", tags=["chat"])
# Thread-scoped routes (lookup + RLS-based 404)
thread_router = APIRouter(prefix="/api/chat", tags=["chat"])


class CreateThreadBody(BaseModel):
    title: str | None = None


class ThreadListResponse(BaseModel):
    items: list[ChatThreadRead]
    total: int


class MessageListResponse(BaseModel):
    items: list[ChatMessageRead]
    total: int


@story_router.post("/threads", response_model=ChatThreadRead, status_code=status.HTTP_201_CREATED)
async def create_thread(
    body: CreateThreadBody,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    thread = await chat_service.create_thread(db, org.id, story.id, title=body.title)
    return thread


@story_router.get("/threads", response_model=ThreadListResponse)
async def list_threads(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
    include_archived: bool = Query(False),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    rows, total = await chat_service.list_threads(
        db, story.id, include_archived=include_archived, offset=offset, limit=limit
    )
    return ThreadListResponse(items=[ChatThreadRead.model_validate(r) for r in rows], total=total)


@thread_router.get("/threads/{thread_id}", response_model=ChatThreadRead)
async def get_thread(
    thread_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    thread = await chat_service.get_thread(db, thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")
    return thread


@thread_router.delete("/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_thread(
    thread_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    archived = await chat_service.archive_thread(db, thread_id)
    if archived is None:
        raise HTTPException(status_code=404, detail="Thread not found")
    return None


@thread_router.get("/threads/{thread_id}/messages", response_model=MessageListResponse)
async def get_messages(
    thread_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
    offset: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
):
    thread = await chat_service.get_thread(db, thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")
    rows, total = await chat_service.list_messages(db, thread_id, offset=offset, limit=limit)
    return MessageListResponse(items=[ChatMessageRead.model_validate(r) for r in rows], total=total)
```

- [ ] **Step 4: Register the routers**

Modify `backend/app/api/router.py`. Add imports:
```python
from app.api.chat import story_router as chat_story_router, thread_router as chat_thread_router
```
And include them:
```python
api_router.include_router(chat_story_router)
api_router.include_router(chat_thread_router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_chat_api.py -v`
Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/chat.py backend/app/api/router.py backend/tests/test_chat_api.py
git commit -m "feat(chat): REST endpoints for chat thread/message CRUD"
```

---

## Phase C — Backend tool registry

### Task 6: Read tools (auto-execute)

**Files:**
- Create: `backend/app/ai/tools/__init__.py`
- Create: `backend/app/ai/tools/chat_tools.py`
- Test: `backend/tests/test_chat_tools.py`

- [ ] **Step 1: Write failing tests**

`backend/tests/test_chat_tools.py`:

```python
import pytest

from app.ai.tools.chat_tools import (
    READ_TOOLS,
    WRITE_TOOLS,
    tool_get_scene,
    tool_list_characters,
    tool_get_scene_summaries,
)


def test_read_tools_registry_shape():
    names = {t["name"] for t in READ_TOOLS}
    assert {"get_scene", "list_characters", "get_character", "get_scene_summaries", "find_inconsistencies"} <= names


def test_write_tools_registry_shape():
    names = {t["name"] for t in WRITE_TOOLS}
    assert {"edit_scene_draft", "propose_scene", "update_character_note", "summarize_scene"} <= names


@pytest.mark.asyncio
async def test_tool_get_scene_returns_scene_dict(db_session, sample_story, sample_scene):
    result = await tool_get_scene(db_session, sample_story.id, scene_id=sample_scene.id)
    assert result["id"] == str(sample_scene.id)
    assert "draft" in result


@pytest.mark.asyncio
async def test_tool_get_scene_invalid_id_returns_error(db_session, sample_story):
    import uuid as _u
    result = await tool_get_scene(db_session, sample_story.id, scene_id=_u.uuid4())
    assert "error" in result


@pytest.mark.asyncio
async def test_tool_list_characters(db_session, sample_story, sample_character):
    result = await tool_list_characters(db_session, sample_story.id)
    names = {c["name"] for c in result["characters"]}
    assert sample_character.name in names


@pytest.mark.asyncio
async def test_tool_get_scene_summaries_range(db_session, sample_story):
    result = await tool_get_scene_summaries(db_session, sample_story.id, start=1, end=5)
    assert "scenes" in result
```

If `sample_scene` / `sample_character` fixtures don't exist, add them to `conftest.py` modeled on `sample_story`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_chat_tools.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the tools file**

`backend/app/ai/tools/__init__.py`: empty file.

`backend/app/ai/tools/chat_tools.py`:

```python
"""Tool registry for the chat agent.

Read tools auto-execute and feed their result back into the agent.
Write tools generate a *preview* (no DB mutation) and pause the agent;
mutation only happens when the user clicks Apply on the resulting card.
"""
from __future__ import annotations

import difflib
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.character import Character
from app.models.scene import Scene
from app.services import draft as draft_service
from app.services import scene as scene_service


# ---------- Read tools ----------

async def tool_get_scene(db: AsyncSession, story_id: uuid.UUID, *, scene_id: uuid.UUID) -> dict[str, Any]:
    scene = await scene_service.get_scene(db, story_id, scene_id)
    if scene is None:
        return {"error": "scene_not_found", "scene_id": str(scene_id)}
    draft = await draft_service.get_draft(db, story_id, scene_id)
    return {
        "id": str(scene.id),
        "n": scene.n,
        "title": scene.title,
        "summary": scene.summary,
        "pov": scene.pov,
        "act": scene.act,
        "tension": scene.tension,
        "draft": draft.content if draft else "",
    }


async def tool_list_characters(db: AsyncSession, story_id: uuid.UUID) -> dict[str, Any]:
    rows = (await db.execute(select(Character).where(Character.story_id == story_id))).scalars().all()
    return {
        "characters": [
            {"id": str(c.id), "name": c.name, "role": getattr(c, "role", None)}
            for c in rows
        ]
    }


async def tool_get_character(db: AsyncSession, story_id: uuid.UUID, *, character_id: uuid.UUID) -> dict[str, Any]:
    c = (await db.execute(
        select(Character).where(Character.id == character_id, Character.story_id == story_id)
    )).scalar_one_or_none()
    if c is None:
        return {"error": "character_not_found", "character_id": str(character_id)}
    return {
        "id": str(c.id),
        "name": c.name,
        "role": getattr(c, "role", None),
        "notes": getattr(c, "notes", "") or "",
    }


async def tool_get_scene_summaries(
    db: AsyncSession, story_id: uuid.UUID, *, start: int = 1, end: int = 1000
) -> dict[str, Any]:
    rows = (await db.execute(
        select(Scene)
        .where(Scene.story_id == story_id, Scene.n >= start, Scene.n <= end)
        .order_by(Scene.n.asc())
    )).scalars().all()
    return {
        "scenes": [
            {"id": str(s.id), "n": s.n, "title": s.title, "summary": s.summary}
            for s in rows
        ]
    }


async def tool_find_inconsistencies(db: AsyncSession, story_id: uuid.UUID) -> dict[str, Any]:
    # Read-only: surface the most recent persisted insights for the story.
    # Implementation hooks into existing insight service when chat_agent is wired.
    from app.services import insight as insight_service
    rows = await insight_service.list_recent_insights(db, story_id, limit=20)
    return {
        "insights": [
            {"id": str(i.id), "type": getattr(i, "type", None), "summary": getattr(i, "summary", "")}
            for i in rows
        ]
    }


# OpenAI/LiteLLM tool spec shape — `function` per their function-calling format.
READ_TOOLS: list[dict[str, Any]] = [
    {
        "name": "get_scene",
        "description": "Fetch a single scene with metadata and full draft text.",
        "parameters": {
            "type": "object",
            "properties": {"scene_id": {"type": "string", "format": "uuid"}},
            "required": ["scene_id"],
        },
    },
    {
        "name": "list_characters",
        "description": "List all characters in this story (id, name, role).",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "get_character",
        "description": "Fetch a character including their notes.",
        "parameters": {
            "type": "object",
            "properties": {"character_id": {"type": "string", "format": "uuid"}},
            "required": ["character_id"],
        },
    },
    {
        "name": "get_scene_summaries",
        "description": "Flat list of scene summaries within a scene-number range.",
        "parameters": {
            "type": "object",
            "properties": {
                "start": {"type": "integer", "minimum": 1},
                "end": {"type": "integer", "minimum": 1},
            },
            "required": ["start", "end"],
        },
    },
    {
        "name": "find_inconsistencies",
        "description": "Read recent insights about plot or character inconsistencies.",
        "parameters": {"type": "object", "properties": {}},
    },
]


READ_TOOL_IMPLS = {
    "get_scene": tool_get_scene,
    "list_characters": tool_list_characters,
    "get_character": tool_get_character,
    "get_scene_summaries": tool_get_scene_summaries,
    "find_inconsistencies": tool_find_inconsistencies,
}


# Write tools and previews are added in Task 7.
WRITE_TOOLS: list[dict[str, Any]] = []
WRITE_TOOL_PREVIEWS: dict[str, Any] = {}
WRITE_TOOL_APPLIERS: dict[str, Any] = {}
```

If `insight_service.list_recent_insights` doesn't exist, look in `backend/app/services/insight.py` for the closest read-only function and adapt the import. If nothing fits, define a thin wrapper in that file in this same task.

- [ ] **Step 4: Run tests**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_chat_tools.py -v`
Expected: 6 passed (write-tool registry assertion will pass against the empty list in the second test only after Task 7 adds entries — comment that line out for now or expect FAIL on it specifically).

If the `WRITE_TOOLS` assertion in `test_write_tools_registry_shape` fails, mark it `@pytest.mark.skip(reason="completed in Task 7")` and remove the skip when Task 7 lands.

- [ ] **Step 5: Commit**

```bash
git add backend/app/ai/tools/ backend/tests/test_chat_tools.py
git commit -m "feat(chat): read tools registry and implementations"
```

---

### Task 7: Write tools with preview generation

**Files:**
- Modify: `backend/app/ai/tools/chat_tools.py`
- Modify: `backend/tests/test_chat_tools.py`

- [ ] **Step 1: Append failing write-tool tests**

Append to `backend/tests/test_chat_tools.py`:

```python
from app.ai.tools.chat_tools import (
    preview_edit_scene_draft,
    preview_propose_scene,
    preview_update_character_note,
    preview_summarize_scene,
)


@pytest.mark.asyncio
async def test_preview_edit_scene_draft_returns_unified_diff(db_session, sample_story, sample_scene):
    # Seed a draft
    from app.services import draft as draft_service
    await draft_service.upsert_draft(db_session, sample_story.id, sample_scene.id, sample_scene.org_id, "Old text.\n")
    preview = await preview_edit_scene_draft(
        db_session, sample_story.id, scene_id=sample_scene.id, new_text="New text.\n"
    )
    assert preview["kind"] == "diff"
    assert "@@" in preview["diff"]
    assert "+New text." in preview["diff"]


@pytest.mark.asyncio
async def test_preview_propose_scene(db_session, sample_story):
    preview = await preview_propose_scene(
        db_session, sample_story.id,
        after_id=None, summary="A new opening scene.", scene_n=1, title="Opening",
    )
    assert preview["kind"] == "scene_proposal"
    assert preview["summary"] == "A new opening scene."


@pytest.mark.asyncio
async def test_preview_update_character_note_appends(db_session, sample_story, sample_character):
    preview = await preview_update_character_note(
        db_session, sample_story.id,
        character_id=sample_character.id, note_text="New observation.", append=True,
    )
    assert preview["kind"] == "character_note"
    assert preview["after"].endswith("New observation.")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_chat_tools.py -k preview -v`
Expected: FAIL — `preview_edit_scene_draft` not found.

- [ ] **Step 3: Implement preview functions**

Append to `backend/app/ai/tools/chat_tools.py`:

```python
from app.services import character as character_service


async def preview_edit_scene_draft(
    db: AsyncSession, story_id: uuid.UUID, *, scene_id: uuid.UUID, new_text: str
) -> dict[str, Any]:
    scene = await scene_service.get_scene(db, story_id, scene_id)
    if scene is None:
        return {"error": "scene_not_found", "scene_id": str(scene_id)}
    existing_draft = await draft_service.get_draft(db, story_id, scene_id)
    old_text = existing_draft.content if existing_draft else ""
    diff = "".join(
        difflib.unified_diff(
            old_text.splitlines(keepends=True),
            new_text.splitlines(keepends=True),
            fromfile=f"scene-{scene.n}/before",
            tofile=f"scene-{scene.n}/after",
            n=2,
        )
    )
    return {
        "kind": "diff",
        "scene_id": str(scene_id),
        "scene_n": scene.n,
        "old_word_count": len(old_text.split()),
        "new_word_count": len(new_text.split()),
        "diff": diff,
    }


async def preview_propose_scene(
    db: AsyncSession, story_id: uuid.UUID, *, after_id: uuid.UUID | None,
    summary: str, scene_n: int, title: str = "",
) -> dict[str, Any]:
    return {
        "kind": "scene_proposal",
        "after_id": str(after_id) if after_id else None,
        "scene_n": scene_n,
        "title": title,
        "summary": summary,
    }


async def preview_update_character_note(
    db: AsyncSession, story_id: uuid.UUID, *, character_id: uuid.UUID, note_text: str, append: bool = True,
) -> dict[str, Any]:
    c = (await db.execute(
        select(Character).where(Character.id == character_id, Character.story_id == story_id)
    )).scalar_one_or_none()
    if c is None:
        return {"error": "character_not_found", "character_id": str(character_id)}
    before = getattr(c, "notes", "") or ""
    after = (before.rstrip() + "\n\n" + note_text).strip() if append else note_text
    return {
        "kind": "character_note",
        "character_id": str(character_id),
        "character_name": c.name,
        "append": append,
        "before": before,
        "after": after,
    }


async def preview_summarize_scene(
    db: AsyncSession, story_id: uuid.UUID, *, scene_id: uuid.UUID,
) -> dict[str, Any]:
    scene = await scene_service.get_scene(db, story_id, scene_id)
    if scene is None:
        return {"error": "scene_not_found", "scene_id": str(scene_id)}
    # Reuse existing summary graph in preview-only mode if available, otherwise just propose
    # to invoke the existing service at apply time.
    return {
        "kind": "summary_proposal",
        "scene_id": str(scene_id),
        "scene_n": scene.n,
        "current_summary": scene.summary,
        "note": "Preview is approximate; the summary is regenerated at apply time.",
    }


# Apply functions — invoke existing service paths only.
async def apply_edit_scene_draft(
    db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, *,
    scene_id: uuid.UUID, new_text: str,
) -> dict[str, Any]:
    draft = await draft_service.upsert_draft(db, story_id, scene_id, org_id, new_text)
    return {"applied": True, "scene_id": str(scene_id), "word_count": draft.word_count}


async def apply_propose_scene(
    db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, *,
    after_id: uuid.UUID | None, summary: str, scene_n: int, title: str = "",
) -> dict[str, Any]:
    scene = await scene_service.create_scene(
        db, story_id, org_id, {
            "title": title or summary[:60],
            "pov": "",
            "summary": summary,
        }
    )
    return {"applied": True, "scene_id": str(scene.id)}


async def apply_update_character_note(
    db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, *,
    character_id: uuid.UUID, note_text: str, append: bool = True,
) -> dict[str, Any]:
    updated = await character_service.update_notes(
        db, story_id, character_id, note_text, append=append
    )
    if updated is None:
        return {"applied": False, "error": "character_not_found"}
    return {"applied": True, "character_id": str(character_id)}


async def apply_summarize_scene(
    db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, *,
    scene_id: uuid.UUID,
) -> dict[str, Any]:
    # Trigger the existing summarization graph synchronously.
    from app.ai.graphs.summary_graph import run_summary
    summary = await run_summary(db, story_id, scene_id)
    return {"applied": True, "scene_id": str(scene_id), "summary": summary}


# Replace the module-level WRITE_TOOLS / WRITE_TOOL_PREVIEWS / WRITE_TOOL_APPLIERS
# placeholders from Task 6 with the populated dicts:
WRITE_TOOLS = [
    {
        "name": "edit_scene_draft",
        "description": "Replace a scene's draft text. Generates a unified diff for approval.",
        "parameters": {
            "type": "object",
            "properties": {
                "scene_id": {"type": "string", "format": "uuid"},
                "new_text": {"type": "string"},
            },
            "required": ["scene_id", "new_text"],
        },
    },
    {
        "name": "propose_scene",
        "description": "Add a new scene scaffold after a given scene id (or at start if null).",
        "parameters": {
            "type": "object",
            "properties": {
                "after_id": {"type": ["string", "null"], "format": "uuid"},
                "summary": {"type": "string"},
                "scene_n": {"type": "integer", "minimum": 1},
                "title": {"type": "string"},
            },
            "required": ["summary", "scene_n"],
        },
    },
    {
        "name": "update_character_note",
        "description": "Append (or replace) a character's notes.",
        "parameters": {
            "type": "object",
            "properties": {
                "character_id": {"type": "string", "format": "uuid"},
                "note_text": {"type": "string"},
                "append": {"type": "boolean", "default": True},
            },
            "required": ["character_id", "note_text"],
        },
    },
    {
        "name": "summarize_scene",
        "description": "Regenerate a scene's summary using the existing summary graph.",
        "parameters": {
            "type": "object",
            "properties": {"scene_id": {"type": "string", "format": "uuid"}},
            "required": ["scene_id"],
        },
    },
]

WRITE_TOOL_PREVIEWS = {
    "edit_scene_draft": preview_edit_scene_draft,
    "propose_scene": preview_propose_scene,
    "update_character_note": preview_update_character_note,
    "summarize_scene": preview_summarize_scene,
}

WRITE_TOOL_APPLIERS = {
    "edit_scene_draft": apply_edit_scene_draft,
    "propose_scene": apply_propose_scene,
    "update_character_note": apply_update_character_note,
    "summarize_scene": apply_summarize_scene,
}
```

If `character_service.update_notes` doesn't exist, define it in `backend/app/services/character.py` as a small append-or-set helper following the `upsert_draft` shape.

- [ ] **Step 4: Remove the skip from `test_write_tools_registry_shape` if added in Task 6**

- [ ] **Step 5: Run all tool tests**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_chat_tools.py -v`
Expected: all passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/ai/tools/chat_tools.py backend/tests/test_chat_tools.py backend/app/services/character.py
git commit -m "feat(chat): write tools with preview/apply functions"
```

---

## Phase D — Backend LLM tier and chat agent

### Task 8: Add chat tier and tool-streaming helper to llm.py

**Files:**
- Modify: `backend/app/ai/llm.py`
- Modify: `backend/app/config.py`
- Test: `backend/tests/test_llm_errors.py` (extend) or new `test_chat_llm.py`

- [ ] **Step 1: Write failing test for tier registration**

Append to `backend/tests/test_llm_errors.py`:

```python
def test_chat_task_type_has_tier_mapping():
    from app.ai.llm import TASK_MODEL_MAP, TASK_TIER_MAP
    assert "chat" in TASK_TIER_MAP
    assert "chat" in TASK_MODEL_MAP
    assert TASK_TIER_MAP["chat"] in TASK_MODEL_MAP["chat"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_llm_errors.py::test_chat_task_type_has_tier_mapping -v`
Expected: FAIL — `'chat' not in TASK_TIER_MAP`.

- [ ] **Step 3: Add config knobs**

Modify `backend/app/config.py`. In the `Settings` class, add:

```python
ai_model_chat: str = "openrouter/anthropic/claude-3-5-haiku"
ai_chat_max_input_tokens: int = 4000
ai_chat_max_output_tokens: int = 1000
```

- [ ] **Step 4: Wire chat into TASK_*_MAP**

Modify `backend/app/ai/llm.py`. In `TASK_MODEL_MAP`, add a new entry:

```python
"chat": {
    "fast": settings.ai_model_chat,
    "standard": settings.ai_model_chat,
    "powerful": settings.ai_model_chat,
},
```

In `TASK_TIER_MAP`, add:

```python
"chat": "fast",
```

- [ ] **Step 5: Add a tool-calling helper**

Append to `backend/app/ai/llm.py`:

```python
async def call_llm_with_tools(
    messages: list[dict],
    tools: list[dict],
    *,
    temperature: float = 0.4,
    max_tokens: int | None = None,
) -> dict:
    """Single-turn call that may produce text, tool_calls, or both.

    Returns a dict with keys: content (str | None), tool_calls (list[dict] | None),
    finish_reason (str), usage (dict | None).
    """
    tier = TASK_TIER_MAP["chat"]
    model = TASK_MODEL_MAP["chat"][tier]
    semaphore = _get_semaphore()
    start_time = time.monotonic()
    last_error = None

    fallback_models = _get_fallback_models()
    models_to_try = [model] + [m for m in fallback_models if m != model]
    out_tokens = max_tokens or settings.ai_chat_max_output_tokens

    for attempt_model in models_to_try:
        for attempt in range(MAX_RETRIES + 1):
            try:
                async with semaphore:
                    response = await litellm.acompletion(
                        model=attempt_model,
                        messages=messages,
                        tools=[{"type": "function", "function": t} for t in tools],
                        temperature=temperature,
                        max_tokens=out_tokens,
                        timeout=120,
                    )
                choice = response.choices[0]
                msg = choice.message
                tool_calls = []
                if getattr(msg, "tool_calls", None):
                    for tc in msg.tool_calls:
                        tool_calls.append({
                            "id": tc.id,
                            "name": tc.function.name,
                            "arguments": json.loads(tc.function.arguments or "{}"),
                        })
                _record_llm_call(
                    task_type="chat",
                    tier=tier,
                    model=attempt_model,
                    outcome="success",
                    duration=time.monotonic() - start_time,
                    response=response,
                )
                return {
                    "content": msg.content,
                    "tool_calls": tool_calls or None,
                    "finish_reason": choice.finish_reason,
                    "usage": getattr(response, "usage", None),
                }
            except Exception as exc:
                error_info = classify_error(exc)
                last_error = error_info
                if not error_info.retryable:
                    raise
                if error_info.category == "rate_limit":
                    break  # next model
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(error_info.retry_after or (BASE_RETRY_DELAY * (2 ** attempt)))

    _record_llm_call(
        task_type="chat",
        tier=tier,
        model=None,
        outcome="error",
        duration=time.monotonic() - start_time,
        error_category=(last_error.category if last_error else "unknown"),
    )
    raise RuntimeError(f"chat LLM call failed: {last_error.message if last_error else 'unknown'}")
```

- [ ] **Step 6: Run tests**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_llm_errors.py -v`
Expected: all passing including new tier check.

- [ ] **Step 7: Commit**

```bash
git add backend/app/ai/llm.py backend/app/config.py backend/tests/test_llm_errors.py
git commit -m "feat(chat): add chat tier to LLM router + tool-calling helper"
```

---

### Task 9: Adaptive context loader

**Files:**
- Modify: `backend/app/ai/context/assembler.py`
- Test: `backend/tests/test_context.py` (extend)

- [ ] **Step 1: Write failing test**

Append to `backend/tests/test_context.py`:

```python
@pytest.mark.asyncio
async def test_build_chat_context_medium_includes_scene_list_and_chars(
    db_session, sample_story, sample_scene, sample_character
):
    from app.ai.context.assembler import build_chat_context
    ctx = await build_chat_context(db_session, sample_story.id, active_scene_id=None)
    assert sample_story.title in ctx
    assert sample_character.name in ctx
    assert str(sample_scene.n) in ctx


@pytest.mark.asyncio
async def test_build_chat_context_includes_active_scene_draft(
    db_session, sample_story, sample_scene
):
    from app.services import draft as draft_service
    await draft_service.upsert_draft(db_session, sample_story.id, sample_scene.id, sample_scene.org_id, "ACTIVE_DRAFT_TEXT")
    from app.ai.context.assembler import build_chat_context
    ctx = await build_chat_context(db_session, sample_story.id, active_scene_id=sample_scene.id)
    assert "ACTIVE_DRAFT_TEXT" in ctx
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_context.py -k chat -v`
Expected: FAIL — `build_chat_context` not defined.

- [ ] **Step 3: Implement `build_chat_context`**

Read `backend/app/ai/context/assembler.py` to understand its existing helpers, then append:

```python
async def build_chat_context(
    db: "AsyncSession",
    story_id: "uuid.UUID",
    *,
    active_scene_id: "uuid.UUID | None" = None,
) -> str:
    """Adaptive medium-tier context for the chat agent.

    Always: title + logline + genres + structure_type + target_words + flat scene list + char roster.
    If active_scene_id given: also include that scene's draft.
    Refreshed every turn (it is small).
    """
    from app.models.story import Story
    from app.models.scene import Scene
    from app.models.character import Character
    from app.services import draft as draft_service

    story = (await db.execute(select(Story).where(Story.id == story_id))).scalar_one_or_none()
    if story is None:
        return ""

    scenes = (await db.execute(
        select(Scene).where(Scene.story_id == story_id).order_by(Scene.n.asc())
    )).scalars().all()
    chars = (await db.execute(
        select(Character).where(Character.story_id == story_id).order_by(Character.name.asc())
    )).scalars().all()

    parts = [
        f"# Story: {story.title}",
        f"Logline: {story.logline or ''}",
        f"Genres: {', '.join(story.genres or [])}",
        f"Structure: {story.structure_type}; target words: {story.target_words}",
        "",
        "## Scenes (n · title — summary)",
        *[f"{s.n} · {s.title} — {s.summary[:120]}" for s in scenes],
        "",
        "## Characters",
        *[f"- {c.name} ({getattr(c, 'role', '') or 'unknown'})" for c in chars],
    ]

    if active_scene_id is not None:
        active = next((s for s in scenes if s.id == active_scene_id), None)
        if active is not None:
            draft = await draft_service.get_draft(db, story_id, active_scene_id)
            parts += [
                "",
                f"## Active scene draft (scene {active.n} · {active.title})",
                draft.content if draft else "(no draft yet)",
            ]

    return "\n".join(parts)
```

(Adjust imports to match existing style in `assembler.py`. Pull `select` from `sqlalchemy` already-imported there.)

- [ ] **Step 4: Run tests**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_context.py -k chat -v`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/ai/context/assembler.py backend/tests/test_context.py
git commit -m "feat(chat): adaptive medium-tier context loader"
```

---

### Task 10: LangGraph chat agent

**Files:**
- Create: `backend/app/ai/graphs/chat_agent.py`
- Test: `backend/tests/test_ai_graphs/test_chat_agent.py`

- [ ] **Step 1: Write failing tests with a mocked LLM**

`backend/tests/test_ai_graphs/test_chat_agent.py`:

```python
from unittest.mock import AsyncMock, patch

import pytest

from app.ai.graphs.chat_agent import run_chat_turn
from app.models.chat_message import ChatMessageRole, ToolCallStatus


@pytest.mark.asyncio
async def test_run_chat_turn_text_only(db_session, sample_org, sample_story, monkeypatch):
    async def fake_call(messages, tools, **kwargs):
        return {"content": "Hello back!", "tool_calls": None, "finish_reason": "stop", "usage": None}

    monkeypatch.setattr("app.ai.graphs.chat_agent.call_llm_with_tools", fake_call)

    from app.services import chat_service
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    events = []
    async for ev in run_chat_turn(
        db_session,
        org_id=sample_org.id,
        story_id=sample_story.id,
        thread=thread,
        user_text="Hi.",
        active_scene_id=None,
    ):
        events.append(ev)

    types = [e["type"] for e in events]
    assert "chat.user.persisted" in types
    assert "chat.message.complete" in types
    assert any(e["data"].get("content") == "Hello back!" for e in events if e["type"] == "chat.message.complete")


@pytest.mark.asyncio
async def test_run_chat_turn_executes_read_tool_then_responds(
    db_session, sample_org, sample_story, sample_scene, monkeypatch
):
    calls = {"n": 0}

    async def fake_call(messages, tools, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            return {
                "content": None,
                "tool_calls": [{
                    "id": "tc1",
                    "name": "get_scene",
                    "arguments": {"scene_id": str(sample_scene.id)},
                }],
                "finish_reason": "tool_calls",
                "usage": None,
            }
        return {"content": "Done.", "tool_calls": None, "finish_reason": "stop", "usage": None}

    monkeypatch.setattr("app.ai.graphs.chat_agent.call_llm_with_tools", fake_call)

    from app.services import chat_service
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    events = []
    async for ev in run_chat_turn(
        db_session, org_id=sample_org.id, story_id=sample_story.id, thread=thread,
        user_text="Show scene 1.", active_scene_id=None,
    ):
        events.append(ev)

    types = [e["type"] for e in events]
    assert "chat.tool.executed" in types
    assert "chat.message.complete" in types


@pytest.mark.asyncio
async def test_run_chat_turn_proposes_write_and_pauses(
    db_session, sample_org, sample_story, sample_scene, monkeypatch
):
    async def fake_call(messages, tools, **kwargs):
        return {
            "content": "Let me edit scene 1.",
            "tool_calls": [{
                "id": "tc1",
                "name": "edit_scene_draft",
                "arguments": {"scene_id": str(sample_scene.id), "new_text": "X"},
            }],
            "finish_reason": "tool_calls",
            "usage": None,
        }

    monkeypatch.setattr("app.ai.graphs.chat_agent.call_llm_with_tools", fake_call)

    from app.services import chat_service
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    events = []
    async for ev in run_chat_turn(
        db_session, org_id=sample_org.id, story_id=sample_story.id, thread=thread,
        user_text="edit it", active_scene_id=None,
    ):
        events.append(ev)

    types = [e["type"] for e in events]
    assert "chat.tool_call.proposed" in types
    # Loop must pause (no chat.message.complete) — turn ends pending approval.
    assert "chat.message.complete" not in types
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_ai_graphs/test_chat_agent.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the agent**

`backend/app/ai/graphs/chat_agent.py`:

```python
"""Chat agent — tool-calling loop over the curated chat tools.

Read tools auto-execute and feed their results back into the agent.
Write tools persist as proposed assistant messages and pause the loop;
mutation only happens via apply_tool_call (REST endpoint).
"""
from __future__ import annotations

import uuid
from typing import Any, AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.context.assembler import build_chat_context
from app.ai.llm import call_llm_with_tools
from app.ai.tools.chat_tools import (
    READ_TOOLS,
    READ_TOOL_IMPLS,
    WRITE_TOOLS,
    WRITE_TOOL_PREVIEWS,
)
from app.models.chat_message import ChatMessageRole, ToolCallStatus
from app.models.chat_thread import ChatThread
from app.services import chat_service


SYSTEM_INSTRUCTIONS = (
    "You are the BeatLume story assistant. You help the user think about, "
    "explore, and refine their story. Use read tools freely to fetch context. "
    "When proposing changes, use write tools — they will be shown to the user "
    "as approval cards. Do not invent tools; only call those provided. "
    "Be concise."
)

MAX_TOOL_LOOP_ITERATIONS = 6


async def run_chat_turn(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    story_id: uuid.UUID,
    thread: ChatThread,
    user_text: str,
    active_scene_id: uuid.UUID | None,
) -> AsyncIterator[dict[str, Any]]:
    """Run a single chat turn. Yields SSE-shaped events: {type, data}."""

    # 1) Persist user message
    user_msg = await chat_service.persist_message(
        db, org_id, thread.id, ChatMessageRole.user, content=user_text
    )
    yield {"type": "chat.user.persisted", "data": {"id": str(user_msg.id)}}

    # 2) Build adaptive context
    story_context = await build_chat_context(db, story_id, active_scene_id=active_scene_id)
    history_rows, _ = await chat_service.list_messages(db, thread.id, limit=100)

    # 3) Build LiteLLM message list
    messages: list[dict] = [
        {"role": "system", "content": SYSTEM_INSTRUCTIONS + "\n\n" + story_context},
    ]
    for m in history_rows:
        if m.role == ChatMessageRole.user and m.content:
            messages.append({"role": "user", "content": m.content})
        elif m.role == ChatMessageRole.assistant:
            entry = {"role": "assistant", "content": m.content or ""}
            if m.tool_calls:
                entry["tool_calls"] = [
                    {"id": tc.get("id", "x"), "type": "function",
                     "function": {"name": tc["name"], "arguments": str(tc.get("arguments", {}))}}
                    for tc in m.tool_calls
                ]
            messages.append(entry)
        elif m.role == ChatMessageRole.tool and m.tool_call_result is not None:
            messages.append({
                "role": "tool",
                "tool_call_id": (m.tool_calls or [{}])[0].get("id", "x") if m.tool_calls else "x",
                "content": str(m.tool_call_result),
            })

    tools = READ_TOOLS + WRITE_TOOLS
    write_names = {t["name"] for t in WRITE_TOOLS}

    # 4) Tool-calling loop
    for _ in range(MAX_TOOL_LOOP_ITERATIONS):
        result = await call_llm_with_tools(messages, tools)
        tcs = result.get("tool_calls") or []

        # Case A — no tool calls, model produced final assistant text
        if not tcs:
            assistant = await chat_service.persist_message(
                db, org_id, thread.id, ChatMessageRole.assistant, content=result.get("content") or "",
            )
            yield {"type": "chat.message.complete", "data": {
                "id": str(assistant.id),
                "content": assistant.content,
            }}
            return

        # Case B — write tool requested: persist as proposed and pause
        write_tcs = [tc for tc in tcs if tc["name"] in write_names]
        if write_tcs:
            tc = write_tcs[0]  # one write per turn (multiple = future scope)
            preview_fn = WRITE_TOOL_PREVIEWS[tc["name"]]
            preview = await preview_fn(db, story_id, **tc["arguments"])
            persisted = await chat_service.persist_message(
                db, org_id, thread.id, ChatMessageRole.assistant,
                content=result.get("content"),
                tool_calls=[tc],
                tool_call_status=ToolCallStatus.proposed,
                tool_call_result=preview,
            )
            yield {"type": "chat.tool_call.proposed", "data": {
                "id": str(persisted.id),
                "tool_name": tc["name"],
                "preview": preview,
            }}
            return

        # Case C — read tools: execute all, append tool messages, loop
        # (Append assistant message that requested the calls, for protocol fidelity)
        messages.append({
            "role": "assistant",
            "content": result.get("content") or "",
            "tool_calls": [
                {"id": tc["id"], "type": "function",
                 "function": {"name": tc["name"], "arguments": str(tc["arguments"])}}
                for tc in tcs
            ],
        })
        for tc in tcs:
            impl = READ_TOOL_IMPLS.get(tc["name"])
            if impl is None:
                tool_result: dict[str, Any] = {"error": "unknown_tool"}
            else:
                try:
                    args = {**tc["arguments"]}
                    # Coerce uuid strings → uuid.UUID where the impl expects it
                    for k, v in list(args.items()):
                        if isinstance(v, str) and len(v) == 36 and "-" in v:
                            try:
                                args[k] = uuid.UUID(v)
                            except ValueError:
                                pass
                    tool_result = await impl(db, story_id, **args)
                except Exception as exc:  # surface as tool error
                    tool_result = {"error": "tool_failed", "message": str(exc)[:200]}

            await chat_service.persist_message(
                db, org_id, thread.id, ChatMessageRole.tool,
                tool_calls=[tc], tool_call_result=tool_result,
            )
            yield {"type": "chat.tool.executed", "data": {
                "tool_name": tc["name"],
                "result": tool_result,
            }}
            messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": str(tool_result),
            })

    # Loop bailout — over iteration limit. Persist a fallback assistant message.
    fallback = await chat_service.persist_message(
        db, org_id, thread.id, ChatMessageRole.assistant,
        content="(I hit the tool-call iteration limit. Try narrowing the question.)",
    )
    yield {"type": "chat.message.complete", "data": {"id": str(fallback.id), "content": fallback.content}}
```

- [ ] **Step 4: Run tests**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_ai_graphs/test_chat_agent.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/ai/graphs/chat_agent.py backend/tests/test_ai_graphs/test_chat_agent.py
git commit -m "feat(chat): LangGraph-style chat agent with tool-calling loop"
```

---

## Phase E — Backend send-message + apply/reject

### Task 11: SSE streaming send-message endpoint

**Files:**
- Modify: `backend/app/api/chat.py`
- Modify: `backend/tests/test_chat_api.py`

- [ ] **Step 1: Write failing endpoint test**

Append to `backend/tests/test_chat_api.py`:

```python
@pytest.mark.asyncio
async def test_send_message_streams_user_persisted_then_complete(
    client, auth_headers, db_session, sample_org, sample_story, monkeypatch
):
    # Stub the agent so the test doesn't hit a real LLM
    async def fake_run(db, *, org_id, story_id, thread, user_text, active_scene_id):
        yield {"type": "chat.user.persisted", "data": {"id": "u1"}}
        yield {"type": "chat.message.complete", "data": {"id": "a1", "content": "ok"}}

    import app.api.chat as chat_api
    monkeypatch.setattr(chat_api, "run_chat_turn", fake_run)

    from app.services import chat_service
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    resp = await client.post(
        f"/api/chat/threads/{thread.id}/messages",
        headers=auth_headers,
        json={"content": "hello", "active_scene_id": None},
    )
    assert resp.status_code == 200
    body = resp.text
    assert "event: chat.user.persisted" in body
    assert "event: chat.message.complete" in body
```

If the test client's response handling for streaming differs, follow the pattern in `backend/tests/test_sse.py` (use `httpx.AsyncClient.stream` or `aread()` accordingly).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_chat_api.py -k send_message -v`
Expected: FAIL — endpoint missing.

- [ ] **Step 3: Add the streaming endpoint**

Modify `backend/app/api/chat.py`:

```python
import json

from fastapi.responses import StreamingResponse

from app.ai.graphs.chat_agent import run_chat_turn
from app.schemas.chat import SendMessageRequest


@thread_router.post("/threads/{thread_id}/messages")
async def send_message(
    thread_id: uuid.UUID,
    body: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    org: Organization = Depends(get_current_org),
):
    thread = await chat_service.get_thread(db, thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    async def event_stream():
        async for event in run_chat_turn(
            db,
            org_id=org.id,
            story_id=thread.story_id,
            thread=thread,
            user_text=body.content,
            active_scene_id=body.active_scene_id,
        ):
            event_type = event["type"]
            data = json.dumps(event["data"])
            yield f"event: {event_type}\ndata: {data}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

- [ ] **Step 4: Run tests**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_chat_api.py -v`
Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/chat.py backend/tests/test_chat_api.py
git commit -m "feat(chat): SSE streaming send-message endpoint"
```

---

### Task 12: apply_tool_call and reject_tool_call services + endpoints

**Files:**
- Modify: `backend/app/services/chat_service.py`
- Modify: `backend/app/api/chat.py`
- Modify: `backend/tests/test_chat_service.py`
- Modify: `backend/tests/test_chat_api.py`

- [ ] **Step 1: Write failing service tests**

Append to `backend/tests/test_chat_service.py`:

```python
from app.ai.tools.chat_tools import preview_edit_scene_draft


@pytest.mark.asyncio
async def test_apply_tool_call_executes_existing_service(
    db_session, sample_org, sample_story, sample_scene
):
    from app.services import draft as draft_service
    await draft_service.upsert_draft(db_session, sample_story.id, sample_scene.id, sample_scene.org_id, "old\n")

    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    preview = await preview_edit_scene_draft(
        db_session, sample_story.id, scene_id=sample_scene.id, new_text="new\n"
    )
    msg = await chat_service.persist_message(
        db_session, sample_org.id, thread.id, ChatMessageRole.assistant,
        content="x",
        tool_calls=[{"id": "t1", "name": "edit_scene_draft",
                     "arguments": {"scene_id": str(sample_scene.id), "new_text": "new\n"}}],
        tool_call_status=ToolCallStatus.proposed,
        tool_call_result=preview,
    )

    result = await chat_service.apply_tool_call(db_session, msg.id, sample_org.id, sample_story.id)
    assert result["applied"] is True
    await db_session.refresh(msg)
    assert msg.tool_call_status == ToolCallStatus.applied
    draft = await draft_service.get_draft(db_session, sample_story.id, sample_scene.id)
    assert draft.content == "new\n"


@pytest.mark.asyncio
async def test_reject_tool_call_marks_rejected(db_session, sample_org, sample_story):
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    msg = await chat_service.persist_message(
        db_session, sample_org.id, thread.id, ChatMessageRole.assistant,
        content="x",
        tool_calls=[{"id": "t1", "name": "edit_scene_draft", "arguments": {}}],
        tool_call_status=ToolCallStatus.proposed,
        tool_call_result={},
    )
    await chat_service.reject_tool_call(db_session, msg.id, reason="not what I want")
    await db_session.refresh(msg)
    assert msg.tool_call_status == ToolCallStatus.rejected
    assert msg.tool_call_result.get("rejection_reason") == "not what I want"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_chat_service.py -k tool_call -v`
Expected: FAIL — `apply_tool_call` not defined.

- [ ] **Step 3: Implement apply/reject in service**

Append to `backend/app/services/chat_service.py`:

```python
from app.ai.tools.chat_tools import WRITE_TOOL_APPLIERS


async def apply_tool_call(
    db: AsyncSession, message_id: uuid.UUID, org_id: uuid.UUID, story_id: uuid.UUID
) -> dict:
    msg = await get_message(db, message_id)
    if msg is None or msg.tool_call_status != ToolCallStatus.proposed:
        return {"applied": False, "error": "not_proposed_or_missing"}
    if not msg.tool_calls:
        return {"applied": False, "error": "no_tool_calls"}
    tc = msg.tool_calls[0]
    applier = WRITE_TOOL_APPLIERS.get(tc["name"])
    if applier is None:
        return {"applied": False, "error": "unknown_tool"}

    args = {**tc.get("arguments", {})}
    for k, v in list(args.items()):
        if isinstance(v, str) and len(v) == 36 and "-" in v:
            try:
                args[k] = uuid.UUID(v)
            except ValueError:
                pass

    result = await applier(db, story_id, org_id, **args)
    msg.tool_call_status = ToolCallStatus.applied
    msg.tool_call_result = {**(msg.tool_call_result or {}), "applied_result": result}
    await db.commit()
    await db.refresh(msg)
    return result


async def reject_tool_call(
    db: AsyncSession, message_id: uuid.UUID, reason: str | None = None
) -> bool:
    msg = await get_message(db, message_id)
    if msg is None or msg.tool_call_status != ToolCallStatus.proposed:
        return False
    msg.tool_call_status = ToolCallStatus.rejected
    if reason:
        msg.tool_call_result = {**(msg.tool_call_result or {}), "rejection_reason": reason}
    await db.commit()
    return True
```

- [ ] **Step 4: Add apply/reject endpoints**

Modify `backend/app/api/chat.py` — append:

```python
from app.schemas.chat import RejectToolCallRequest


@thread_router.post("/tool_calls/{message_id}/apply")
async def apply_tool_call(
    message_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    org: Organization = Depends(get_current_org),
):
    msg = await chat_service.get_message(db, message_id)
    if msg is None:
        raise HTTPException(status_code=404, detail="Tool call not found")
    thread = await chat_service.get_thread(db, msg.thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")
    result = await chat_service.apply_tool_call(db, message_id, org.id, thread.story_id)
    if result.get("applied") is False:
        raise HTTPException(status_code=409, detail=result)
    return result


@thread_router.post("/tool_calls/{message_id}/reject")
async def reject_tool_call(
    message_id: uuid.UUID,
    body: RejectToolCallRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    ok = await chat_service.reject_tool_call(db, message_id, reason=body.reason)
    if not ok:
        raise HTTPException(status_code=409, detail={"applied": False, "error": "not_proposed_or_missing"})
    return {"rejected": True}
```

- [ ] **Step 5: Add API tests**

Append to `backend/tests/test_chat_api.py`:

```python
@pytest.mark.asyncio
async def test_apply_tool_call_endpoint(
    client, auth_headers, db_session, sample_org, sample_story, sample_scene
):
    from app.services import chat_service, draft as draft_service
    from app.models.chat_message import ChatMessageRole, ToolCallStatus

    await draft_service.upsert_draft(db_session, sample_story.id, sample_scene.id, sample_scene.org_id, "old\n")
    thread = await chat_service.create_thread(db_session, sample_org.id, sample_story.id)
    msg = await chat_service.persist_message(
        db_session, sample_org.id, thread.id, ChatMessageRole.assistant,
        content="x",
        tool_calls=[{"id": "t1", "name": "edit_scene_draft",
                     "arguments": {"scene_id": str(sample_scene.id), "new_text": "new\n"}}],
        tool_call_status=ToolCallStatus.proposed,
        tool_call_result={},
    )
    resp = await client.post(
        f"/api/chat/tool_calls/{msg.id}/apply",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["applied"] is True
```

- [ ] **Step 6: Run all chat tests**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/test_chat_service.py tests/test_chat_api.py -v`
Expected: all passed.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/chat_service.py backend/app/api/chat.py backend/tests/test_chat_service.py backend/tests/test_chat_api.py
git commit -m "feat(chat): apply/reject tool-call endpoints + service"
```

---

## Phase F — Frontend types and API client

### Task 13: TypeScript types

**Files:**
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Read the current types file**

Run: `head -50 frontend/src/types.ts`

- [ ] **Step 2: Append the chat types**

Append to `frontend/src/types.ts`:

```typescript
export type ChatMessageRole = 'user' | 'assistant' | 'tool'
export type ToolCallStatus = 'proposed' | 'applied' | 'rejected'

export interface ChatThread {
  id: string
  story_id: string
  title: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface ChatToolCall {
  id?: string
  name: string
  arguments: Record<string, unknown>
}

export interface ChatMessage {
  id: string
  thread_id: string
  role: ChatMessageRole
  content: string | null
  tool_calls: ChatToolCall[] | null
  tool_call_status: ToolCallStatus | null
  tool_call_result: Record<string, unknown> | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts
git commit -m "feat(chat): TypeScript types for ChatThread, ChatMessage, ChatToolCall"
```

---

### Task 14: TanStack Query hooks for chat

**Files:**
- Create: `frontend/src/api/chat.ts`

- [ ] **Step 1: Read the existing api/client and another api/* file for the pattern**

Run: `head -60 frontend/src/api/client.ts && echo --- && head -60 frontend/src/api/stories.ts`

- [ ] **Step 2: Implement the hooks**

`frontend/src/api/chat.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { ChatMessage, ChatThread } from '../types'

interface ListResponse<T> { items: T[]; total: number }

export function chatThreadsKey(storyId: string) {
  return ['chat', 'threads', storyId] as const
}

export function chatMessagesKey(threadId: string) {
  return ['chat', 'messages', threadId] as const
}

export function useChatThreads(storyId: string) {
  return useQuery({
    queryKey: chatThreadsKey(storyId),
    queryFn: async () =>
      apiFetch<ListResponse<ChatThread>>(`/api/stories/${storyId}/chat/threads`),
  })
}

export function useChatMessages(threadId: string | null) {
  return useQuery({
    enabled: Boolean(threadId),
    queryKey: chatMessagesKey(threadId ?? ''),
    queryFn: async () =>
      apiFetch<ListResponse<ChatMessage>>(`/api/chat/threads/${threadId}/messages`),
  })
}

export function useCreateChatThread(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (title?: string) =>
      apiFetch<ChatThread>(`/api/stories/${storyId}/chat/threads`, {
        method: 'POST',
        body: JSON.stringify({ title: title ?? null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatThreadsKey(storyId) })
    },
  })
}

export function useArchiveChatThread(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (threadId: string) =>
      apiFetch<void>(`/api/chat/threads/${threadId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatThreadsKey(storyId) })
    },
  })
}

/** Streams the assistant response via SSE. Returns AsyncIterable of events. */
export async function* sendChatMessageStream(
  threadId: string,
  content: string,
  activeSceneId: string | null,
): AsyncGenerator<{ type: string; data: any }> {
  const res = await fetch(`/api/chat/threads/${threadId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ content, active_scene_id: activeSceneId }),
  })
  if (!res.ok || !res.body) {
    throw new Error(`send failed: ${res.status}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const raw of events) {
      const typeLine = raw.split('\n').find((l) => l.startsWith('event: '))
      const dataLine = raw.split('\n').find((l) => l.startsWith('data: '))
      if (!typeLine || !dataLine) continue
      yield { type: typeLine.slice(7), data: JSON.parse(dataLine.slice(6)) }
    }
  }
}

export function useApplyToolCall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (messageId: string) =>
      apiFetch<{ applied: boolean }>(`/api/chat/tool_calls/${messageId}/apply`, {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat'] }),
  })
}

export function useRejectToolCall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ messageId, reason }: { messageId: string; reason?: string }) =>
      apiFetch<{ rejected: boolean }>(`/api/chat/tool_calls/${messageId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason ?? null }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat'] }),
  })
}

// Re-export the auth header helper from client if not already public.
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('beatlume.access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}
```

If `apiFetch` already attaches auth, keep `authHeaders()` consistent with that source. Read `frontend/src/api/client.ts` for the canonical token storage key — adjust if the actual key differs.

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/chat.ts
git commit -m "feat(chat): TanStack Query hooks + SSE stream client for chat"
```

---

## Phase G — Frontend store and SSE

### Task 15: Zustand additions for chat tab and composer drafts

**Files:**
- Modify: `frontend/src/store.ts`

- [ ] **Step 1: Read the current store**

Run: `head -120 frontend/src/store.ts`

- [ ] **Step 2: Add new state**

In `frontend/src/store.ts`, in the UI slice interface and implementation:

```typescript
// In the interface:
aiPanelTab: 'chat' | 'tasks'
setAIPanelTab: (tab: 'chat' | 'tasks') => void

selectedChatThreadId: string | null
setSelectedChatThreadId: (id: string | null) => void

chatComposerDrafts: Record<string, string> // threadId -> draft
setChatComposerDraft: (threadId: string, draft: string) => void

unreadAssistantMessages: number
markChatUnread: (n: number) => void
clearChatUnread: () => void
```

In the create call default state, add:
```typescript
aiPanelTab: 'chat',
selectedChatThreadId: null,
chatComposerDrafts: {},
unreadAssistantMessages: 0,
```

And the action implementations:
```typescript
setAIPanelTab: (tab) => set({ aiPanelTab: tab }),
setSelectedChatThreadId: (id) => set({ selectedChatThreadId: id }),
setChatComposerDraft: (threadId, draft) =>
  set((s) => ({ chatComposerDrafts: { ...s.chatComposerDrafts, [threadId]: draft } })),
markChatUnread: (n) => set({ unreadAssistantMessages: n }),
clearChatUnread: () => set({ unreadAssistantMessages: 0 }),
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/store.ts
git commit -m "feat(chat): Zustand state for chat tab + selected thread + composer drafts"
```

---

### Task 16: SSE event handling for chat events

**Files:**
- Modify: `frontend/src/hooks/useSSE.ts`

- [ ] **Step 1: Read the current useSSE hook**

Run: `cat frontend/src/hooks/useSSE.ts`

- [ ] **Step 2: Add chat event handlers**

`useSSE` currently routes events into the `aiTasks` slice. The send-message endpoint is a *direct SSE stream* (not Redis pubsub) consumed by `sendChatMessageStream` in `chat.ts`, so `useSSE` doesn't need to subscribe to chat tokens — but it does need to handle background `chat.tool.executed` and message-cache invalidation events that the agent might publish to Redis later (out of scope here).

For v1, add only this minimal change to `useSSE.ts`: a no-op handler for `chat.*` events so they don't trigger console warnings. The actual chat stream consumption happens inside `ChatThread.tsx` via `sendChatMessageStream`.

In the existing event-routing switch:

```typescript
default:
  if (eventType.startsWith('chat.')) {
    // Per-stream handling lives in ChatThread.tsx; ignore here.
    return
  }
  // existing default behavior
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useSSE.ts
git commit -m "feat(chat): silence chat.* events in global useSSE handler"
```

---

## Phase H — Frontend panel shell

### Task 17: Refactor AIPanel into a tabbed shell

**Files:**
- Modify: `frontend/src/components/ai/AIPanel.tsx`

- [ ] **Step 1: Read the current AIPanel**

Already known from prior work — the file lives at `frontend/src/components/ai/AIPanel.tsx`. The existing `AIPanel` component renders the tasks UI directly inside the `<aside>`. Refactor: extract the tasks UI into a `TasksTab` component below `AIPanel`, then have `AIPanel` render tabs and switch between `TasksTab` and `ChatTab` (Task 18).

- [ ] **Step 2: Apply the refactor**

In `frontend/src/components/ai/AIPanel.tsx`:

a) Change `PANEL_WIDTH` from 360 to 420.

b) Extract the entire body of the existing `AIPanel` (everything inside `<aside>` after the header — `runRowLabel`, `runGrid`, `list`, `footer`, etc.) into a new function `TasksTab({ storyId }: { storyId: string })` defined in the same file. Have it `return <></>` wrapping the existing JSX.

c) Replace the `AIPanel` body with a tabbed shell:

```typescript
export function AIPanel({ storyId }: { storyId: string }) {
  const aiPanelOpen = useStore((s) => s.aiPanelOpen)
  const setAIPanelOpen = useStore((s) => s.setAIPanelOpen)
  const tab = useStore((s) => s.aiPanelTab)
  const setTab = useStore((s) => s.setAIPanelTab)

  if (!aiPanelOpen) return null

  return (
    <aside style={panelShell} aria-label="AI panel">
      <div style={panelHead}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={tabBtn(tab === 'chat')}
            onClick={() => setTab('chat')}
            aria-pressed={tab === 'chat'}
          >
            Chat
          </button>
          <button
            style={tabBtn(tab === 'tasks')}
            onClick={() => setTab('tasks')}
            aria-pressed={tab === 'tasks'}
          >
            Tasks
          </button>
        </div>
        <button style={closeBtn} onClick={() => setAIPanelOpen(false)} aria-label="Close AI panel">×</button>
      </div>
      {tab === 'chat' ? <ChatTab storyId={storyId} /> : <TasksTab storyId={storyId} />}
    </aside>
  )
}

const tabBtn = (active: boolean): CSSProperties => ({
  padding: '4px 10px',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  border: '1px solid var(--line)',
  background: active ? 'var(--ink)' : 'transparent',
  color: active ? 'var(--paper)' : 'var(--ink-2)',
  cursor: 'pointer',
})
```

d) Add the import at the top:
```typescript
import { ChatTab } from './chat/ChatTab'
```

- [ ] **Step 3: Add a stub ChatTab so the build still succeeds**

`frontend/src/components/ai/chat/ChatTab.tsx`:

```typescript
import type { CSSProperties } from 'react'

export function ChatTab({ storyId }: { storyId: string }) {
  void storyId
  const wrap: CSSProperties = { padding: 16, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }
  return <div style={wrap}>Chat coming up.</div>
}
```

- [ ] **Step 4: Type-check + manual smoke test**

Run: `cd frontend && npx tsc --noEmit`
Run: `cd frontend && npm run dev` — open a story, click the AI FAB, verify Chat/Tasks tabs render and switch.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ai/AIPanel.tsx frontend/src/components/ai/chat/ChatTab.tsx
git commit -m "feat(chat): tabbed AIPanel shell with Chat/Tasks tabs at 420px width"
```

---

### Task 18: ChatTab orchestrator with empty state and thread list

**Files:**
- Modify: `frontend/src/components/ai/chat/ChatTab.tsx`
- Create: `frontend/src/components/ai/chat/ChatThreadList.tsx`

- [ ] **Step 1: Implement ChatThreadList**

`frontend/src/components/ai/chat/ChatThreadList.tsx`:

```typescript
import type { CSSProperties } from 'react'
import { useChatThreads } from '../../../api/chat'
import { useStore } from '../../../store'

export function ChatThreadList({ storyId }: { storyId: string }) {
  const { data, isLoading } = useChatThreads(storyId)
  const select = useStore((s) => s.setSelectedChatThreadId)

  if (isLoading) return <div style={loading}>Loading threads…</div>
  const items = data?.items ?? []
  if (items.length === 0) return null

  return (
    <ul style={list}>
      {items.map((t) => (
        <li key={t.id}>
          <button style={row} onClick={() => select(t.id)}>
            <span style={title}>{t.title ?? 'Untitled thread'}</span>
            <span style={meta}>{new Date(t.updated_at).toLocaleDateString()}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

const list: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 }
const row: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  padding: '10px 16px',
  border: 'none',
  borderBottom: '1px solid var(--line-2)',
  background: 'transparent',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'var(--font-mono)',
}
const title: CSSProperties = { fontSize: 12, color: 'var(--ink)' }
const meta: CSSProperties = { fontSize: 10, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }
const loading: CSSProperties = { padding: 16, fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }
```

- [ ] **Step 2: Implement ChatTab**

Replace `frontend/src/components/ai/chat/ChatTab.tsx` body with:

```typescript
import type { CSSProperties } from 'react'
import { useChatThreads, useCreateChatThread } from '../../../api/chat'
import { useStore } from '../../../store'
import { ChatThreadList } from './ChatThreadList'
import { ChatThread } from './ChatThread'

const SUGGESTED = [
  'Find plot inconsistencies.',
  'Suggest a midpoint twist.',
  'Help me develop a character.',
]

export function ChatTab({ storyId }: { storyId: string }) {
  const { data } = useChatThreads(storyId)
  const selectedId = useStore((s) => s.selectedChatThreadId)
  const select = useStore((s) => s.setSelectedChatThreadId)
  const createThread = useCreateChatThread(storyId)

  const threads = data?.items ?? []

  // Active thread view
  if (selectedId) {
    return <ChatThread storyId={storyId} threadId={selectedId} onClose={() => select(null)} />
  }

  // Empty state
  if (threads.length === 0) {
    return (
      <div style={empty}>
        <h3 style={emptyHead}>Start a chat about this story</h3>
        <p style={emptyBody}>The assistant has read tools to inspect your story and proposes write changes as cards you approve.</p>
        <div style={ctaCol}>
          {SUGGESTED.map((p) => (
            <button
              key={p}
              style={cta}
              onClick={async () => {
                const t = await createThread.mutateAsync(p.slice(0, 60))
                select(t.id)
                // The seeded prompt is sent by ChatThread when it sees an empty thread
                // and there's a draft in chatComposerDrafts.
                useStore.getState().setChatComposerDraft(t.id, p)
              }}
            >
              {p}
            </button>
          ))}
          <button
            style={ctaPrimary}
            onClick={async () => {
              const t = await createThread.mutateAsync()
              select(t.id)
            }}
          >
            New blank thread
          </button>
        </div>
      </div>
    )
  }

  // Thread-list view
  return (
    <div style={listShell}>
      <button
        style={newBtn}
        onClick={async () => {
          const t = await createThread.mutateAsync()
          select(t.id)
        }}
      >
        + New thread
      </button>
      <ChatThreadList storyId={storyId} />
    </div>
  )
}

const empty: CSSProperties = { padding: 16, fontFamily: 'var(--font-mono)' }
const emptyHead: CSSProperties = { fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 18, margin: '0 0 8px' }
const emptyBody: CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-3)', margin: '0 0 12px' }
const ctaCol: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }
const cta: CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--line)',
  background: 'var(--paper)',
  color: 'var(--ink)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textAlign: 'left',
  cursor: 'pointer',
}
const ctaPrimary: CSSProperties = { ...cta, borderColor: 'var(--ink)', background: 'var(--ink)', color: 'var(--paper)' }
const listShell: CSSProperties = { display: 'flex', flexDirection: 'column' }
const newBtn: CSSProperties = { ...cta, margin: 12, textAlign: 'center' }
```

- [ ] **Step 3: Stub ChatThread to keep the build green**

`frontend/src/components/ai/chat/ChatThread.tsx`:

```typescript
import type { CSSProperties } from 'react'

export function ChatThread({
  storyId,
  threadId,
  onClose,
}: {
  storyId: string
  threadId: string
  onClose: () => void
}) {
  void storyId
  const wrap: CSSProperties = { padding: 16, fontFamily: 'var(--font-mono)', fontSize: 11 }
  return (
    <div style={wrap}>
      <button onClick={onClose}>← Threads</button>
      <div>Thread {threadId} — full UI in next task.</div>
    </div>
  )
}
```

- [ ] **Step 4: Type-check + smoke**

Run: `cd frontend && npx tsc --noEmit`
Run: `npm run dev` — confirm empty state renders + clicking a suggestion creates a thread and switches to the stub thread view.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ai/chat/
git commit -m "feat(chat): ChatTab orchestrator with empty state, suggestions, and thread list"
```

---

## Phase I — Frontend thread + message UI

### Task 19: ChatThread shell with active scene awareness

**Files:**
- Modify: `frontend/src/components/ai/chat/ChatThread.tsx`

- [ ] **Step 1: Implement the full ChatThread shell**

Replace `frontend/src/components/ai/chat/ChatThread.tsx`:

```typescript
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useChatMessages, sendChatMessageStream, useArchiveChatThread } from '../../../api/chat'
import { useStore } from '../../../store'
import type { ChatMessage } from '../../../types'
import { ChatMessageView } from './ChatMessage'
import { ChatComposer } from './ChatComposer'

export function ChatThread({
  storyId,
  threadId,
  onClose,
}: {
  storyId: string
  threadId: string
  onClose: () => void
}) {
  const { data, refetch } = useChatMessages(threadId)
  const archive = useArchiveChatThread(storyId)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const activeSceneN = useStore((s) => s.activeSceneN)
  const [streaming, setStreaming] = useState<{ id: string; content: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const messages: ChatMessage[] = data?.items ?? []

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length, streaming])

  async function send(text: string) {
    // v1 ships without token-level streaming — the agent yields whole assistant
    // messages on `chat.message.complete`. Show a "thinking" placeholder until
    // either the assistant message or a tool-call-proposed event arrives.
    setStreaming({ id: 'tmp', content: '…thinking' })
    try {
      // Optimistically refetch immediately to show the user's own message.
      await refetch()
      for await (const ev of sendChatMessageStream(threadId, text, activeSceneId ?? null)) {
        if (ev.type === 'chat.tool.executed') {
          setStreaming({ id: 'tmp', content: `…using ${ev.data.tool_name}` })
        } else if (ev.type === 'chat.message.complete' || ev.type === 'chat.tool_call.proposed') {
          setStreaming(null)
          await refetch()
        }
      }
    } finally {
      setStreaming(null)
      await refetch()
    }
  }

  return (
    <div style={shell}>
      <div style={head}>
        <button style={backBtn} onClick={onClose}>← Threads</button>
        <button
          style={archiveBtn}
          onClick={async () => {
            if (!confirm('Archive this thread?')) return
            await archive.mutateAsync(threadId)
            onClose()
          }}
        >
          Archive
        </button>
      </div>
      <div style={contextBar}>
        Story-level chat{activeSceneId ? ` · also using scene ${activeSceneN ?? '?'} as context` : ''}
      </div>
      <div ref={scrollRef} style={stream}>
        {messages.map((m) => (
          <ChatMessageView key={m.id} message={m} storyId={storyId} threadId={threadId} />
        ))}
        {streaming && (
          <div style={streamingBubble}>
            {streaming.content}<span style={caret} />
          </div>
        )}
      </div>
      <ChatComposer threadId={threadId} onSend={send} />
    </div>
  )
}

const shell: CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' }
const head: CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '8px 12px', borderBottom: '1px solid var(--line)',
  fontFamily: 'var(--font-mono)', fontSize: 11,
}
const backBtn: CSSProperties = {
  background: 'transparent', border: '1px solid var(--line)',
  padding: '2px 8px', cursor: 'pointer', color: 'var(--ink-2)',
  fontFamily: 'var(--font-mono)', fontSize: 11,
}
const archiveBtn: CSSProperties = { ...backBtn, color: 'var(--red)', borderColor: 'var(--line)' }
const contextBar: CSSProperties = {
  padding: '6px 12px', fontSize: 10, color: 'var(--ink-3)',
  fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--line-2)',
}
const stream: CSSProperties = { flex: '1 1 auto', overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }
const streamingBubble: CSSProperties = {
  padding: '8px 10px', background: 'var(--paper-2)',
  borderLeft: '2px solid var(--blue)', whiteSpace: 'pre-wrap',
  fontFamily: 'var(--font-serif)', fontSize: 14, lineHeight: 1.5,
}
const caret: CSSProperties = { display: 'inline-block', width: 6, height: 14, background: 'var(--blue)', marginLeft: 2, verticalAlign: 'text-bottom' }
```

(Add stub imports for `ChatMessageView` and `ChatComposer` — they are implemented in Tasks 20 and 21.)

- [ ] **Step 2: Add stub ChatMessage and ChatComposer to keep build green**

`frontend/src/components/ai/chat/ChatMessage.tsx`:

```typescript
import type { CSSProperties } from 'react'
import type { ChatMessage } from '../../../types'

export function ChatMessageView({
  message,
  storyId,
  threadId,
}: {
  message: ChatMessage
  storyId: string
  threadId: string
}) {
  void storyId; void threadId
  const wrap: CSSProperties = { padding: 8, fontFamily: 'var(--font-serif)', fontSize: 14 }
  return <div style={wrap}>{message.role}: {message.content}</div>
}
```

`frontend/src/components/ai/chat/ChatComposer.tsx`:

```typescript
import { useState, type CSSProperties } from 'react'

export function ChatComposer({
  threadId,
  onSend,
}: {
  threadId: string
  onSend: (text: string) => void | Promise<void>
}) {
  void threadId
  const [text, setText] = useState('')
  const wrap: CSSProperties = { padding: 8, borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }
  return (
    <form
      style={wrap}
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        onSend(text.trim())
        setText('')
      }}
    >
      <input value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} />
      <button type="submit">send</button>
    </form>
  )
}
```

- [ ] **Step 3: Type-check + smoke**

Run: `cd frontend && npx tsc --noEmit`
Run: `npm run dev` — confirm thread shell renders, empty messages, composer present.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ai/chat/ChatThread.tsx frontend/src/components/ai/chat/ChatMessage.tsx frontend/src/components/ai/chat/ChatComposer.tsx
git commit -m "feat(chat): ChatThread shell with streaming + active-scene context bar"
```

---

### Task 20: ChatComposer with seeded draft and active-scene indicator

**Files:**
- Modify: `frontend/src/components/ai/chat/ChatComposer.tsx`

- [ ] **Step 1: Implement the real ChatComposer**

Replace `frontend/src/components/ai/chat/ChatComposer.tsx`:

```typescript
import { useEffect, useRef, type CSSProperties, type FormEvent } from 'react'
import { useStore } from '../../../store'

export function ChatComposer({
  threadId,
  onSend,
}: {
  threadId: string
  onSend: (text: string) => void | Promise<void>
}) {
  const draft = useStore((s) => s.chatComposerDrafts[threadId] ?? '')
  const setDraft = useStore((s) => s.setChatComposerDraft)
  const activeSceneN = useStore((s) => s.activeSceneN)
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  // Auto-resize
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }, [draft])

  function submit(e: FormEvent) {
    e.preventDefault()
    const v = draft.trim()
    if (!v) return
    setDraft(threadId, '')
    onSend(v)
  }

  return (
    <form style={wrap} onSubmit={submit}>
      <div style={meta}>
        {activeSceneN ? `Will include scene ${activeSceneN} as context` : 'No active scene'}
      </div>
      <textarea
        ref={taRef}
        style={textarea}
        value={draft}
        placeholder="Ask about your story…"
        onChange={(e) => setDraft(threadId, e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e as unknown as FormEvent)
        }}
        rows={2}
      />
      <button type="submit" style={sendBtn} disabled={!draft.trim()}>send</button>
    </form>
  )
}

const wrap: CSSProperties = {
  borderTop: '1px solid var(--line)',
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}
const meta: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }
const textarea: CSSProperties = {
  resize: 'none', fontFamily: 'var(--font-sans)', fontSize: 13,
  padding: 6, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)',
  outline: 'none',
}
const sendBtn: CSSProperties = {
  alignSelf: 'flex-end',
  padding: '4px 12px',
  border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)',
  fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
  cursor: 'pointer',
}
```

- [ ] **Step 2: Auto-send seeded draft on first thread mount**

In `frontend/src/components/ai/chat/ChatThread.tsx`, after the existing state declarations, add:

```typescript
useEffect(() => {
  // Auto-send if a thread was just created with a seeded draft and has no messages.
  if (messages.length > 0) return
  const draft = useStore.getState().chatComposerDrafts[threadId]
  if (!draft || !draft.trim()) return
  useStore.getState().setChatComposerDraft(threadId, '')
  void send(draft.trim())
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [threadId, messages.length])
```

- [ ] **Step 3: Type-check + smoke**

Run: `cd frontend && npx tsc --noEmit`
Run: `npm run dev` — verify clicking a suggested prompt creates a thread and auto-sends.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ai/chat/ChatComposer.tsx frontend/src/components/ai/chat/ChatThread.tsx
git commit -m "feat(chat): real composer with auto-resize, draft persistence, seeded auto-send"
```

---

### Task 21: ChatMessage rendering for user/assistant/tool messages

**Files:**
- Modify: `frontend/src/components/ai/chat/ChatMessage.tsx`

- [ ] **Step 1: Implement the message view**

Replace `frontend/src/components/ai/chat/ChatMessage.tsx`:

```typescript
import type { CSSProperties } from 'react'
import type { ChatMessage } from '../../../types'
import { ChatToolCard } from './ChatToolCard'

export function ChatMessageView({
  message,
  storyId,
  threadId,
}: {
  message: ChatMessage
  storyId: string
  threadId: string
}) {
  void storyId
  void threadId

  // Pure tool messages (read tool results) are not rendered to the user.
  if (message.role === 'tool') return null

  // Assistant messages with proposed/applied/rejected tool calls render as cards.
  if (
    message.role === 'assistant' &&
    message.tool_call_status &&
    message.tool_calls &&
    message.tool_calls.length > 0
  ) {
    return <ChatToolCard message={message} />
  }

  return (
    <div style={message.role === 'user' ? userBubble : assistantBubble}>
      {message.content}
    </div>
  )
}

const userBubble: CSSProperties = {
  alignSelf: 'flex-end',
  maxWidth: '85%',
  padding: '8px 10px',
  background: 'var(--ink)',
  color: 'var(--paper)',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
}

const assistantBubble: CSSProperties = {
  alignSelf: 'flex-start',
  maxWidth: '95%',
  padding: '8px 10px',
  background: 'var(--paper-2)',
  borderLeft: '2px solid var(--blue)',
  color: 'var(--ink)',
  fontFamily: 'var(--font-serif)',
  fontSize: 14,
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap',
}
```

- [ ] **Step 2: Stub ChatToolCard so build stays green**

`frontend/src/components/ai/chat/ChatToolCard.tsx`:

```typescript
import type { CSSProperties } from 'react'
import type { ChatMessage } from '../../../types'

export function ChatToolCard({ message }: { message: ChatMessage }) {
  const wrap: CSSProperties = { padding: 8, border: '1px dashed var(--line)', fontFamily: 'var(--font-mono)', fontSize: 11 }
  return <div style={wrap}>tool card: {message.tool_calls?.[0]?.name} — {message.tool_call_status}</div>
}
```

- [ ] **Step 3: Type-check + smoke**

Run: `cd frontend && npx tsc --noEmit`
Run: `npm run dev` — exchange messages, confirm user and assistant bubbles render.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ai/chat/ChatMessage.tsx frontend/src/components/ai/chat/ChatToolCard.tsx
git commit -m "feat(chat): user/assistant message rendering, tool-card stub"
```

---

## Phase J — Frontend tool cards

### Task 22: ChatToolCard with diff rendering and Apply/Reject

**Files:**
- Modify: `frontend/src/components/ai/chat/ChatToolCard.tsx`

- [ ] **Step 1: Implement the full tool card**

Replace `frontend/src/components/ai/chat/ChatToolCard.tsx`:

```typescript
import { useState, type CSSProperties } from 'react'
import { useApplyToolCall, useRejectToolCall } from '../../../api/chat'
import type { ChatMessage } from '../../../types'

export function ChatToolCard({ message }: { message: ChatMessage }) {
  const tc = message.tool_calls?.[0]
  const status = message.tool_call_status
  const result = (message.tool_call_result ?? {}) as Record<string, unknown>
  const apply = useApplyToolCall()
  const reject = useRejectToolCall()
  const [staleMessage, setStaleMessage] = useState<string | null>(null)

  if (!tc) return null

  const isStale = staleMessage !== null
  const isPending = status === 'proposed' && !isStale

  return (
    <div style={card(status)}>
      <div style={head}>
        <span style={toolName}>{tc.name}</span>
        <span style={statusPill(status)}>{status}</span>
      </div>
      {message.content && <div style={blurb}>{message.content}</div>}
      <Preview kind={String(result.kind ?? '')} result={result} />
      {staleMessage && <div style={staleBanner}>{staleMessage}</div>}
      {isPending && (
        <div style={actions}>
          <button
            style={rejectBtn}
            onClick={() => reject.mutate({ messageId: message.id, reason: undefined })}
          >
            Reject
          </button>
          <button
            style={applyBtn}
            onClick={async () => {
              try {
                await apply.mutateAsync(message.id)
              } catch (err: any) {
                if (err?.status === 409) {
                  setStaleMessage('This preview is stale — the underlying entity changed. Re-ask the assistant.')
                } else {
                  setStaleMessage(`Apply failed: ${err?.message ?? 'unknown'}`)
                }
              }
            }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}

function Preview({ kind, result }: { kind: string; result: Record<string, unknown> }) {
  if (kind === 'diff') {
    return (
      <pre style={diffBox}>
        {String(result.diff ?? '')}
      </pre>
    )
  }
  if (kind === 'scene_proposal') {
    return (
      <div style={fields}>
        <div><b>Scene #{String(result.scene_n)}:</b> {String(result.title ?? '(no title)')}</div>
        <div style={muted}>{String(result.summary)}</div>
      </div>
    )
  }
  if (kind === 'character_note') {
    return (
      <div style={fields}>
        <div style={muted}><b>{String(result.character_name)}</b></div>
        <pre style={diffBox}>{String(result.before ?? '(empty)')}</pre>
        <div style={muted}>↓ {result.append ? 'append' : 'replace'}</div>
        <pre style={diffBox}>{String(result.after ?? '')}</pre>
      </div>
    )
  }
  if (kind === 'summary_proposal') {
    return (
      <div style={fields}>
        <div style={muted}>Current summary:</div>
        <pre style={diffBox}>{String(result.current_summary ?? '')}</pre>
        <div style={muted}>{String(result.note ?? '')}</div>
      </div>
    )
  }
  return null
}

const card = (status: string | null): CSSProperties => ({
  alignSelf: 'flex-start',
  width: '100%',
  border: '1px solid var(--line)',
  borderLeft: `3px solid ${status === 'applied' ? 'var(--green)' : status === 'rejected' ? 'var(--red)' : 'var(--blue)'}`,
  background: 'var(--paper)',
  padding: 10,
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
})
const head: CSSProperties = { display: 'flex', justifyContent: 'space-between', marginBottom: 6 }
const toolName: CSSProperties = { color: 'var(--ink)', fontSize: 12 }
const statusPill = (s: string | null): CSSProperties => ({
  padding: '0 6px', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: s === 'rejected' ? 'var(--red)' : s === 'applied' ? 'var(--green)' : 'var(--blue)',
  border: `1px solid currentColor`,
})
const blurb: CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--ink-2)', marginBottom: 8 }
const fields: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }
const muted: CSSProperties = { color: 'var(--ink-3)', fontSize: 10 }
const diffBox: CSSProperties = {
  margin: 0, padding: 6, background: 'var(--paper-2)',
  fontFamily: 'var(--font-mono)', fontSize: 11,
  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  maxHeight: 200, overflow: 'auto',
}
const actions: CSSProperties = { display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }
const applyBtn: CSSProperties = {
  padding: '4px 10px', border: '1px solid var(--ink)',
  background: 'var(--ink)', color: 'var(--paper)',
  fontFamily: 'var(--font-mono)', fontSize: 10,
  letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
}
const rejectBtn: CSSProperties = {
  padding: '4px 10px', border: '1px solid var(--line)',
  background: 'var(--paper)', color: 'var(--ink-2)',
  fontFamily: 'var(--font-mono)', fontSize: 10,
  letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
}
const staleBanner: CSSProperties = {
  marginTop: 6, padding: 6, background: 'var(--paper-2)',
  borderLeft: '2px solid var(--red)', color: 'var(--red)',
  fontSize: 10, fontFamily: 'var(--font-mono)',
}
```

- [ ] **Step 2: Make `apiFetch` surface 409 status**

Read `frontend/src/api/client.ts` to confirm errors include `status`. If they don't, modify `apiFetch` to throw an error with `.status`:

```typescript
if (!res.ok) {
  const err = new Error(`HTTP ${res.status}: ${await res.text()}`) as Error & { status: number }
  err.status = res.status
  throw err
}
```

- [ ] **Step 3: Type-check + smoke**

Run: `cd frontend && npx tsc --noEmit`
Run: `npm run dev` — start a chat that triggers a write tool (e.g., "edit scene 1 to be one word: 'Yes.'"). Verify the card renders the diff and Apply / Reject work end-to-end. Check Postgres to confirm the draft was overwritten only after Apply.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ai/chat/ChatToolCard.tsx frontend/src/api/client.ts
git commit -m "feat(chat): tool-call card with diff preview, Apply/Reject, 409 stale banner"
```

---

## Phase K — FAB badge and final polish

### Task 23: Update FAB badge to include unread chat count

**Files:**
- Modify: `frontend/src/components/ai/AIPanel.tsx` (the `AILauncher` function)

- [ ] **Step 1: Update AILauncher**

In `AIPanel.tsx`, replace the `AILauncher` function:

```typescript
export function AILauncher() {
  const aiTasks = useStore((s) => s.aiTasks)
  const aiPanelOpen = useStore((s) => s.aiPanelOpen)
  const aiPanelLastSeenAt = useStore((s) => s.aiPanelLastSeenAt)
  const toggleAIPanel = useStore((s) => s.toggleAIPanel)
  const unreadChat = useStore((s) => s.unreadAssistantMessages)

  const activeCount = aiTasks.filter((t) => t.status === 'queued' || t.status === 'running').length
  const unseenCount = aiTasks.filter(
    (t) => (t.status === 'completed' || t.status === 'error') && (t.completed_at ?? 0) > aiPanelLastSeenAt,
  ).length
  const totalNotice = activeCount + unseenCount + unreadChat

  if (aiPanelOpen) return null

  return (
    <button style={launcherBase} onClick={toggleAIPanel} aria-label="Open AI panel">
      <span>AI</span>
      {totalNotice > 0 && <span style={badgeStyle}>{totalNotice}</span>}
    </button>
  )
}
```

- [ ] **Step 2: Mark unread when chat completes while panel is closed**

In `frontend/src/components/ai/chat/ChatThread.tsx` `send()`, when the `chat.message.complete` event fires AND the panel is closed AND the active tab is `chat`, increment unread:

Replace the relevant branch in `send()`:

```typescript
} else if (ev.type === 'chat.message.complete' || ev.type === 'chat.tool_call.proposed') {
  setStreaming(null)
  await refetch()
  const s = useStore.getState()
  if (!s.aiPanelOpen) {
    s.markChatUnread(s.unreadAssistantMessages + 1)
  }
}
```

And clear unread when the panel opens or the chat tab is selected. In `frontend/src/components/ai/AIPanel.tsx` `AIPanel` body, add a `useEffect`:

```typescript
useEffect(() => {
  if (aiPanelOpen && tab === 'chat') {
    useStore.getState().clearChatUnread()
  }
}, [aiPanelOpen, tab])
```

(Add `useEffect` import.)

- [ ] **Step 3: Type-check + smoke**

Run: `cd frontend && npx tsc --noEmit`
Run: `npm run dev` — confirm the FAB badge updates when chat replies arrive while the panel is closed.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ai/AIPanel.tsx frontend/src/components/ai/chat/ChatThread.tsx
git commit -m "feat(chat): FAB badge includes unread chat messages"
```

---

### Task 24: End-to-end smoke + cleanup

**Files:** none (verification + cleanup)

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && PYTHONPATH=. uv run pytest tests/ -v`
Expected: all green; chat tests included.

- [ ] **Step 2: Frontend type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Manual end-to-end run**

1. `cd backend && PYTHONPATH=. uv run uvicorn app.main:app --reload --port 8000`
2. `cd frontend && npm run dev`
3. Log in as `elena@beatlume.io` / `beatlume123`.
4. Open a story. Click the AI FAB. Confirm Chat tab is the default.
5. Click "New blank thread". Send: "List my characters."
6. Confirm read tool fires (no card; assistant text only) and lists actual characters.
7. Send: "Add a note to character X: 'tested by chat.'"
8. Confirm a `update_character_note` card appears with before/after preview.
9. Click Apply. Confirm `tool_call_status` flips to `applied` and the character notes were updated in DB.
10. Send something that prompts an `edit_scene_draft` (e.g., "make scene 1 one word: 'Yes.'"). Confirm a diff card appears, Reject. Confirm the card stays visible with `rejected` status and the draft is unchanged.
11. Open a new thread mid-flight; close the panel; trigger a reply from another tab; confirm the FAB badge increments.

- [ ] **Step 4: Manuscript guarantee sanity check**

The chat must not break the existing "Fill empty scenes" / "Regenerate all" flows. From the Tasks tab, click "Fill empty scenes" on a fresh story and confirm it still works as before.

- [ ] **Step 5: Commit anything fixed during smoke (often nothing)**

```bash
git status
# If changes: stage and commit with a descriptive message.
```

- [ ] **Step 6: Final commit / PR prep**

The plan is complete. The full feature can now ship as a single PR. Suggest:

```
feat: AI slideout story-chat with tool-calling

- Chat tab in the existing AI slideout (story-scoped layout)
- Persistent per-story threads with active-scene context awareness
- Curated tool registry (5 read tools, 4 write tools)
- Inline approval cards with diff preview for edit_scene_draft
- Every write tool routes through an existing service path
- Chat tier added to LiteLLM router
```

---

## Self-review notes

- Every spec section has a corresponding task: data model (1, 2), service (3, 4, 12), routes (5, 11, 12), tools (6, 7), tier + agent (8, 9, 10), frontend types/api (13, 14), store/sse (15, 16), panel (17, 18), thread/message (19, 20, 21), tool cards (22), badge (23), end-to-end (24).
- "Out of scope" items in the spec (scene-anchored threads, batch approval, mobile, voice, cross-story, streaming diff, auto-archive, cost UI) are intentionally absent from the plan.
- Architectural rule "every write tool's apply path calls an existing service" is enforced in Task 7 (`apply_*` functions delegate to `draft_service.upsert_draft`, `scene_service.create_scene`, `character_service.update_notes`, `summary_graph.run_summary`).
- Type names are consistent across tasks: `ChatMessageRole`, `ToolCallStatus`, `ChatThread`, `ChatMessage`, `ChatToolCall`, `WRITE_TOOL_PREVIEWS`, `WRITE_TOOL_APPLIERS`, `READ_TOOL_IMPLS`.
