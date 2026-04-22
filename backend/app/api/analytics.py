"""Analytics API endpoints for story analysis."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_story
from app.models.character import Character
from app.models.graph import CharacterEdge
from app.models.insight import Insight
from app.models.scene import Scene
from app.models.scene_participant import SceneParticipant
from app.models.story import Story
from app.services.analytics.arcs import compute_character_arc
from app.services.analytics.health import compute_health
from app.services.analytics.pacing import analyze_pacing
from app.services.analytics.presence import compute_presence
from app.services.analytics.sparkline import tension_sparkline
from app.services.analytics.tension import compute_tension_curve

router = APIRouter(
    prefix="/api/stories/{story_id}/analytics",
    tags=["analytics"],
)


async def _load_scenes(db: AsyncSession, story_id: uuid.UUID) -> list[Scene]:
    result = await db.execute(
        select(Scene).where(Scene.story_id == story_id).order_by(Scene.n)
    )
    return list(result.scalars().all())


async def _load_characters(db: AsyncSession, story_id: uuid.UUID) -> list[Character]:
    result = await db.execute(
        select(Character).where(Character.story_id == story_id)
    )
    return list(result.scalars().all())


_ROMAN = ("", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X")


def _act_label(act: int) -> str:
    if 1 <= act <= 10:
        return f"Act {_ROMAN[act]}"
    return f"Act {act}"


def _chart_acts_from_scenes(scenes: list[Scene]) -> list[dict[str, int | str]]:
    if not scenes:
        return []
    out: list[dict[str, int | str]] = []
    for i, scene in enumerate(scenes):
        if i == 0 or scene.act != scenes[i - 1].act:
            out.append({"at": i, "label": _act_label(scene.act)})
    return out


@router.get("/tension-curve")
async def get_tension_curve(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    scenes = await _load_scenes(db, story.id)
    tensions = [s.tension for s in scenes]
    result = compute_tension_curve(tensions)
    chart_peaks = [
        {"at": p["scene_index"], "v": p["tension"], "label": p["label"]}
        for p in result["peaks"]
    ]
    return {
        **result,
        "data": tensions,
        "acts": _chart_acts_from_scenes(scenes),
        "peaks": chart_peaks,
    }


@router.get("/pacing")
async def get_pacing(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    scenes = await _load_scenes(db, story.id)
    tensions = [s.tension for s in scenes]
    return analyze_pacing(tensions)


@router.get("/presence")
async def get_presence(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    scenes = await _load_scenes(db, story.id)
    characters = await _load_characters(db, story.id)
    scene_dicts = [
        {"pov": s.pov, "title": s.title, "summary": s.summary or ""}
        for s in scenes
    ]
    char_dicts = [{"name": c.name} for c in characters]

    # Canonical source of presence is scene_participants. For each scene with
    # no participant rows we fall back to pov-string matching — keeps stories
    # seeded before migration 5b2c3d4e6f7a working. Summary-mention detection
    # applies in either branch so a character named in prose still surfaces.
    participant_roles = await _load_participant_roles(db, story.id)
    scenes_with_participants = {scene_id for scene_id, _ in participant_roles}

    presence_matrix = [
        [
            _presence_level(
                scene=s,
                char=c,
                participant_roles=participant_roles,
                scenes_with_participants=scenes_with_participants,
            )
            for s in scenes
        ]
        for c in characters
    ]
    return compute_presence(scene_dicts, char_dicts, presence_matrix=presence_matrix)


async def _load_participant_roles(
    db: AsyncSession, story_id: uuid.UUID
) -> dict[tuple[uuid.UUID, uuid.UUID], str]:
    """Load (scene_id, character_id) → role for all participants in a story."""
    result = await db.execute(
        select(
            SceneParticipant.scene_id,
            SceneParticipant.character_id,
            SceneParticipant.role,
        )
        .join(Scene, Scene.id == SceneParticipant.scene_id)
        .where(Scene.story_id == story_id)
    )
    return {(row.scene_id, row.character_id): row.role for row in result}


def _presence_level(
    *,
    scene: Scene,
    char: Character,
    participant_roles: dict[tuple[uuid.UUID, uuid.UUID], str],
    scenes_with_participants: set[uuid.UUID],
) -> int:
    """Return 0=absent, 1=mentioned/supporting, 2=POV for a (scene, character) pair.

    Participant row is canonical; pov-string fallback only fires when a scene
    has no participant rows at all. Summary mention remains a secondary signal.
    """
    role = participant_roles.get((scene.id, char.id))
    if role is not None:
        return 2 if role == "pov" else 1
    if scene.id not in scenes_with_participants:
        if scene.pov.strip().lower() == char.name.strip().lower():
            return 2
    summary = (scene.summary or "").lower()
    if summary and char.name.lower() in summary:
        return 1
    return 0


@router.get("/arcs")
async def get_arcs(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
    character_id: uuid.UUID | None = Query(None),
):
    scenes = await _load_scenes(db, story.id)
    characters = await _load_characters(db, story.id)
    tensions = [s.tension for s in scenes]

    if character_id:
        characters = [c for c in characters if c.id == character_id]

    # Canonical source of presence is scene_participants. Fallback to the
    # pov string match only for scenes that have no participants recorded —
    # keeps stories seeded before migration 5b2c3d4e6f7a working.
    participants = await _load_participant_set(db, story.id)
    scenes_with_participants = {
        scene_id for scene_id, _ in participants
    }

    arcs = []
    for char in characters:
        presence = [
            _is_present(scene=s, char=char, participants=participants,
                        scenes_with_participants=scenes_with_participants)
            for s in scenes
        ]
        arc = compute_character_arc(tensions, presence)
        arc["character_name"] = char.name
        arc["character_id"] = str(char.id)
        arcs.append(arc)

    return {"arcs": arcs}


async def _load_participant_set(
    db: AsyncSession, story_id: uuid.UUID
) -> set[tuple[uuid.UUID, uuid.UUID]]:
    """Load (scene_id, character_id) tuples for all participants in a story."""
    result = await db.execute(
        select(SceneParticipant.scene_id, SceneParticipant.character_id)
        .join(Scene, Scene.id == SceneParticipant.scene_id)
        .where(Scene.story_id == story_id)
    )
    return {(row.scene_id, row.character_id) for row in result}


def _is_present(
    *,
    scene: Scene,
    char: Character,
    participants: set[tuple[uuid.UUID, uuid.UUID]],
    scenes_with_participants: set[uuid.UUID],
) -> bool:
    if (scene.id, char.id) in participants:
        return True
    # Fallback: pov string match, only for scenes that have no participant
    # rows at all (pre-migration data).
    if scene.id not in scenes_with_participants:
        return scene.pov.strip().lower() == char.name.strip().lower()
    return False


@router.get("/health")
async def get_health(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    scenes = await _load_scenes(db, story.id)
    characters = await _load_characters(db, story.id)

    edge_result = await db.execute(
        select(CharacterEdge).where(CharacterEdge.story_id == story.id)
    )
    edges = list(edge_result.scalars().all())

    insight_result = await db.execute(
        select(Insight).where(Insight.story_id == story.id)
    )
    insights = list(insight_result.scalars().all())

    scene_dicts = [
        {"tension": s.tension, "pov": s.pov, "act": s.act}
        for s in scenes
    ]
    char_dicts = [{"name": c.name} for c in characters]
    edge_list = [{"id": str(e.id)} for e in edges]
    insight_list = [{"dismissed": e.dismissed} for e in insights]

    # Approximate word count (would come from draft_contents in production)
    word_count = 0

    return compute_health(
        scenes=scene_dicts,
        characters=char_dicts,
        edges=edge_list,
        insights=insight_list,
        word_count=word_count,
        target_words=story.target_words,
    )


@router.get("/sparkline")
async def get_sparkline(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
    points: int = Query(12, ge=4, le=50),
):
    scenes = await _load_scenes(db, story.id)
    tensions = [s.tension for s in scenes]
    return {"sparkline": tension_sparkline(tensions, target_points=points)}
