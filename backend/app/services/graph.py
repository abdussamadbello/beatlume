import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.graph import CharacterEdge, CharacterNode


async def get_graph(db: AsyncSession, story_id: uuid.UUID) -> tuple[list[CharacterNode], list[CharacterEdge]]:
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


async def delete_edge(db: AsyncSession, story_id: uuid.UUID, edge_id: uuid.UUID) -> bool:
    result = await db.execute(select(CharacterEdge).where(CharacterEdge.id == edge_id, CharacterEdge.story_id == story_id))
    edge = result.scalar_one_or_none()
    if not edge:
        return False
    await db.delete(edge)
    await db.commit()
    return True
