import uuid
from pydantic import BaseModel


class InsightRead(BaseModel):
    id: uuid.UUID
    severity: str
    category: str
    title: str
    body: str
    refs: list[str]
    dismissed: bool

    model_config = {"from_attributes": True}
