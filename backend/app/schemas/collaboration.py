import uuid
from datetime import datetime
from pydantic import BaseModel


class CollaboratorRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    role: str
    invited_at: datetime
    accepted_at: datetime | None = None

    model_config = {"from_attributes": True}


class InviteRequest(BaseModel):
    email: str
    role: str = "reader"


class CommentCreate(BaseModel):
    body: str
    scene_id: uuid.UUID | None = None


class CommentRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    scene_id: uuid.UUID | None = None
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    action: str
    detail: dict
    created_at: datetime

    model_config = {"from_attributes": True}
