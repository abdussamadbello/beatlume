import uuid
from pydantic import BaseModel


class StoryCreate(BaseModel):
    title: str
    logline: str = ""
    genres: list[str] = []
    subgenre: str = ""
    themes: list[str] = []
    target_words: int = 80000
    structure_type: str = "3-act"
    story_type: str = "novel"


class StoryRead(BaseModel):
    id: uuid.UUID
    title: str
    logline: str
    genres: list[str]
    subgenre: str
    themes: list[str]
    target_words: int
    draft_number: int
    status: str
    structure_type: str
    story_type: str
    archived: bool = False

    model_config = {"from_attributes": True}


class StoryUpdate(BaseModel):
    title: str | None = None
    logline: str | None = None
    genres: list[str] | None = None
    subgenre: str | None = None
    themes: list[str] | None = None
    target_words: int | None = None
    draft_number: int | None = None
    status: str | None = None
    structure_type: str | None = None
    story_type: str | None = None
    archived: bool | None = None
