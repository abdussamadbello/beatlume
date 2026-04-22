import asyncio
import json
import uuid

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.deps import get_current_org, get_current_user, get_db, get_story
from app.models.story import Story
from app.models.user import Organization, User
from app.services.auth import create_sse_token, decode_token

router = APIRouter(prefix="/api/stories/{story_id}", tags=["sse"])


class SSETokenResponse(BaseModel):
    token: str
    expires_in: int


async def _resolve_user_by_id(user_id: uuid.UUID, db: AsyncSession) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def _resolve_access_user(token: str | None, db: AsyncSession) -> tuple[User, dict] | None:
    """Validate an access JWT and return its user + payload, or None."""
    if not token:
        return None
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        return None
    user = await _resolve_user_by_id(user_id, db)
    if user is None:
        return None
    return user, payload


async def _resolve_sse_user(
    token: str | None,
    story_id: uuid.UUID,
    story: Story,
    db: AsyncSession,
) -> User | None:
    """Validate a story-scoped SSE JWT and return its user, or None."""
    if not token:
        return None
    try:
        payload = decode_token(token)
        if payload.get("type") != "sse":
            return None
        if uuid.UUID(payload["story"]) != story_id:
            return None
        if uuid.UUID(payload["org"]) != story.org_id:
            return None
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        return None
    return await _resolve_user_by_id(user_id, db)


@router.post("/events/token", response_model=SSETokenResponse)
async def create_story_events_token(
    story: Story = Depends(get_story),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_org),
):
    """Issue a short-lived, story-scoped token for browser EventSource auth."""
    return SSETokenResponse(
        token=create_sse_token(user.id, org.id, story.id),
        expires_in=settings.sse_token_expire_seconds,
    )


@router.get("/events")
async def story_events(
    story_id: uuid.UUID,
    sse_token: str | None = Query(None),
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """SSE endpoint for real-time story events.

    Supports auth via Authorization header for non-browser clients, or via a
    short-lived ``sse_token`` query parameter for browser EventSource.
    """
    # Verify story exists
    result = await db.execute(select(Story).where(Story.id == story_id))
    story = result.scalar_one_or_none()
    if story is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Story not found"
        )

    bearer_token: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer_token = authorization[7:]

    access_auth = await _resolve_access_user(bearer_token, db)
    user = access_auth[0] if access_auth else None
    access_org_id = uuid.UUID(access_auth[1]["org"]) if access_auth else None

    if user is not None and access_org_id != story.org_id:
        user = None

    if user is None:
        user = await _resolve_sse_user(sse_token, story_id, story, db)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    async def event_generator():
        r = aioredis.from_url(settings.redis_url)
        pubsub = r.pubsub()
        await pubsub.subscribe(f"story:{story.id}:events")
        try:
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=30)
                if message and message["type"] == "message":
                    event_data = json.loads(message["data"])
                    event_type = event_data.get("type", "message")
                    data = json.dumps(event_data.get("data", {}))
                    yield f"event: {event_type}\ndata: {data}\n\n"
                else:
                    # Send keepalive
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe()
            await r.aclose()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
