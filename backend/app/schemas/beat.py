import uuid

from pydantic import BaseModel


class BeatCreate(BaseModel):
    title: str = ""
    kind: str = "action"
    summary: str | None = None


class BeatRead(BaseModel):
    id: uuid.UUID
    scene_id: uuid.UUID
    n: int
    title: str
    kind: str
    summary: str | None = None

    model_config = {"from_attributes": True}


class BeatUpdate(BaseModel):
    title: str | None = None
    kind: str | None = None
    summary: str | None = None
    n: int | None = None
