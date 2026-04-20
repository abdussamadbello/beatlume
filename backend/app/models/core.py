import enum
import uuid

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin


class CoreKind(str, enum.Enum):
    story = "story"
    part = "part"
    chap = "chap"
    scene = "scene"
    beat = "beat"


class CoreConfigNode(Base, OrgScopedMixin):
    __tablename__ = "core_config_nodes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id", ondelete="CASCADE"))
    depth: Mapped[int] = mapped_column(default=0)
    label: Mapped[str] = mapped_column(String(255))
    kind: Mapped[CoreKind] = mapped_column()
    active: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(default=0)


class CoreSetting(Base, OrgScopedMixin):
    __tablename__ = "core_settings"
    __table_args__ = (UniqueConstraint("story_id", "key", name="uq_core_setting"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(100))
    value: Mapped[str] = mapped_column(String(1000))
    source: Mapped[str] = mapped_column(String(100), default="")
    tag: Mapped[str | None] = mapped_column(String(100), nullable=True)
