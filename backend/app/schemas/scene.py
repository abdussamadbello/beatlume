import uuid
from pydantic import BaseModel


class SceneCreate(BaseModel):
    title: str
    pov: str = ""
    tension: int = 5
    act: int = 1
    location: str = ""
    tag: str = ""
    summary: str | None = None


class SceneRead(BaseModel):
    id: uuid.UUID
    story_id: uuid.UUID
    n: int
    title: str
    pov: str
    tension: int
    act: int
    location: str
    tag: str
    summary: str | None = None

    model_config = {"from_attributes": True}


class SceneUpdate(BaseModel):
    title: str | None = None
    pov: str | None = None
    tension: int | None = None
    act: int | None = None
    location: str | None = None
    tag: str | None = None
    summary: str | None = None
