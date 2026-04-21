"""core_per_node_overrides

Add parent_id to core_config_nodes and config_node_id to core_settings so that
settings can be overridden per node (story/part/chapter/scene/beat). Replace
the full-row unique constraint on (story_id, key) with two partial unique
indexes so NULL config_node_id (story-root) and non-NULL (node-scoped) rows
each enforce their own uniqueness.

Revision ID: 3c7a4e91d2a1
Revises: 2b2c323bea26
Create Date: 2026-04-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3c7a4e91d2a1"
down_revision: Union[str, None] = "2b2c323bea26"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add parent_id FK to core_config_nodes (self-referential, nullable)
    op.add_column(
        "core_config_nodes",
        sa.Column("parent_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_core_config_nodes_parent_id",
        "core_config_nodes",
        "core_config_nodes",
        ["parent_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 2. Backfill parent_id from depth + sort_order heuristic:
    #    a node's parent is the most recent preceding node (by sort_order)
    #    within the same story that has depth = this.depth - 1.
    op.execute(
        """
        UPDATE core_config_nodes AS child
           SET parent_id = parent.id
          FROM core_config_nodes AS parent
         WHERE parent.story_id = child.story_id
           AND parent.depth = child.depth - 1
           AND parent.sort_order = (
             SELECT MAX(p2.sort_order)
               FROM core_config_nodes p2
              WHERE p2.story_id = child.story_id
                AND p2.depth = child.depth - 1
                AND p2.sort_order < child.sort_order
           );
        """
    )

    # 3. Add config_node_id FK to core_settings (nullable = story-root)
    op.add_column(
        "core_settings",
        sa.Column("config_node_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_core_settings_config_node_id",
        "core_settings",
        "core_config_nodes",
        ["config_node_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 4. Replace the old (story_id, key) unique constraint with two partial
    #    unique indexes that handle NULL / non-NULL config_node_id separately.
    op.drop_constraint("uq_core_setting", "core_settings", type_="unique")
    op.create_index(
        "uq_core_setting_story_key_null_node",
        "core_settings",
        ["story_id", "key"],
        unique=True,
        postgresql_where=sa.text("config_node_id IS NULL"),
    )
    op.create_index(
        "uq_core_setting_story_node_key",
        "core_settings",
        ["story_id", "config_node_id", "key"],
        unique=True,
        postgresql_where=sa.text("config_node_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_core_setting_story_node_key", table_name="core_settings")
    op.drop_index("uq_core_setting_story_key_null_node", table_name="core_settings")
    op.create_unique_constraint(
        "uq_core_setting", "core_settings", ["story_id", "key"]
    )
    op.drop_constraint(
        "fk_core_settings_config_node_id", "core_settings", type_="foreignkey"
    )
    op.drop_column("core_settings", "config_node_id")
    op.drop_constraint(
        "fk_core_config_nodes_parent_id", "core_config_nodes", type_="foreignkey"
    )
    op.drop_column("core_config_nodes", "parent_id")
