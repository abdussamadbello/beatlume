"""scene_multi_metric_scores

Add six multi-metric score columns to scenes so the Timeline can render
layered tension facets beyond the single scalar `tension`:

  emotional, stakes, mystery, romance, danger, hope

Each is INT 0-10 with server_default 0, NOT NULL. 0 means "not applicable
or unset for this scene" — the UI treats 0 as absent and the chart layer
is hidden when all scenes score 0 for that facet.

Additive only; existing rows get 0 for every new column.

Revision ID: 6c3d4e5f7a8b
Revises: 5b2c3d4e6f7a
Create Date: 2026-04-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6c3d4e5f7a8b"
down_revision: Union[str, None] = "5b2c3d4e6f7a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


METRICS = ("emotional", "stakes", "mystery", "romance", "danger", "hope")


def upgrade() -> None:
    for name in METRICS:
        op.add_column(
            "scenes",
            sa.Column(name, sa.Integer(), nullable=False, server_default="0"),
        )
        op.create_check_constraint(
            f"ck_scene_{name}",
            "scenes",
            f"{name} >= 0 AND {name} <= 10",
        )


def downgrade() -> None:
    for name in reversed(METRICS):
        op.drop_constraint(f"ck_scene_{name}", "scenes", type_="check")
        op.drop_column("scenes", name)
