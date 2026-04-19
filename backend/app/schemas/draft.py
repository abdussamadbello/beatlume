import uuid
from pydantic import BaseModel


class DraftRead(BaseModel):
    id: uuid.UUID
    scene_id: uuid.UUID
    content: str
    word_count: int

    model_config = {"from_attributes": True}


class DraftUpdate(BaseModel):
    content: str
