"""scene_chapters_and_participants

Phase C of PRD-gap work:
  1. Add Scene.chapter_id FK → manuscript_chapters (SET NULL on delete).
  2. Create scene_participants join table (Scene ↔ Character with role).
  3. Backfill participants with role='pov' from existing Scene.pov strings
     where the pov value matches a character name within the same story.

Match is case-insensitive and trims whitespace. Lossy by design — pov
strings with parentheticals (e.g. "Iris (flashback)") won't match.
Non-matches are silently skipped; ON CONFLICT preserves any manually
created participants.

Revision ID: 5b2c3d4e6f7a
Revises: 4a1b2c3d5e6f
Create Date: 2026-04-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5b2c3d4e6f7a"
down_revision: Union[str, None] = "4a1b2c3d5e6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. scenes.chapter_id
    op.add_column(
        "scenes",
        sa.Column("chapter_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_scenes_chapter_id",
        "scenes",
        "manuscript_chapters",
        ["chapter_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_scenes_chapter_id", "scenes", ["chapter_id"]
    )

    # 2. scene_participants table
    op.create_table(
        "scene_participants",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "scene_id",
            sa.Uuid(),
            sa.ForeignKey("scenes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "character_id",
            sa.Uuid(),
            sa.ForeignKey("characters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "role",
            sa.String(length=32),
            nullable=False,
            server_default="supporting",
        ),
        sa.Column("interaction_weight", sa.Integer(), nullable=True),
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
        sa.UniqueConstraint(
            "scene_id", "character_id", name="uq_scene_participant"
        ),
    )
    op.create_index(
        "ix_scene_participants_scene_id", "scene_participants", ["scene_id"]
    )
    op.create_index(
        "ix_scene_participants_character_id",
        "scene_participants",
        ["character_id"],
    )
    op.create_index(
        "ix_scene_participants_org_id",
        "scene_participants",
        ["org_id"],
    )

    # 3. Backfill: for each scene whose pov matches a character name in the
    #    same story, insert a role='pov' participant row. gen_random_uuid()
    #    requires pgcrypto, which is available by default on modern Postgres.
    op.execute(
        """
        INSERT INTO scene_participants
            (id, scene_id, character_id, role, org_id, created_at, updated_at)
        SELECT
            gen_random_uuid(),
            s.id,
            c.id,
            'pov',
            s.org_id,
            NOW(),
            NOW()
          FROM scenes s
          JOIN characters c
            ON c.story_id = s.story_id
           AND LOWER(TRIM(c.name)) = LOWER(TRIM(s.pov))
         WHERE s.pov IS NOT NULL
           AND s.pov <> ''
        ON CONFLICT (scene_id, character_id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.drop_index("ix_scene_participants_org_id", "scene_participants")
    op.drop_index("ix_scene_participants_character_id", "scene_participants")
    op.drop_index("ix_scene_participants_scene_id", "scene_participants")
    op.drop_table("scene_participants")

    op.drop_index("ix_scenes_chapter_id", "scenes")
    op.drop_constraint("fk_scenes_chapter_id", "scenes", type_="foreignkey")
    op.drop_column("scenes", "chapter_id")
