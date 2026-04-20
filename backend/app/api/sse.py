import asyncio
import json
import uuid

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.deps import get_db
from app.models.story import Story
from app.models.user import User
from app.services.auth import decode_token

router = APIRouter(prefix="/api/stories/{story_id}", tags=["sse"])


async def _resolve_user(
    token: str | None, db: AsyncSession
) -> User | None:
    """Validate a JWT token string and return the user, or None."""
    if not token:
        return None
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


@router.get("/events")
async def story_events(
    story_id: uuid.UUID,
    token: str | None = Query(None),
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """SSE endpoint for real-time story events.

    Supports auth via Authorization header (standard) or via ``token`` query
    parameter (required by EventSource which cannot set custom headers).
    """
    # Try Authorization header first, then query-param token
    bearer_token: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer_token = authorization[7:]

    user = await _resolve_user(bearer_token, db) or await _resolve_user(token, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    # Verify story exists
    result = await db.execute(select(Story).where(Story.id == story_id))
    story = result.scalar_one_or_none()
    if story is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Story not found"
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
