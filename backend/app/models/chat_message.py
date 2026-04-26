import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrgScopedMixin, TimestampMixin


class ChatMessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    tool = "tool"


class ToolCallStatus(str, enum.Enum):
    proposed = "proposed"
    applied = "applied"
    rejected = "rejected"


class ChatMessage(Base, OrgScopedMixin, TimestampMixin):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    thread_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("chat_threads.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[ChatMessageRole] = mapped_column(
        Enum(ChatMessageRole, name="chat_message_role"),
    )
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    tool_calls: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    tool_call_status: Mapped[ToolCallStatus | None] = mapped_column(
        Enum(ToolCallStatus, name="tool_call_status"),
        nullable=True,
    )
    tool_call_result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
