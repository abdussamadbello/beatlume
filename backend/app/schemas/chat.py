import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.chat_message import ChatMessageRole, ToolCallStatus


class ChatThreadRead(BaseModel):
    id: uuid.UUID
    story_id: uuid.UUID
    title: str | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatMessageRead(BaseModel):
    id: uuid.UUID
    thread_id: uuid.UUID
    role: ChatMessageRole
    content: str | None
    tool_calls: list[dict[str, Any]] | None
    tool_call_status: ToolCallStatus | None
    tool_call_result: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SendMessageRequest(BaseModel):
    content: str
    active_scene_id: uuid.UUID | None = None


class RejectToolCallRequest(BaseModel):
    reason: str | None = None
