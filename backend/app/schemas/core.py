import uuid
from pydantic import BaseModel


class CoreNodeRead(BaseModel):
    id: uuid.UUID
    parent_id: uuid.UUID | None = None
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
    """Raw (non-resolved) setting row."""

    id: uuid.UUID
    key: str
    value: str
    source: str
    tag: str | None = None
    config_node_id: uuid.UUID | None = None

    model_config = {"from_attributes": True}


class ResolvedSettingRead(BaseModel):
    """Resolved setting for a node: which ancestor defined it + whether it
    is an override at the queried node itself."""

    key: str
    value: str
    source: str
    tag: str | None = None
    defined_at_node_id: uuid.UUID | None = None
    defined_at_label: str
    is_override: bool


class CoreSettingCreate(BaseModel):
    key: str
    value: str
    source: str = "user"
    tag: str | None = None
    config_node_id: uuid.UUID | None = None


class CoreSettingUpdate(BaseModel):
    value: str | None = None
    source: str | None = None
    tag: str | None = None
