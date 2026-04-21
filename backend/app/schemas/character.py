import uuid
from pydantic import BaseModel


class CharacterCreate(BaseModel):
    name: str
    role: str = ""
    description: str = ""
    bio: str = ""
    desire: str = ""
    flaw: str = ""


class CharacterRead(BaseModel):
    id: uuid.UUID
    story_id: uuid.UUID
    name: str
    role: str
    description: str
    bio: str
    desire: str
    flaw: str
    scene_count: int
    longest_gap: int

    model_config = {"from_attributes": True}


class CharacterUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    description: str | None = None
    bio: str | None = None
    desire: str | None = None
    flaw: str | None = None
    scene_count: int | None = None
    longest_gap: int | None = None
