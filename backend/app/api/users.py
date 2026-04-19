from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_db
from app.models.user import Membership, Organization, User
from app.schemas.user import OrgRead, UserRead, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserRead)
async def update_me(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.name is not None:
        user.name = body.name
    if body.avatar_url is not None:
        user.avatar_url = body.avatar_url
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/me/organizations", response_model=list[OrgRead])
async def get_my_orgs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Organization)
        .join(Membership, Membership.org_id == Organization.id)
        .where(Membership.user_id == user.id)
    )
    return result.scalars().all()
