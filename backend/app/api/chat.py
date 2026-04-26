import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.graphs.chat_agent import run_chat_turn
from app.deps import get_current_org, get_current_user, get_db, get_story
from app.models.story import Story
from app.models.user import Organization
from app.schemas.chat import ChatMessageRead, ChatThreadRead, RejectToolCallRequest, SendMessageRequest
from app.services import chat_service

# Story-scoped routes (require story access via dep)
story_router = APIRouter(prefix="/api/stories/{story_id}/chat", tags=["chat"])
# Thread-scoped routes (lookup + service-layer org check for 404-not-403 isolation)
thread_router = APIRouter(prefix="/api/chat", tags=["chat"])


class CreateThreadBody(BaseModel):
    title: str | None = None


class ThreadListResponse(BaseModel):
    items: list[ChatThreadRead]
    total: int


class MessageListResponse(BaseModel):
    items: list[ChatMessageRead]
    total: int


@story_router.post("/threads", response_model=ChatThreadRead, status_code=status.HTTP_201_CREATED)
async def create_thread(
    body: CreateThreadBody,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    thread = await chat_service.create_thread(db, org.id, story.id, title=body.title)
    return thread


@story_router.get("/threads", response_model=ThreadListResponse)
async def list_threads(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
    include_archived: bool = Query(False),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    rows, total = await chat_service.list_threads(
        db, story.id, include_archived=include_archived, offset=offset, limit=limit
    )
    return ThreadListResponse(items=[ChatThreadRead.model_validate(r) for r in rows], total=total)


@thread_router.get("/threads/{thread_id}", response_model=ChatThreadRead)
async def get_thread(
    thread_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    org: Organization = Depends(get_current_org),
):
    thread = await chat_service.get_thread(db, thread_id)
    if thread is None or thread.org_id != org.id:
        raise HTTPException(status_code=404, detail="Thread not found")
    return thread


@thread_router.delete("/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_thread(
    thread_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    org: Organization = Depends(get_current_org),
):
    thread = await chat_service.get_thread(db, thread_id)
    if thread is None or thread.org_id != org.id:
        raise HTTPException(status_code=404, detail="Thread not found")
    await chat_service.archive_thread(db, thread_id)
    return None


@thread_router.get("/threads/{thread_id}/messages", response_model=MessageListResponse)
async def get_messages(
    thread_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    org: Organization = Depends(get_current_org),
    offset: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
):
    thread = await chat_service.get_thread(db, thread_id)
    if thread is None or thread.org_id != org.id:
        raise HTTPException(status_code=404, detail="Thread not found")
    rows, total = await chat_service.list_messages(db, thread_id, offset=offset, limit=limit)
    return MessageListResponse(items=[ChatMessageRead.model_validate(r) for r in rows], total=total)


@thread_router.post("/threads/{thread_id}/messages")
async def send_message(
    thread_id: uuid.UUID,
    body: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    org: Organization = Depends(get_current_org),
):
    thread = await chat_service.get_thread(db, thread_id)
    if thread is None or thread.org_id != org.id:
        # Defense-in-depth: same 404-not-403 pattern Task 5 established for cross-org access
        raise HTTPException(status_code=404, detail="Thread not found")

    async def event_stream():
        async for event in run_chat_turn(
            db,
            org_id=org.id,
            story_id=thread.story_id,
            thread=thread,
            user_text=body.content,
            active_scene_id=body.active_scene_id,
        ):
            event_type = event["type"]
            data = json.dumps(event["data"])
            yield f"event: {event_type}\ndata: {data}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@thread_router.post("/tool_calls/{message_id}/apply")
async def apply_tool_call(
    message_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    org: Organization = Depends(get_current_org),
):
    msg = await chat_service.get_message(db, message_id)
    if msg is None:
        raise HTTPException(status_code=404, detail="Tool call not found")
    thread = await chat_service.get_thread(db, msg.thread_id)
    if thread is None or thread.org_id != org.id:
        raise HTTPException(status_code=404, detail="Tool call not found")
    result = await chat_service.apply_tool_call(db, message_id, org.id, thread.story_id)
    if result.get("applied") is False:
        raise HTTPException(status_code=409, detail=result)
    return result


@thread_router.post("/tool_calls/{message_id}/reject")
async def reject_tool_call(
    message_id: uuid.UUID,
    body: RejectToolCallRequest,
    db: AsyncSession = Depends(get_db),
    org: Organization = Depends(get_current_org),
):
    # Cross-org check (defense-in-depth) before mutating
    msg = await chat_service.get_message(db, message_id)
    if msg is None:
        raise HTTPException(status_code=404, detail="Tool call not found")
    thread = await chat_service.get_thread(db, msg.thread_id)
    if thread is None or thread.org_id != org.id:
        raise HTTPException(status_code=404, detail="Tool call not found")

    ok = await chat_service.reject_tool_call(db, message_id, reason=body.reason)
    if not ok:
        raise HTTPException(status_code=409, detail={"applied": False, "error": "not_proposed_or_missing"})
    return {"rejected": True}
