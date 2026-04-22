import uuid
from pydantic import BaseModel


class SceneParticipantCreate(BaseModel):
    character_id: uuid.UUID
    role: str = "supporting"
    interaction_weight: int | None = None


class SceneParticipantRead(BaseModel):
    id: uuid.UUID
    scene_id: uuid.UUID
    character_id: uuid.UUID
    role: str
    interaction_weight: int | None = None

    model_config = {"from_attributes": True}
