"""Beats — the smallest narrative unit, inside a scene.

A beat is a single shift in dramatic direction within a scene: a
decision, a reveal, a reaction, an image. Scenes hold 1..N beats,
ordered by `n` (per-scene ordinal, 1-indexed).

`kind` is a free-form string so authors can use any vocabulary, but the
UI presents a small curated list (setup, action, reaction, decision,
reveal, turn) to nudge without constraining.
"""
import uuid

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin, TimestampMixin


class Beat(Base, OrgScopedMixin, TimestampMixin):
    __tablename__ = "beats"
    __table_args__ = (
        UniqueConstraint("scene_id", "n", name="uq_beat_scene_n"),
        CheckConstraint("n >= 1", name="ck_beat_n_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    scene_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    n: Mapped[int] = mapped_column(nullable=False)
    title: Mapped[str] = mapped_column(String(500), default="", server_default="")
    # Free-form. Common values: setup, action, reaction, decision, reveal, turn.
    kind: Mapped[str] = mapped_column(String(32), default="action", server_default="action")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
