"""add_chat_tables

Revision ID: 9e150e11e2c1
Revises: 8b10b3e92c10
Create Date: 2026-04-26 22:22:06.850697

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '9e150e11e2c1'
down_revision: Union[str, None] = '8b10b3e92c10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum types via raw SQL first; Alembic transactional DDL keeps
    # them visible within the same session.  Using raw SQL avoids the
    # SQLAlchemy Enum._on_table_create double-create problem.
    op.execute("CREATE TYPE chat_message_role AS ENUM ('user', 'assistant', 'tool')")
    op.execute("CREATE TYPE tool_call_status AS ENUM ('proposed', 'applied', 'rejected')")

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
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("tool_calls", postgresql.JSONB, nullable=True),
        sa.Column("tool_call_status", sa.Text(), nullable=True),
        sa.Column("tool_call_result", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # Now enforce the enum types via ALTER TABLE after the table is created
    op.execute(
        "ALTER TABLE chat_messages "
        "ALTER COLUMN role TYPE chat_message_role USING role::chat_message_role, "
        "ALTER COLUMN tool_call_status TYPE tool_call_status USING tool_call_status::tool_call_status"
    )

    op.create_index("ix_chat_messages_thread_created", "chat_messages", ["thread_id", "created_at"])

    # RLS — match the existing project pattern (two policies per table; no `, true` fallback).
    # FORCE ROW LEVEL SECURITY ensures policies apply to the table owner and
    # superusers too.  The beatlume DB role is a superuser so without FORCE,
    # RLS is silently bypassed for all application queries.
    for table in ("chat_threads", "chat_messages"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY org_isolation ON {table} "
            f"USING (org_id = current_setting('app.current_org_id')::uuid)"
        )
        op.execute(
            f"CREATE POLICY org_isolation_insert ON {table} "
            f"FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id')::uuid)"
        )


def downgrade() -> None:
    for table in ("chat_messages", "chat_threads"):
        op.execute(f"DROP POLICY IF EXISTS org_isolation_insert ON {table}")
        op.execute(f"DROP POLICY IF EXISTS org_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    op.drop_index("ix_chat_messages_thread_created", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_index("ix_chat_threads_story_archived", table_name="chat_threads")
    op.drop_table("chat_threads")
    op.execute("DROP TYPE IF EXISTS tool_call_status")
    op.execute("DROP TYPE IF EXISTS chat_message_role")
