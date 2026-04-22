"""story_archived

Add stories.archived boolean for the Dashboard archive feature.
Default false; existing rows are non-archived.

Revision ID: 8e5f6a7b9cad
Revises: 7d4e5f6a8b9c
Create Date: 2026-04-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8e5f6a7b9cad"
down_revision: Union[str, None] = "7d4e5f6a8b9c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "stories",
        sa.Column(
            "archived",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("stories", "archived")
