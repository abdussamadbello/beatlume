import uuid
from pydantic import BaseModel


class CharacterCreate(BaseModel):
    name: str
    role: str = ""
    archetype: str = ""
    description: str = ""
    bio: str = ""
    desire: str = ""
    fear: str = ""
    flaw: str = ""
    arc_summary: str = ""
    relationship_notes: str = ""


class CharacterRead(BaseModel):
    id: uuid.UUID
    story_id: uuid.UUID
    name: str
    role: str
    archetype: str
    description: str
    bio: str
    desire: str
    fear: str
    flaw: str
    arc_summary: str
    relationship_notes: str
    scene_count: int
    longest_gap: int

    model_config = {"from_attributes": True}


class CharacterUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    archetype: str | None = None
    description: str | None = None
    bio: str | None = None
    desire: str | None = None
    fear: str | None = None
    flaw: str | None = None
    arc_summary: str | None = None
    relationship_notes: str | None = None
    scene_count: int | None = None
    longest_gap: int | None = None
