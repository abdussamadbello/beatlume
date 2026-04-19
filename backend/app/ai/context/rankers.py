import math

from app.ai.context.retrievers import SceneContext


def rank_scenes_for_continuation(
    scenes: list[SceneContext], target_n: int
) -> list[tuple[SceneContext, float]]:
    """Rank scenes by relevance for prose continuation. Higher score = more relevant."""
    scored = []
    for s in scenes:
        distance = abs(s.n - target_n)
        # Exponential decay by distance
        proximity_score = math.exp(-0.5 * distance)
        score = proximity_score
        scored.append((s, score))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored


def rank_scenes_for_insights(
    scenes: list[SceneContext], category: str | None = None
) -> list[tuple[SceneContext, float]]:
    """Rank scenes by relevance for insight analysis."""
    scored = []
    for s in scenes:
        score = 1.0
        if category == "Pacing":
            # Extreme tensions are more interesting for pacing analysis
            score = abs(s.tension - 5.5) / 4.5
        elif category == "Characters":
            # Scenes with named POV are more relevant
            score = 1.0 if s.pov else 0.5
        scored.append((s, score))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored
