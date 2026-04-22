"""story_character_prd_scalars

Add PRD-specified scalar fields to stories and characters:
  stories: logline, subgenre, themes
  characters: archetype, fear, arc_summary, relationship_notes

All additive. Existing rows get server defaults (empty string / empty
array) so no backfill is required.

Revision ID: 4a1b2c3d5e6f
Revises: 3c7a4e91d2a1
Create Date: 2026-04-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4a1b2c3d5e6f"
down_revision: Union[str, None] = "3c7a4e91d2a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Stories
    op.add_column(
        "stories",
        sa.Column("logline", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "stories",
        sa.Column("subgenre", sa.String(length=100), nullable=False, server_default=""),
    )
    op.add_column(
        "stories",
        sa.Column(
            "themes",
            sa.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'::varchar[]"),
        ),
    )

    # Characters
    op.add_column(
        "characters",
        sa.Column("archetype", sa.String(length=100), nullable=False, server_default=""),
    )
    op.add_column(
        "characters",
        sa.Column("fear", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "characters",
        sa.Column("arc_summary", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "characters",
        sa.Column("relationship_notes", sa.Text(), nullable=False, server_default=""),
    )


def downgrade() -> None:
    # Drop in reverse order
    op.drop_column("characters", "relationship_notes")
    op.drop_column("characters", "arc_summary")
    op.drop_column("characters", "fear")
    op.drop_column("characters", "archetype")
    op.drop_column("stories", "themes")
    op.drop_column("stories", "subgenre")
    op.drop_column("stories", "logline")
