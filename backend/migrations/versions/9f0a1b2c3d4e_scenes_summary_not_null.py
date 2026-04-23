"""scenes summary NOT NULL

Backfill null/blank scene summaries from trimmed title, then set NOT NULL
so every scene row always has a beat-level string for timeline and exports.

Revision ID: 9f0a1b2c3d4e
Revises: 8e5f6a7b9cad
Create Date: 2026-04-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9f0a1b2c3d4e"
down_revision: Union[str, None] = "8e5f6a7b9cad"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Title is NOT NULL; use it for any row missing a usable summary.
    op.execute(
        sa.text(
            """
            UPDATE scenes
            SET summary = TRIM(title)
            WHERE summary IS NULL
               OR TRIM(COALESCE(summary, '')) = ''
            """
        )
    )
    op.alter_column(
        "scenes",
        "summary",
        existing_type=sa.Text(),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "scenes",
        "summary",
        existing_type=sa.Text(),
        nullable=True,
    )
