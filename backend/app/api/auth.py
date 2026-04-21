import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

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

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def signup(request: Request, body: SignupRequest, response: Response, db: AsyncSession = Depends(get_db)):
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
        secure=settings.environment != "development",
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
    )
    return TokenResponse(access_token=access)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
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
        secure=settings.environment != "development",
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
    )
    return TokenResponse(access_token=access)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_token = request.cookies.get("refresh_token")
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
        secure=settings.environment != "development",
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
    )
    return TokenResponse(access_token=access)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response):
    response.delete_cookie(
        key="refresh_token",
        path="/",
        secure=settings.environment != "development",
        httponly=True,
        samesite="lax",
    )
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
        secure=settings.environment != "development",
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
