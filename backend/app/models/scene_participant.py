"""Scene ↔ Character join table.

Documents who participates in each scene and how. The canonical data
source for presence / co-occurrence analytics after migration
4a1b2c3d5e6f lands. The `Scene.pov` string column is retained as a
display label; a `role='pov'` participant row is kept in sync by the
service layer when POV changes.
"""
import uuid

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin, TimestampMixin


class SceneParticipant(Base, OrgScopedMixin, TimestampMixin):
    __tablename__ = "scene_participants"
    __table_args__ = (
        UniqueConstraint("scene_id", "character_id", name="uq_scene_participant"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    scene_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    character_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # pov | supporting | mentioned | antagonist | ensemble
    role: Mapped[str] = mapped_column(String(32), default="supporting", server_default="supporting")
    interaction_weight: Mapped[int | None] = mapped_column(Integer, nullable=True)
