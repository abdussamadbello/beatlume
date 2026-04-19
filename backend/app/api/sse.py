import asyncio
import json
import uuid

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.config import settings
from app.deps import get_current_user, get_story
from app.models.story import Story
from app.models.user import User

router = APIRouter(prefix="/api/stories/{story_id}", tags=["sse"])


@router.get("/events")
async def story_events(
    story: Story = Depends(get_story),
    user: User = Depends(get_current_user),
):
    """SSE endpoint for real-time story events."""

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
