import enum
import uuid

from sqlalchemy import Boolean, ForeignKey, Index, String
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
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("core_config_nodes.id", ondelete="CASCADE"), nullable=True
    )
    depth: Mapped[int] = mapped_column(default=0)
    label: Mapped[str] = mapped_column(String(255))
    kind: Mapped[CoreKind] = mapped_column()
    active: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(default=0)


class CoreSetting(Base, OrgScopedMixin):
    __tablename__ = "core_settings"
    # Settings can be story-global (config_node_id IS NULL) or node-scoped
    # (config_node_id = some node). A key may appear once per (story, node)
    # pair, with the NULL node representing the story root. Enforced via two
    # partial unique indexes because PostgreSQL treats NULL as distinct in
    # regular unique constraints.
    __table_args__ = (
        Index(
            "uq_core_setting_story_key_null_node",
            "story_id",
            "key",
            unique=True,
            postgresql_where="config_node_id IS NULL",
        ),
        Index(
            "uq_core_setting_story_node_key",
            "story_id",
            "config_node_id",
            "key",
            unique=True,
            postgresql_where="config_node_id IS NOT NULL",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id", ondelete="CASCADE"))
    config_node_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("core_config_nodes.id", ondelete="CASCADE"), nullable=True
    )
    key: Mapped[str] = mapped_column(String(100))
    value: Mapped[str] = mapped_column(String(1000))
    source: Mapped[str] = mapped_column(String(100), default="")
    tag: Mapped[str | None] = mapped_column(String(100), nullable=True)
