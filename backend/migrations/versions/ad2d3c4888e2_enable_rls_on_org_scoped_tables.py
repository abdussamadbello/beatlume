"""enable RLS on org-scoped tables

Revision ID: ad2d3c4888e2
Revises: 11b87dffe2ac
Create Date: 2026-04-19 15:21:29.926367

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ad2d3c4888e2'
down_revision: Union[str, None] = '11b87dffe2ac'
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
