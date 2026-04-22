"""scene_beats

Create the `beats` table — the smallest narrative unit, belonging to a
scene. Ordered by `n` within a scene. `kind` is free-form (typical
values: setup, action, reaction, decision, reveal, turn).

Beats were deleted as mock UI in an earlier commit; this migration
introduces them as first-class backend entities so the story →
chapter → scene → beat hierarchy is complete.

Revision ID: 7d4e5f6a8b9c
Revises: 6c3d4e5f7a8b
Create Date: 2026-04-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7d4e5f6a8b9c"
down_revision: Union[str, None] = "6c3d4e5f7a8b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "beats",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "scene_id",
            sa.Uuid(),
            sa.ForeignKey("scenes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("n", sa.Integer(), nullable=False),
        sa.Column(
            "title",
            sa.String(length=500),
            nullable=False,
            server_default="",
        ),
        sa.Column(
            "kind",
            sa.String(length=32),
            nullable=False,
            server_default="action",
        ),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column(
            "org_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("scene_id", "n", name="uq_beat_scene_n"),
        sa.CheckConstraint("n >= 1", name="ck_beat_n_positive"),
    )
    op.create_index("ix_beats_scene_id", "beats", ["scene_id"])
    op.create_index("ix_beats_org_id", "beats", ["org_id"])


def downgrade() -> None:
    op.drop_index("ix_beats_org_id", table_name="beats")
    op.drop_index("ix_beats_scene_id", table_name="beats")
    op.drop_table("beats")
