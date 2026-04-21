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
    return compute_presence(scene_dicts, char_dicts)


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

    arcs = []
    for char in characters:
        presence = [
            s.pov.strip().lower() == char.name.strip().lower() for s in scenes
        ]
        arc = compute_character_arc(tensions, presence)
        arc["character_name"] = char.name
        arc["character_id"] = str(char.id)
        arcs.append(arc)

    return {"arcs": arcs}


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
