import uuid
from pydantic import BaseModel


class CoreNodeRead(BaseModel):
    id: uuid.UUID
    depth: int
    label: str
    kind: str
    active: bool
    sort_order: int

    model_config = {"from_attributes": True}


class CoreNodeUpdate(BaseModel):
    active: bool | None = None
    label: str | None = None


class CoreSettingRead(BaseModel):
    id: uuid.UUID
    key: str
    value: str
    source: str
    tag: str | None = None

    model_config = {"from_attributes": True}


class CoreSettingUpdate(BaseModel):
    value: str
