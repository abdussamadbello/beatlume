import uuid
from pydantic import BaseModel


class NodeRead(BaseModel):
    id: uuid.UUID
    character_id: uuid.UUID
    x: float
    y: float
    label: str
    initials: str
    node_type: str | None = None
    first_appearance_scene: int

    model_config = {"from_attributes": True}


class NodeUpdate(BaseModel):
    x: float | None = None
    y: float | None = None


class EdgeCreate(BaseModel):
    source_node_id: uuid.UUID
    target_node_id: uuid.UUID
    kind: str
    weight: float = 0.5


class EdgeRead(BaseModel):
    id: uuid.UUID
    source_node_id: uuid.UUID
    target_node_id: uuid.UUID
    kind: str
    weight: float
    provenance: str
    evidence: list = []
    first_evidenced_scene: int

    model_config = {"from_attributes": True}


class EdgeUpdate(BaseModel):
    kind: str | None = None
    weight: float | None = None


class GraphResponse(BaseModel):
    nodes: list[NodeRead]
    edges: list[EdgeRead]
