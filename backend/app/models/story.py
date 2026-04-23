import enum
import uuid

from sqlalchemy import ARRAY, CheckConstraint, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin, TimestampMixin


class StoryStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"


class Story(Base, OrgScopedMixin, TimestampMixin):
    __tablename__ = "stories"
    __table_args__ = (
        CheckConstraint("target_words > 0", name="ck_story_target_words"),
        CheckConstraint("draft_number >= 0", name="ck_story_draft_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500))
    logline: Mapped[str] = mapped_column(Text, default="", server_default="")
    genres: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    subgenre: Mapped[str] = mapped_column(String(100), default="", server_default="")
    themes: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, server_default="{}")
    target_words: Mapped[int] = mapped_column(default=80000)
    draft_number: Mapped[int] = mapped_column(default=1)
    status: Mapped[StoryStatus] = mapped_column(default=StoryStatus.not_started)
    structure_type: Mapped[str] = mapped_column(String(50), default="3-act")
    story_type: Mapped[str] = mapped_column(String, default="novel")
    archived: Mapped[bool] = mapped_column(default=False, server_default="false")
