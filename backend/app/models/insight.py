import enum
import uuid
from datetime import datetime

from sqlalchemy import ARRAY, Boolean, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin


class InsightSeverity(str, enum.Enum):
    red = "red"
    amber = "amber"
    blue = "blue"


class Insight(Base, OrgScopedMixin):
    __tablename__ = "insights"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id", ondelete="CASCADE"))
    severity: Mapped[InsightSeverity] = mapped_column()
    category: Mapped[str] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    refs: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    dismissed: Mapped[bool] = mapped_column(Boolean, default=False)
    generated_at: Mapped[datetime] = mapped_column(server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
