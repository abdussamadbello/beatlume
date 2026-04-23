"""add story_type column

Revision ID: 8b10b3e92c10
Revises: 9f0a1b2c3d4e
Create Date: 2026-04-23 16:38:19.415520

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b10b3e92c10'
down_revision: Union[str, None] = '9f0a1b2c3d4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('stories', sa.Column('story_type', sa.String(), nullable=False, server_default='novel'))


def downgrade() -> None:
    op.drop_column('stories', 'story_type')
