import uuid
from pydantic import BaseModel


class StoryCreate(BaseModel):
    title: str
    genres: list[str] = []
    target_words: int = 80000
    structure_type: str = "3-act"


class StoryRead(BaseModel):
    id: uuid.UUID
    title: str
    genres: list[str]
    target_words: int
    draft_number: int
    status: str
    structure_type: str

    model_config = {"from_attributes": True}


class StoryUpdate(BaseModel):
    title: str | None = None
    genres: list[str] | None = None
    target_words: int | None = None
    draft_number: int | None = None
    status: str | None = None
    structure_type: str | None = None
