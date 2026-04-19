import enum
import uuid

from sqlalchemy import Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin


class NodeType(str, enum.Enum):
    hub = "hub"
    minor = "minor"


class EdgeKind(str, enum.Enum):
    conflict = "conflict"
    alliance = "alliance"
    romance = "romance"
    mentor = "mentor"
    secret = "secret"
    family = "family"


class EdgeProvenance(str, enum.Enum):
    author = "author"
    ai_accepted = "ai_accepted"
    ai_pending = "ai_pending"
    scaffold = "scaffold"


class CharacterNode(Base, OrgScopedMixin):
    __tablename__ = "character_nodes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id"))
    character_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("characters.id"))
    x: Mapped[float] = mapped_column(Float, default=0.0)
    y: Mapped[float] = mapped_column(Float, default=0.0)
    label: Mapped[str] = mapped_column(String(255))
    initials: Mapped[str] = mapped_column(String(10))
    node_type: Mapped[NodeType | None] = mapped_column(nullable=True)
    first_appearance_scene: Mapped[int] = mapped_column(default=1)


class CharacterEdge(Base, OrgScopedMixin):
    __tablename__ = "character_edges"
    __table_args__ = (
        UniqueConstraint("story_id", "source_node_id", "target_node_id", name="uq_edge"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id"))
    source_node_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("character_nodes.id"))
    target_node_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("character_nodes.id"))
    kind: Mapped[EdgeKind] = mapped_column()
    weight: Mapped[float] = mapped_column(Float, default=0.5)
    provenance: Mapped[EdgeProvenance] = mapped_column(default=EdgeProvenance.author)
    evidence: Mapped[list] = mapped_column(JSONB, default=list)
    first_evidenced_scene: Mapped[int] = mapped_column(default=1)
