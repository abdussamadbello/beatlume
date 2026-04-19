import uuid
from pydantic import BaseModel


class ChapterRead(BaseModel):
    id: uuid.UUID
    num: int
    title: str
    content: str
    sort_order: int

    model_config = {"from_attributes": True}


class ChapterUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
