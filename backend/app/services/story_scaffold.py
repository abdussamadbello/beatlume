"""Apply LLM story scaffold JSON to the database (scenes, characters, graph edges)."""

import re
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.character import Character
from app.models.graph import CharacterEdge, CharacterNode, EdgeKind, EdgeProvenance
from app.models.scene import Scene
from app.models.scene_participant import SceneParticipant
from app.services import character as character_service
from app.services import graph as graph_service
from app.services import scene as scene_service


class ScaffoldConflictError(Exception):
    """Story already has scenes and replace_existing is False."""


def _clamp_tension(v: int | float | str | None) -> int:
    if v is None:
        return 5
    try:
        n = int(v)
    except (TypeError, ValueError):
        return 5
    return max(1, min(10, n))


def _flatten_scenes(data: dict) -> list[dict]:
    rows: list[dict] = []
    for act in data.get("acts", []):
        act_n = int(act.get("act", 1) or 1)
        for scene in act.get("scenes", []):
            s = dict(scene)
            s["_act"] = act_n
            rows.append(s)
    rows.sort(key=lambda x: int(x.get("n", 0) or 0))
    return rows


def _edge_kind(s: str | None) -> EdgeKind:
    if not s:
        return EdgeKind.conflict
    key = s.lower().strip()
    try:
        return EdgeKind(key)
    except ValueError:
        return EdgeKind.conflict


async def _character_name_set(db: AsyncSession, story_id: uuid.UUID) -> set[str]:
    chars, _ = await character_service.list_characters(db, story_id, offset=0, limit=500)
    return {c.name.strip().lower() for c in chars if c.name}


async def _sync_scaffold_characters(
    db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, items: list[dict]
) -> None:
    existing = await _character_name_set(db, story_id)
    for c in items:
        name = (c.get("name") or "").strip()
        if not name:
            continue
        if name.lower() in existing:
            continue
        arc = c.get("arc")
        data = {
            "name": name,
            "role": (c.get("role") or "")[:100],
            "desire": c.get("desire") or "",
            "flaw": c.get("flaw") or "",
            "arc_summary": (str(arc) if arc is not None else "")[:10000],
        }
        await character_service.create_character(db, story_id, org_id, data)
        existing.add(name.lower())


async def _sync_scaffold_edges(
    db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, items: list[dict]
) -> None:
    if not items:
        return
    await graph_service.ensure_nodes_for_characters(db, story_id)
    ch = aliased(Character)
    result = await db.execute(
        select(CharacterNode, ch)
        .join(ch, ch.id == CharacterNode.character_id)
        .where(CharacterNode.story_id == story_id)
    )
    name_to_node: dict[str, uuid.UUID] = {}
    for node, character in result.all():
        name_to_node[character.name.strip().lower()] = node.id

    seen: set[tuple[uuid.UUID, uuid.UUID]] = set()
    for rel in items:
        sname = (rel.get("source") or "").strip().lower()
        tname = (rel.get("target") or "").strip().lower()
        sid = name_to_node.get(sname)
        tid = name_to_node.get(tname)
        if not sid or not tid or sid == tid:
            continue
        key = (sid, tid)
        if key in seen:
            continue
        seen.add(key)
        kind = _edge_kind(rel.get("kind"))
        w = rel.get("weight", 0.5)
        try:
            fw = float(w)
        except (TypeError, ValueError):
            fw = 0.5
        fw = max(0.0, min(1.0, fw))
        db.add(
            CharacterEdge(
                story_id=story_id,
                org_id=org_id,
                source_node_id=sid,
                target_node_id=tid,
                kind=kind,
                weight=fw,
                provenance=EdgeProvenance.scaffold,
                first_evidenced_scene=1,
            )
        )
    await db.commit()


async def apply_scaffold_to_story(
    db: AsyncSession,
    story_id: uuid.UUID,
    org_id: uuid.UUID,
    data: dict,
    *,
    replace_existing: bool = False,
) -> int:
    """Persist scaffold JSON: scenes, optional characters/relationships. Returns scene count created."""
    count_q = await db.execute(
        select(func.count()).select_from(Scene).where(Scene.story_id == story_id)
    )
    n_existing = int(count_q.scalar() or 0)
    if n_existing > 0 and not replace_existing:
        raise ScaffoldConflictError(
            "This story already has scenes. Set replace_existing to replace them."
        )
    if n_existing > 0 and replace_existing:
        await scene_service.delete_all_scenes_for_story(db, story_id)
        await graph_service.delete_all_edges_for_story(db, story_id)

    await _sync_scaffold_characters(db, story_id, org_id, data.get("characters") or [])

    flat = _flatten_scenes(data)
    for row in flat:
        act_n = int(row.get("_act", 1) or 1)
        title = (row.get("title") or "Untitled")[:500]
        raw_sum = row.get("summary")
        summary = (str(raw_sum).strip() if raw_sum is not None else "") or title
        data_scene = {
            "title": title,
            "pov": (row.get("pov") or "")[:255],
            "tension": _clamp_tension(row.get("tension")),
            "act": max(1, act_n),
            "location": (row.get("location") or "")[:500],
            "tag": (row.get("tag") or "")[:100],
            "summary": summary,
        }
        await scene_service.create_scene(db, story_id, org_id, data_scene)

    rels = data.get("relationships") or []
    if rels:
        await _sync_scaffold_edges(db, story_id, org_id, rels)

    # Mention-based participant sync. The LLM scaffold rarely returns explicit
    # participants; without this, only POV characters get linked to scenes,
    # which leaves infer_relationships with no co-occurrence to work from.
    await _sync_scene_participants_from_text(db, story_id, org_id)

    return len(flat)


def _name_pattern(name: str) -> re.Pattern:
    """Word-boundary, case-insensitive regex for a character name.
    \b avoids matching 'Sam' inside 'Samuel'."""
    return re.compile(r"\b" + re.escape(name.strip()) + r"\b", re.IGNORECASE)


async def _sync_scene_participants_from_text(
    db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID
) -> int:
    """Scan each scene's title + summary for character name mentions and add
    a SceneParticipant row per match. Best-effort, idempotent — skips pairs
    that already exist. Returns the number of new rows added.

    Role assignment: the scene's POV character (if matched) is recorded as
    role='pov'; everyone else as role='supporting'. This is intentionally
    coarse — fine-grained roles can be edited in the UI later.
    """
    chars = list(
        (await db.execute(select(Character).where(Character.story_id == story_id)))
        .scalars()
        .all()
    )
    if not chars:
        return 0
    scenes = list(
        (await db.execute(select(Scene).where(Scene.story_id == story_id)))
        .scalars()
        .all()
    )
    if not scenes:
        return 0

    existing = (
        await db.execute(
            select(SceneParticipant.scene_id, SceneParticipant.character_id).where(
                SceneParticipant.scene_id.in_([s.id for s in scenes]),
            )
        )
    ).all()
    existing_pairs: set[tuple[uuid.UUID, uuid.UUID]] = {
        (row[0], row[1]) for row in existing
    }

    name_patterns = [(c, _name_pattern(c.name)) for c in chars if (c.name or "").strip()]

    added = 0
    for scene in scenes:
        text = " ".join([scene.title or "", scene.summary or ""])
        if not text.strip():
            continue
        pov_lower = (scene.pov or "").strip().lower()
        for char, pat in name_patterns:
            if not pat.search(text):
                continue
            key = (scene.id, char.id)
            if key in existing_pairs:
                continue
            role = "pov" if pov_lower == char.name.strip().lower() else "supporting"
            db.add(
                SceneParticipant(
                    scene_id=scene.id,
                    character_id=char.id,
                    role=role,
                    org_id=org_id,
                )
            )
            existing_pairs.add(key)
            added += 1
    if added:
        await db.commit()
    return added
