import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.core import CoreConfigNode, CoreKind, CoreSetting
from app.models.story import Story


# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------


def _default_settings(story: Story) -> list[dict]:
    primary_genre = story.genres[0] if story.genres else "Unspecified"
    return [
        {"key": "Title", "value": story.title, "source": "user", "tag": None},
        {"key": "Genre", "value": primary_genre, "source": "user", "tag": "primary"},
        {"key": "Target words", "value": f"{story.target_words:,}", "source": "user", "tag": None},
        {"key": "Draft", "value": str(story.draft_number), "source": "system", "tag": None},
        {"key": "Act structure", "value": story.structure_type, "source": "user", "tag": None},
        {"key": "Status", "value": story.status.value, "source": "system", "tag": None},
    ]


def _default_root_node(story: Story) -> dict:
    return {
        "depth": 0,
        "label": story.title,
        "kind": CoreKind.story,
        "active": True,
        "sort_order": 0,
        "parent_id": None,
    }


def populate_default_core_sync(db: Session, story: Story) -> None:
    """Seed minimal core config + settings for a brand-new story. Idempotent."""
    has_node = db.execute(
        select(func.count()).select_from(CoreConfigNode).where(CoreConfigNode.story_id == story.id)
    ).scalar()
    if not has_node:
        db.add(
            CoreConfigNode(
                id=uuid.uuid4(),
                org_id=story.org_id,
                story_id=story.id,
                **_default_root_node(story),
            )
        )

    existing_keys = {
        row[0]
        for row in db.execute(
            select(CoreSetting.key).where(
                CoreSetting.story_id == story.id, CoreSetting.config_node_id.is_(None)
            )
        ).all()
    }
    for s in _default_settings(story):
        if s["key"] in existing_keys:
            continue
        db.add(
            CoreSetting(
                id=uuid.uuid4(),
                org_id=story.org_id,
                story_id=story.id,
                config_node_id=None,
                **s,
            )
        )


async def populate_default_core(db: AsyncSession, story: Story) -> None:
    """Async variant used by the create_story API path."""
    has_node = (
        await db.execute(
            select(func.count())
            .select_from(CoreConfigNode)
            .where(CoreConfigNode.story_id == story.id)
        )
    ).scalar()
    if not has_node:
        db.add(
            CoreConfigNode(
                id=uuid.uuid4(),
                org_id=story.org_id,
                story_id=story.id,
                **_default_root_node(story),
            )
        )

    existing_rows = (
        await db.execute(
            select(CoreSetting.key).where(
                CoreSetting.story_id == story.id, CoreSetting.config_node_id.is_(None)
            )
        )
    ).all()
    existing_keys = {row[0] for row in existing_rows}
    for s in _default_settings(story):
        if s["key"] in existing_keys:
            continue
        db.add(
            CoreSetting(
                id=uuid.uuid4(),
                org_id=story.org_id,
                story_id=story.id,
                config_node_id=None,
                **s,
            )
        )
    await db.flush()


# ---------------------------------------------------------------------------
# Resolution
# ---------------------------------------------------------------------------


@dataclass
class ResolvedSetting:
    key: str
    value: str
    source: str
    tag: str | None
    defined_at_node_id: uuid.UUID | None  # None = story root
    defined_at_label: str  # human-readable, e.g. "Story" or "Ch 2 — Wren"
    is_override: bool  # True when defined on the queried node itself


async def _load_all_nodes(db: AsyncSession, story_id: uuid.UUID) -> dict[uuid.UUID, CoreConfigNode]:
    result = await db.execute(
        select(CoreConfigNode).where(CoreConfigNode.story_id == story_id)
    )
    return {n.id: n for n in result.scalars().all()}


def _ancestor_chain(
    node_id: uuid.UUID | None,
    nodes_by_id: dict[uuid.UUID, CoreConfigNode],
) -> list[uuid.UUID]:
    """Return ids from the target node up through its ancestors (target first)."""
    chain: list[uuid.UUID] = []
    visited: set[uuid.UUID] = set()
    cur = node_id
    while cur is not None and cur in nodes_by_id and cur not in visited:
        visited.add(cur)
        chain.append(cur)
        cur = nodes_by_id[cur].parent_id
    return chain


async def resolve_settings_for_node(
    db: AsyncSession,
    story_id: uuid.UUID,
    node_id: uuid.UUID | None,
) -> list[ResolvedSetting]:
    """Return the resolved settings for a given node.

    Walks from `node_id` up through parents. For each key, the nearest-defined
    value wins. Story-root (NULL config_node_id) rows act as the final
    fallback. Keys defined only at story-root are returned with
    `defined_at_node_id = None` and `is_override = False`.
    """
    nodes_by_id = await _load_all_nodes(db, story_id)
    chain = _ancestor_chain(node_id, nodes_by_id)

    settings_result = await db.execute(
        select(CoreSetting).where(CoreSetting.story_id == story_id)
    )
    settings = settings_result.scalars().all()

    by_node: dict[uuid.UUID | None, list[CoreSetting]] = {}
    for s in settings:
        by_node.setdefault(s.config_node_id, []).append(s)

    resolved: dict[str, ResolvedSetting] = {}

    # Walk node chain first, then fall back to story-root (None).
    for ancestor_id in chain:
        for s in by_node.get(ancestor_id, []):
            if s.key in resolved:
                continue
            node_label = nodes_by_id[ancestor_id].label if ancestor_id in nodes_by_id else "?"
            resolved[s.key] = ResolvedSetting(
                key=s.key,
                value=s.value,
                source=s.source,
                tag=s.tag,
                defined_at_node_id=ancestor_id,
                defined_at_label=node_label,
                is_override=(ancestor_id == node_id) if node_id else False,
            )

    for s in by_node.get(None, []):
        if s.key in resolved:
            continue
        resolved[s.key] = ResolvedSetting(
            key=s.key,
            value=s.value,
            source=s.source,
            tag=s.tag,
            defined_at_node_id=None,
            defined_at_label="Story",
            is_override=False,
        )

    return sorted(resolved.values(), key=lambda r: r.key.lower())


async def story_settings_dict(db: AsyncSession, story_id: uuid.UUID) -> dict[str, str]:
    """Return story-root core settings as a flat {key: value} dict.

    Only includes rows with `config_node_id IS NULL` (the story-level
    defaults). Consumers that need node-scoped resolution should use
    `resolve_settings_for_node` instead.
    """
    rows = (
        await db.execute(
            select(CoreSetting).where(
                CoreSetting.story_id == story_id, CoreSetting.config_node_id.is_(None)
            )
        )
    ).scalars().all()
    return {r.key: r.value for r in rows}


async def resolved_settings_dict(
    db: AsyncSession,
    story_id: uuid.UUID,
    node_id: uuid.UUID | None,
) -> dict[str, str]:
    """Return a flat {key: value} dict of resolved settings for the given node.

    Walks the parent chain, applying overrides. Use this for AI prompt
    assembly when you want scene-/chapter-scoped values.
    """
    resolved = await resolve_settings_for_node(db, story_id, node_id)
    return {r.key: r.value for r in resolved}
