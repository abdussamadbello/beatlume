import uuid
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, OrgScopedMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.scene_participant import SceneParticipant


class Scene(Base, OrgScopedMixin, TimestampMixin):
    __tablename__ = "scenes"
    __table_args__ = (
        UniqueConstraint("story_id", "n", name="uq_scene_number"),
        CheckConstraint("tension >= 1 AND tension <= 10", name="ck_scene_tension"),
        CheckConstraint("act >= 1", name="ck_scene_act"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id", ondelete="CASCADE"))
    chapter_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("manuscript_chapters.id", ondelete="SET NULL"),
        nullable=True,
    )
    n: Mapped[int] = mapped_column()
    title: Mapped[str] = mapped_column(String(500))
    pov: Mapped[str] = mapped_column(String(255))
    tension: Mapped[int] = mapped_column(default=5)
    act: Mapped[int] = mapped_column(default=1)
    location: Mapped[str] = mapped_column(String(500), default="")
    tag: Mapped[str] = mapped_column(String(100), default="")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    participants: Mapped[list["SceneParticipant"]] = relationship(
        "SceneParticipant",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
