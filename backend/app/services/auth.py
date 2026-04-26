import logging
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import redis as redis_lib
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import Organization, User, Membership, MembershipRole

ALGORITHM = "HS256"
logger = logging.getLogger(__name__)

_redis_client: redis_lib.Redis | None = None


def _get_redis() -> redis_lib.Redis:
    """Lazy Redis client for jti revocation. Reused across requests in a worker."""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis_lib.from_url(settings.redis_url)
    return _redis_client


def _revoked_key(jti: str) -> str:
    return f"revoked_jti:{jti}"


def revoke_jti(jti: str, ttl_seconds: int) -> None:
    """Mark a refresh-token jti as consumed/revoked. Idempotent.

    TTL matches the token's remaining lifetime — once it expires naturally, the
    revocation entry expires with it, so the set stays bounded automatically.
    """
    if ttl_seconds <= 0:
        return  # already expired by the JWT clock — no need to track
    try:
        _get_redis().set(_revoked_key(jti), "1", ex=ttl_seconds)
    except Exception:
        # Redis being down should not break logout/refresh — log and continue.
        # Worst case: a refresh token isn't revoked, but it'll still expire naturally.
        logger.warning("Failed to revoke jti %s", jti, exc_info=True)


def is_jti_revoked(jti: str) -> bool:
    """Return True if this jti has been previously consumed and should not be honored."""
    try:
        return bool(_get_redis().exists(_revoked_key(jti)))
    except Exception:
        # Fail-open on Redis outage: better to honor a valid token than to lock everyone out.
        # The TTL on JWTs is the second line of defense.
        logger.warning("Redis unavailable during jti check; allowing token", exc_info=True)
        return False


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


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


def create_sse_token(user_id: uuid.UUID, org_id: uuid.UUID, story_id: uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(seconds=settings.sse_token_expire_seconds)
    payload = {
        "sub": str(user_id),
        "org": str(org_id),
        "story": str(story_id),
        "exp": expire,
        "type": "sse",
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
