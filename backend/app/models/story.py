import enum
import uuid

from sqlalchemy import ARRAY, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin, TimestampMixin


class StoryStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"


class Story(Base, OrgScopedMixin, TimestampMixin):
    __tablename__ = "stories"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500))
    genres: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    target_words: Mapped[int] = mapped_column(default=80000)
    draft_number: Mapped[int] = mapped_column(default=1)
    status: Mapped[StoryStatus] = mapped_column(default=StoryStatus.not_started)
    structure_type: Mapped[str] = mapped_column(String(50), default="3-act")
