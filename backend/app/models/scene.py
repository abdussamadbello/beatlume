import uuid

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin, TimestampMixin


class Scene(Base, OrgScopedMixin, TimestampMixin):
    __tablename__ = "scenes"
    __table_args__ = (UniqueConstraint("story_id", "n", name="uq_scene_number"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id"))
    n: Mapped[int] = mapped_column()
    title: Mapped[str] = mapped_column(String(500))
    pov: Mapped[str] = mapped_column(String(255))
    tension: Mapped[int] = mapped_column(default=5)
    act: Mapped[int] = mapped_column(default=1)
    location: Mapped[str] = mapped_column(String(500), default="")
    tag: Mapped[str] = mapped_column(String(100), default="")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
