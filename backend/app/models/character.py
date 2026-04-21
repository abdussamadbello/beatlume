import uuid

from sqlalchemy import CheckConstraint, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin, TimestampMixin


class Character(Base, OrgScopedMixin, TimestampMixin):
    __tablename__ = "characters"
    __table_args__ = (
        CheckConstraint("scene_count >= 0", name="ck_character_scene_count"),
        CheckConstraint("longest_gap >= 0", name="ck_character_longest_gap"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(100), default="")
    description: Mapped[str] = mapped_column(String(500), default="", server_default="")
    bio: Mapped[str] = mapped_column(Text, default="", server_default="")
    desire: Mapped[str] = mapped_column(Text, default="")
    flaw: Mapped[str] = mapped_column(Text, default="")
    scene_count: Mapped[int] = mapped_column(default=0)
    longest_gap: Mapped[int] = mapped_column(default=0)
