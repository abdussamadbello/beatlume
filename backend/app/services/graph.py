import math
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.character import Character
from app.models.graph import CharacterEdge, CharacterNode, NodeType


def _initials(name: str) -> str:
    parts = [p for p in name.strip().split() if p]
    if not parts:
        return "??"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def _layout_position(index: int, total: int) -> tuple[float, float]:
    """Place nodes in a ring centered around raw (320, 230) with radius 180.

    The route scales raw coords to SVG space via x*1.4+40 and y*1.22, which
    keeps the ring inside the 920x560 graph viewport.
    """
    if total <= 1:
        return 320.0, 230.0
    angle = (2 * math.pi * index) / total - math.pi / 2
    return 320.0 + 180.0 * math.cos(angle), 230.0 + 180.0 * math.sin(angle)


async def ensure_nodes_for_characters(db: AsyncSession, story_id: uuid.UUID) -> bool:
    """Create a CharacterNode for every Character that doesn't have one yet.

    Returns True when at least one node was created so the caller can decide
    whether to re-fetch.
    """
    chars = list(
        (
            await db.execute(
                select(Character).where(Character.story_id == story_id).order_by(Character.scene_count.desc(), Character.name)
            )
        ).scalars().all()
    )
    if not chars:
        return False

    existing = {
        node.character_id
        for node in (
            await db.execute(
                select(CharacterNode).where(CharacterNode.story_id == story_id)
            )
        ).scalars().all()
    }

    missing = [c for c in chars if c.id not in existing]
    if not missing:
        return False

    total = len(chars)
    char_index = {c.id: i for i, c in enumerate(chars)}
    for char in missing:
        idx = char_index[char.id]
        x, y = _layout_position(idx, total)
        node_type = NodeType.hub if idx == 0 and total > 1 else None
        db.add(
            CharacterNode(
                story_id=story_id,
                org_id=char.org_id,
                character_id=char.id,
                x=x,
                y=y,
                label=char.name,
                initials=_initials(char.name),
                node_type=node_type,
                first_appearance_scene=1,
            )
        )
    await db.commit()
    return True


async def get_graph(db: AsyncSession, story_id: uuid.UUID) -> tuple[list[CharacterNode], list[CharacterEdge]]:
    await ensure_nodes_for_characters(db, story_id)
    nodes = (await db.execute(select(CharacterNode).where(CharacterNode.story_id == story_id))).scalars().all()
    edges = (await db.execute(select(CharacterEdge).where(CharacterEdge.story_id == story_id))).scalars().all()
    return list(nodes), list(edges)


async def update_node(db: AsyncSession, story_id: uuid.UUID, node_id: uuid.UUID, patch: dict) -> CharacterNode | None:
    result = await db.execute(select(CharacterNode).where(CharacterNode.id == node_id, CharacterNode.story_id == story_id))
    node = result.scalar_one_or_none()
    if not node:
        return None
    for k, v in patch.items():
        if v is not None:
            setattr(node, k, v)
    await db.commit()
    await db.refresh(node)
    return node


async def create_edge(db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, data: dict) -> CharacterEdge:
    edge = CharacterEdge(story_id=story_id, org_id=org_id, **data)
    db.add(edge)
    await db.commit()
    await db.refresh(edge)
    return edge


async def update_edge(db: AsyncSession, story_id: uuid.UUID, edge_id: uuid.UUID, patch: dict) -> CharacterEdge | None:
    result = await db.execute(select(CharacterEdge).where(CharacterEdge.id == edge_id, CharacterEdge.story_id == story_id))
    edge = result.scalar_one_or_none()
    if not edge:
        return None
    for k, v in patch.items():
        if v is not None:
            setattr(edge, k, v)
    await db.commit()
    await db.refresh(edge)
    return edge


async def delete_all_edges_for_story(db: AsyncSession, story_id: uuid.UUID) -> int:
    edges = (await db.execute(select(CharacterEdge).where(CharacterEdge.story_id == story_id))).scalars().all()
    n = 0
    for edge in list(edges):
        await db.delete(edge)
        n += 1
    await db.commit()
    return n


async def delete_edge(db: AsyncSession, story_id: uuid.UUID, edge_id: uuid.UUID) -> bool:
    result = await db.execute(select(CharacterEdge).where(CharacterEdge.id == edge_id, CharacterEdge.story_id == story_id))
    edge = result.scalar_one_or_none()
    if not edge:
        return False
    await db.delete(edge)
    await db.commit()
    return True
