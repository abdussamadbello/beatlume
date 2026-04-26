import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_message import ChatMessage, ChatMessageRole, ToolCallStatus
from app.models.chat_thread import ChatThread
from app.ai.tools.chat_tools import WRITE_TOOL_APPLIERS


async def create_thread(
    db: AsyncSession,
    org_id: uuid.UUID,
    story_id: uuid.UUID,
    title: str | None = None,
) -> ChatThread:
    thread = ChatThread(org_id=org_id, story_id=story_id, title=title)
    db.add(thread)
    await db.commit()
    await db.refresh(thread)
    return thread


async def list_threads(
    db: AsyncSession,
    story_id: uuid.UUID,
    include_archived: bool = False,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[ChatThread], int]:
    base = select(ChatThread).where(ChatThread.story_id == story_id)
    count_base = select(func.count()).select_from(ChatThread).where(ChatThread.story_id == story_id)
    if not include_archived:
        base = base.where(ChatThread.archived_at.is_(None))
        count_base = count_base.where(ChatThread.archived_at.is_(None))
    query = base.order_by(ChatThread.updated_at.desc()).offset(offset).limit(limit)
    rows = list((await db.execute(query)).scalars().all())
    total = (await db.execute(count_base)).scalar() or 0
    return rows, total


async def get_thread(db: AsyncSession, thread_id: uuid.UUID) -> ChatThread | None:
    return (await db.execute(select(ChatThread).where(ChatThread.id == thread_id))).scalar_one_or_none()


async def archive_thread(db: AsyncSession, thread_id: uuid.UUID) -> ChatThread | None:
    thread = await get_thread(db, thread_id)
    if thread is None:
        return None
    thread.archived_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(thread)
    return thread


async def persist_message(
    db: AsyncSession,
    org_id: uuid.UUID,
    thread_id: uuid.UUID,
    role: ChatMessageRole,
    *,
    content: str | None = None,
    tool_calls: list[dict] | None = None,
    tool_call_status: ToolCallStatus | None = None,
    tool_call_result: dict | None = None,
) -> ChatMessage:
    msg = ChatMessage(
        org_id=org_id,
        thread_id=thread_id,
        role=role,
        content=content,
        tool_calls=tool_calls,
        tool_call_status=tool_call_status,
        tool_call_result=tool_call_result,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def list_messages(
    db: AsyncSession,
    thread_id: uuid.UUID,
    offset: int = 0,
    limit: int = 200,
) -> tuple[list[ChatMessage], int]:
    base = select(ChatMessage).where(ChatMessage.thread_id == thread_id)
    count_base = select(func.count()).select_from(ChatMessage).where(ChatMessage.thread_id == thread_id)
    query = base.order_by(ChatMessage.created_at.asc()).offset(offset).limit(limit)
    rows = list((await db.execute(query)).scalars().all())
    total = (await db.execute(count_base)).scalar() or 0
    return rows, total


async def get_message(db: AsyncSession, message_id: uuid.UUID) -> ChatMessage | None:
    return (await db.execute(select(ChatMessage).where(ChatMessage.id == message_id))).scalar_one_or_none()


async def apply_tool_call(
    db: AsyncSession, message_id: uuid.UUID, org_id: uuid.UUID, story_id: uuid.UUID,
) -> dict:
    msg = await get_message(db, message_id)
    if msg is None or msg.tool_call_status != ToolCallStatus.proposed:
        return {"applied": False, "error": "not_proposed_or_missing"}
    if not msg.tool_calls:
        return {"applied": False, "error": "no_tool_calls"}
    tc = msg.tool_calls[0]
    applier = WRITE_TOOL_APPLIERS.get(tc["name"])
    if applier is None:
        return {"applied": False, "error": "unknown_tool"}

    # Coerce UUID-shaped strings to uuid.UUID for the applier signature
    args = {**tc.get("arguments", {})}
    for k, v in list(args.items()):
        if isinstance(v, str) and len(v) == 36 and v.count("-") == 4:
            try:
                args[k] = uuid.UUID(v)
            except ValueError:
                pass

    result = await applier(db, story_id, org_id, **args)

    # If the applier reports failure (e.g., apply_summarize_scene fallback), don't mark as applied.
    if result.get("applied") is False:
        return result

    msg.tool_call_status = ToolCallStatus.applied
    msg.tool_call_result = {**(msg.tool_call_result or {}), "applied_result": result}
    await db.commit()
    await db.refresh(msg)
    return result


async def reject_tool_call(
    db: AsyncSession, message_id: uuid.UUID, reason: str | None = None,
) -> bool:
    msg = await get_message(db, message_id)
    if msg is None or msg.tool_call_status != ToolCallStatus.proposed:
        return False
    msg.tool_call_status = ToolCallStatus.rejected
    if reason:
        msg.tool_call_result = {**(msg.tool_call_result or {}), "rejection_reason": reason}
    await db.commit()
    return True
