"""Character presence matrix computation."""

from __future__ import annotations


def compute_presence(
    scenes: list[dict],
    characters: list[dict],
    presence_matrix: list[list[int]] | None = None,
) -> dict:
    """Compute a character-vs-scene presence matrix.

    Args:
        scenes: list of scene dicts with at least "pov" field.
        characters: list of character dicts with at least "name" field.
        presence_matrix: optional pre-built matrix (rows=characters, cols=scenes)
            with values 0=absent, 1=mentioned, 2=POV. When provided, the pov/summary
            string-matching logic is skipped entirely. Used by the API layer to
            feed participant-based presence while keeping the stats computation here.

    Returns:
        Dict with matrix, characters, scenes, and stats.
    """
    if not scenes or not characters:
        return {"matrix": [], "characters": [], "scenes": [], "stats": []}

    char_names = [c["name"] for c in characters]
    n_scenes = len(scenes)

    if presence_matrix is not None:
        matrix = presence_matrix
    else:
        # Build binary matrix: rows=characters, cols=scenes
        # 0=absent, 1=mentioned (scene summary contains name), 2=POV
        matrix = []
        for c in characters:
            row = []
            name = c["name"]
            for s in scenes:
                pov = s.get("pov", "")
                summary = s.get("summary", "") or ""
                if pov and pov.strip().lower() == name.strip().lower():
                    row.append(2)
                elif name.lower() in summary.lower():
                    row.append(1)
                else:
                    row.append(0)
            matrix.append(row)

    # Per-character stats
    stats = []
    for c_idx, c in enumerate(characters):
        row = matrix[c_idx]
        scene_count = sum(1 for v in row if v > 0)
        pov_count = sum(1 for v in row if v == 2)
        coverage = round(scene_count / n_scenes, 3) if n_scenes > 0 else 0

        # Longest gap
        longest_gap = 0
        last_seen = -1
        for s_idx, v in enumerate(row):
            if v > 0:
                if last_seen >= 0:
                    gap = s_idx - last_seen - 1
                    longest_gap = max(longest_gap, gap)
                last_seen = s_idx

        stats.append({
            "name": c["name"],
            "scene_count": scene_count,
            "pov_count": pov_count,
            "coverage": coverage,
            "longest_gap": longest_gap,
        })

    scene_labels = [s.get("title", f"Scene {i + 1}") for i, s in enumerate(scenes)]

    return {
        "matrix": matrix,
        "characters": char_names,
        "scenes": scene_labels,
        "stats": stats,
    }
