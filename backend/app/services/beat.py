"""Beats service — CRUD over the scene-scoped `beats` table.

Ordering is per-scene via `beat.n`, auto-assigned on create (max + 1).
The UniqueConstraint(scene_id, n) means gap-closing after a delete is
the caller's responsibility — for now we leave gaps; reorder is a
separate concern (same as scene.n).
"""
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.beat import Beat


async def list_beats(db: AsyncSession, scene_id: uuid.UUID) -> list[Beat]:
    result = await db.execute(
        select(Beat).where(Beat.scene_id == scene_id).order_by(Beat.n)
    )
    return list(result.scalars().all())


async def get_beat(
    db: AsyncSession, scene_id: uuid.UUID, beat_id: uuid.UUID
) -> Beat | None:
    result = await db.execute(
        select(Beat).where(Beat.id == beat_id, Beat.scene_id == scene_id)
    )
    return result.scalar_one_or_none()


async def create_beat(
    db: AsyncSession,
    scene_id: uuid.UUID,
    org_id: uuid.UUID,
    data: dict,
) -> Beat:
    max_n = await db.execute(
        select(func.max(Beat.n)).where(Beat.scene_id == scene_id)
    )
    next_n = (max_n.scalar() or 0) + 1
    beat = Beat(scene_id=scene_id, org_id=org_id, n=next_n, **data)
    db.add(beat)
    await db.commit()
    await db.refresh(beat)
    return beat


async def update_beat(db: AsyncSession, beat: Beat, patch: dict) -> Beat:
    for key, value in patch.items():
        if value is not None:
            setattr(beat, key, value)
    await db.commit()
    await db.refresh(beat)
    return beat


async def delete_beat(db: AsyncSession, beat: Beat) -> None:
    await db.delete(beat)
    await db.commit()
