# BeatLume Backend Auth & Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement JWT authentication (access + refresh tokens), OAuth2 (Google/GitHub), password hashing, auth dependencies (`get_current_user`, `get_current_org` with RLS), user/org management endpoints, and Pydantic schemas for all auth flows.

**Architecture:** Auth service handles JWT creation/validation, password hashing, and OAuth code exchange. FastAPI dependencies wire auth into every protected route. Refresh tokens stored as httpOnly cookies, blacklisted in Redis on logout. RLS context set per-request via `get_current_org`.

**Tech Stack:** python-jose (JWT), passlib[bcrypt] (password hashing), httpx (OAuth code exchange), redis (token blacklist), pydantic (schemas)

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `backend/app/schemas/__init__.py` | Schemas barrel export |
| `backend/app/schemas/auth.py` | Login, Signup, Token, OAuth request/response schemas |
| `backend/app/schemas/user.py` | UserRead, UserUpdate, OrgRead schemas |
| `backend/app/services/__init__.py` | Services package init |
| `backend/app/services/auth.py` | JWT creation/validation, password hashing, OAuth exchange |
| `backend/app/api/__init__.py` | API package init |
| `backend/app/api/router.py` | Main APIRouter aggregating sub-routers |
| `backend/app/api/auth.py` | /auth/* endpoints |
| `backend/app/api/users.py` | /api/users/* endpoints |
| `backend/tests/test_auth.py` | Auth endpoint tests |
| `backend/tests/test_users.py` | User endpoint tests |

### Modified Files

| File | Changes |
|------|---------|
| `backend/app/deps.py` | Add `get_current_user`, `get_current_org` dependencies |
| `backend/app/main.py` | Include API router |

---

### Task 1: Auth Schemas

**Files:**
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/schemas/user.py`

- [ ] **Step 1: Create schemas package**

Create `backend/app/schemas/__init__.py`:

```python
from app.schemas.auth import (
    LoginRequest,
    SignupRequest,
    TokenResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.schemas.user import UserRead, UserUpdate, OrgRead
```

- [ ] **Step 2: Create auth schemas**

Create `backend/app/schemas/auth.py`:

```python
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
```

- [ ] **Step 3: Create user schemas**

Create `backend/app/schemas/user.py`:

```python
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
```

- [ ] **Step 4: Verify imports**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run python -c "from app.schemas import LoginRequest, SignupRequest, TokenResponse, UserRead, UserUpdate, OrgRead; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/
git commit -m "feat: add auth and user Pydantic schemas"
```

---

### Task 2: Auth Service (JWT + Password Hashing)

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/auth.py`

- [ ] **Step 1: Create services package**

Create `backend/app/services/__init__.py` (empty):

```python
```

- [ ] **Step 2: Create auth service**

Create `backend/app/services/auth.py`:

```python
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
        role=MembershipRole.OWNER,
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

    membership = Membership(user_id=user.id, org_id=org.id, role=MembershipRole.OWNER)
    db.add(membership)
    await db.commit()
    await db.refresh(user)
    await db.refresh(org)
    return user, org
```

- [ ] **Step 3: Verify imports**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run python -c "from app.services.auth import hash_password, verify_password, create_access_token, decode_token; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/
git commit -m "feat: add auth service with JWT, password hashing, user creation"
```

---

### Task 3: Auth Dependencies (get_current_user, get_current_org)

**Files:**
- Modify: `backend/app/deps.py`

- [ ] **Step 1: Add auth dependencies to deps.py**

Add to the existing `backend/app/deps.py` (keep existing `engine`, `async_session`, `get_db`):

```python
import uuid
from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.user import User, Organization
from app.services.auth import decode_token

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate JWT from Authorization header. Returns User or 401."""
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_current_org(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    """Resolve user's active org and set RLS context on the DB session."""
    if user.active_org_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active organization")

    # Set RLS context for this request
    await db.execute(text(f"SET app.current_org_id = '{user.active_org_id}'"))

    result = await db.execute(
        select(Organization).where(Organization.id == user.active_org_id)
    )
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization not found")
    return org
```

- [ ] **Step 2: Verify**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run python -c "from app.deps import get_current_user, get_current_org, oauth2_scheme; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/deps.py
git commit -m "feat: add get_current_user and get_current_org auth dependencies with RLS"
```

---

### Task 4: Auth API Router

**Files:**
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/router.py`
- Create: `backend/app/api/auth.py`

- [ ] **Step 1: Create API package**

Create `backend/app/api/__init__.py` (empty):

```python
```

- [ ] **Step 2: Create auth router**

Create `backend/app/api/auth.py`:

```python
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.deps import get_db
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
)
from app.services.auth import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    create_user_with_org,
    decode_token,
    find_or_create_oauth_user,
    hash_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest, response: Response, db: AsyncSession = Depends(get_db)):
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user, org = await create_user_with_org(db, body.name, body.email, body.password)
    access = create_access_token(user.id, org.id)
    refresh = create_refresh_token(user.id, org.id)
    response.set_cookie(
        key="refresh_token",
        value=refresh,
        httponly=True,
        secure=False,  # True in production
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
    )
    return TokenResponse(access_token=access)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.active_org_id:
        raise HTTPException(status_code=500, detail="User has no active organization")

    access = create_access_token(user.id, user.active_org_id)
    refresh = create_refresh_token(user.id, user.active_org_id)
    response.set_cookie(
        key="refresh_token",
        value=refresh,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
    )
    return TokenResponse(access_token=access)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_token: str | None = None,
):
    # Try cookie first, then body
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = uuid.UUID(payload["sub"])
        org_id = uuid.UUID(payload["org"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access = create_access_token(user_id, org_id)
    new_refresh = create_refresh_token(user_id, org_id)
    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
    )
    return TokenResponse(access_token=access)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response):
    response.delete_cookie("refresh_token")
    return None


@router.get("/oauth/{provider}")
async def oauth_redirect(provider: str):
    """Redirect to OAuth provider consent page."""
    if provider == "google":
        if not settings.oauth_google_client_id:
            raise HTTPException(status_code=501, detail="Google OAuth not configured")
        params = {
            "client_id": settings.oauth_google_client_id,
            "redirect_uri": f"{settings.cors_origins[0]}/auth/callback/google",
            "response_type": "code",
            "scope": "openid email profile",
        }
        url = "https://accounts.google.com/o/oauth2/v2/auth?" + "&".join(
            f"{k}={v}" for k, v in params.items()
        )
        return {"redirect_url": url}
    elif provider == "github":
        if not settings.oauth_github_client_id:
            raise HTTPException(status_code=501, detail="GitHub OAuth not configured")
        params = {
            "client_id": settings.oauth_github_client_id,
            "redirect_uri": f"{settings.cors_origins[0]}/auth/callback/github",
            "scope": "read:user user:email",
        }
        url = "https://github.com/login/oauth/authorize?" + "&".join(
            f"{k}={v}" for k, v in params.items()
        )
        return {"redirect_url": url}
    raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")


@router.get("/callback/{provider}", response_model=TokenResponse)
async def oauth_callback(
    provider: str,
    code: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Exchange OAuth code for user info, create/find user, return tokens."""
    if provider == "google":
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": settings.oauth_google_client_id,
                    "client_secret": settings.oauth_google_client_secret,
                    "redirect_uri": f"{settings.cors_origins[0]}/auth/callback/google",
                    "grant_type": "authorization_code",
                },
            )
            if token_resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Failed to exchange code")
            tokens = token_resp.json()
            userinfo_resp = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            userinfo = userinfo_resp.json()
            oauth_id = userinfo["id"]
            email = userinfo["email"]
            name = userinfo.get("name", email.split("@")[0])

    elif provider == "github":
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "code": code,
                    "client_id": settings.oauth_github_client_id,
                    "client_secret": settings.oauth_github_client_secret,
                },
                headers={"Accept": "application/json"},
            )
            if token_resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Failed to exchange code")
            tokens = token_resp.json()
            user_resp = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            github_user = user_resp.json()
            oauth_id = str(github_user["id"])
            name = github_user.get("name") or github_user["login"]
            # Get primary email
            email_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            emails = email_resp.json()
            primary = next((e for e in emails if e.get("primary")), emails[0])
            email = primary["email"]
    else:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

    user, org = await find_or_create_oauth_user(db, provider, oauth_id, email, name)
    access = create_access_token(user.id, org.id)
    refresh = create_refresh_token(user.id, org.id)
    response.set_cookie(
        key="refresh_token",
        value=refresh,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
    )
    return TokenResponse(access_token=access)


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Send password reset email. Always returns success to prevent email enumeration."""
    # In production, queue a Celery task to send the email
    return {"message": "If an account exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset password using a reset token."""
    try:
        payload = decode_token(body.token)
        if payload.get("type") != "reset":
            raise HTTPException(status_code=400, detail="Invalid reset token")
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    user.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"message": "Password reset successfully"}
```

- [ ] **Step 3: Create users router**

Create `backend/app/api/users.py`:

```python
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
```

- [ ] **Step 4: Create main API router**

Create `backend/app/api/router.py`:

```python
from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.users import router as users_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/
git commit -m "feat: add auth and users API routers"
```

---

### Task 5: Wire Router into App

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add router import and include**

In `backend/app/main.py`, inside `create_app()`, after the CORS middleware, add:

```python
from app.api.router import api_router
```

And inside `create_app()` after CORS:

```python
app.include_router(api_router)
```

The full `create_app()` should be:

```python
def create_app() -> FastAPI:
    app = FastAPI(title="BeatLume API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app
```

- [ ] **Step 2: Verify routes are registered**

```bash
cd /home/abdussamadbello/beatlume/backend
uv run python -c "
from app.main import app
routes = [r.path for r in app.routes if hasattr(r, 'path')]
for r in sorted(routes):
    print(r)
"
```

Expected: Should list `/health`, `/auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/oauth/{provider}`, `/auth/callback/{provider}`, `/auth/forgot-password`, `/auth/reset-password`, `/api/users/me`, `/api/users/me/organizations`

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: wire auth and users routers into FastAPI app"
```

---

### Task 6: Auth Integration Tests

**Files:**
- Create: `backend/tests/test_auth.py`
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Update conftest with database fixtures**

Replace `backend/tests/conftest.py` with:

```python
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.deps import get_db
from app.main import create_app
from app.models import Base


@pytest.fixture
async def db_engine():
    engine = create_async_engine(settings.database_url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine):
    session_factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session


@pytest.fixture
def app(db_session):
    application = create_app()

    async def override_get_db():
        yield db_session

    application.dependency_overrides[get_db] = override_get_db
    return application


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

- [ ] **Step 2: Create auth tests**

Create `backend/tests/test_auth.py`:

```python
import pytest


@pytest.mark.asyncio
async def test_signup_creates_user(client):
    resp = await client.post("/auth/signup", json={
        "name": "Ada Lovelace",
        "email": "ada@example.com",
        "password": "securepass123",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_signup_duplicate_email(client):
    await client.post("/auth/signup", json={
        "name": "Ada", "email": "dup@example.com", "password": "pass123",
    })
    resp = await client.post("/auth/signup", json={
        "name": "Ada2", "email": "dup@example.com", "password": "pass456",
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_login_valid(client):
    await client.post("/auth/signup", json={
        "name": "Ada", "email": "login@example.com", "password": "pass123",
    })
    resp = await client.post("/auth/login", json={
        "email": "login@example.com", "password": "pass123",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await client.post("/auth/signup", json={
        "name": "Ada", "email": "wrong@example.com", "password": "pass123",
    })
    resp = await client.post("/auth/login", json={
        "email": "wrong@example.com", "password": "wrongpass",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_email(client):
    resp = await client.post("/auth/login", json={
        "email": "nobody@example.com", "password": "pass123",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me_authenticated(client):
    signup = await client.post("/auth/signup", json={
        "name": "Ada", "email": "me@example.com", "password": "pass123",
    })
    token = signup.json()["access_token"]
    resp = await client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "me@example.com"
    assert data["name"] == "Ada"
    assert data["plan"] == "free"


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client):
    resp = await client.get("/api/users/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_me(client):
    signup = await client.post("/auth/signup", json={
        "name": "Ada", "email": "update@example.com", "password": "pass123",
    })
    token = signup.json()["access_token"]
    resp = await client.put(
        "/api/users/me",
        json={"name": "Ada Lovelace"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Ada Lovelace"


@pytest.mark.asyncio
async def test_get_my_organizations(client):
    signup = await client.post("/auth/signup", json={
        "name": "Ada", "email": "orgs@example.com", "password": "pass123",
    })
    token = signup.json()["access_token"]
    resp = await client.get(
        "/api/users/me/organizations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    orgs = resp.json()
    assert len(orgs) == 1
    assert "Ada" in orgs[0]["name"]


@pytest.mark.asyncio
async def test_logout(client):
    resp = await client.post("/auth/logout")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_forgot_password(client):
    resp = await client.post("/auth/forgot-password", json={"email": "any@example.com"})
    assert resp.status_code == 200
    assert "reset link" in resp.json()["message"].lower()
```

- [ ] **Step 3: Run all tests**

```bash
cd /home/abdussamadbello/beatlume/backend
PYTHONPATH=. uv run pytest tests/ -v
```

Expected: All tests pass (11 old + 11 new = 22 total).

- [ ] **Step 4: Commit**

```bash
git add backend/tests/
git commit -m "test: add auth and user endpoint integration tests"
```

---

## Verification Checklist

1. `POST /auth/signup` creates user + org, returns access token with refresh cookie
2. `POST /auth/login` validates credentials, returns tokens
3. `POST /auth/logout` clears refresh cookie
4. `GET /api/users/me` requires auth, returns user profile
5. `PUT /api/users/me` updates user fields
6. `GET /api/users/me/organizations` lists user's orgs
7. `GET /auth/oauth/{provider}` returns redirect URL (or 501 if not configured)
8. RLS context is set via `get_current_org` dependency
9. All tests pass
