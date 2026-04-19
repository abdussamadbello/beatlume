import uuid

from pydantic import BaseModel


class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    avatar_url: str | None = None
    plan: str

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = None
    avatar_url: str | None = None


class OrgRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str

    model_config = {"from_attributes": True}
