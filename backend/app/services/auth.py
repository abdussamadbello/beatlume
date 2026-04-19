import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import Organization, User, Membership, MembershipRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: uuid.UUID, org_id: uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {
        "sub": str(user_id),
        "org": str(org_id),
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


def create_refresh_token(user_id: uuid.UUID, org_id: uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days)
    payload = {
        "sub": str(user_id),
        "org": str(org_id),
        "exp": expire,
        "type": "refresh",
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token. Raises JWTError on invalid/expired."""
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[ALGORITHM])


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    """Find user by email and verify password. Returns User or None."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


async def create_user_with_org(
    db: AsyncSession, name: str, email: str, password: str
) -> tuple[User, Organization]:
    """Create a new user with a personal organization."""
    slug = email.split("@")[0].lower().replace(".", "-") + "-" + uuid.uuid4().hex[:6]
    org = Organization(name=f"{name}'s Workspace", slug=slug)
    db.add(org)
    await db.flush()

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
        active_org_id=org.id,
    )
    db.add(user)
    await db.flush()

    membership = Membership(
        user_id=user.id,
        org_id=org.id,
        role=MembershipRole.owner,
    )
    db.add(membership)
    await db.commit()
    await db.refresh(user)
    await db.refresh(org)
    return user, org


async def find_or_create_oauth_user(
    db: AsyncSession,
    provider: str,
    oauth_id: str,
    email: str,
    name: str,
) -> tuple[User, Organization]:
    """Find existing OAuth user or create new one with personal org."""
    result = await db.execute(
        select(User).where(User.oauth_provider == provider, User.oauth_id == oauth_id)
    )
    user = result.scalar_one_or_none()
    if user:
        org_result = await db.execute(
            select(Organization).where(Organization.id == user.active_org_id)
        )
        org = org_result.scalar_one()
        return user, org

    # Also check by email
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        user.oauth_provider = provider
        user.oauth_id = oauth_id
        await db.commit()
        await db.refresh(user)
        org_result = await db.execute(
            select(Organization).where(Organization.id == user.active_org_id)
        )
        org = org_result.scalar_one()
        return user, org

    # Create new user + org
    slug = email.split("@")[0].lower().replace(".", "-") + "-" + uuid.uuid4().hex[:6]
    org = Organization(name=f"{name}'s Workspace", slug=slug)
    db.add(org)
    await db.flush()

    user = User(
        name=name,
        email=email,
        oauth_provider=provider,
        oauth_id=oauth_id,
        active_org_id=org.id,
    )
    db.add(user)
    await db.flush()

    membership = Membership(user_id=user.id, org_id=org.id, role=MembershipRole.owner)
    db.add(membership)
    await db.commit()
    await db.refresh(user)
    await db.refresh(org)
    return user, org
