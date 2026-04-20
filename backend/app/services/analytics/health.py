"""Story health score computation with 6 weighted components."""

from __future__ import annotations

import numpy as np


def compute_health(
    scenes: list[dict],
    characters: list[dict],
    edges: list,
    insights: list,
    word_count: int,
    target_words: int,
) -> dict:
    """Compute a 0-100 story health score with letter grade.

    Components (weights):
        - completion  (0.20): word count vs target
        - pacing      (0.20): tension variance / range
        - character_coverage (0.20): characters with POV scenes
        - relationship_density (0.15): edge count relative to character pairs
        - structural_integrity (0.15): act distribution balance
        - issue_load  (0.10): inverse of open insight count

    Args:
        scenes: list of scene dicts with "tension", "pov", "act" fields.
        characters: list of character dicts with "name" field.
        edges: list of relationship edge records.
        insights: list of insight records.
        word_count: current total word count.
        target_words: target word count goal.

    Returns:
        Dict with score (0-100), grade (A-F), and components breakdown.
    """
    # --- Completion (0.20) ---
    if target_words > 0:
        completion = min(100.0, (word_count / target_words) * 100)
    else:
        completion = 100.0 if word_count > 0 else 0.0

    # --- Pacing (0.20) ---
    if len(scenes) >= 2:
        tensions = np.array([s.get("tension", 5) for s in scenes], dtype=float)
        tension_range = float(np.max(tensions) - np.min(tensions))
        tension_std = float(np.std(tensions))
        # Good pacing has moderate variance (std 1.5-3.0) and decent range (4-8)
        std_score = min(100.0, (tension_std / 2.5) * 100) if tension_std <= 2.5 else max(
            0, 100 - (tension_std - 2.5) * 20
        )
        range_score = min(100.0, (tension_range / 6.0) * 100)
        pacing = (std_score + range_score) / 2
    else:
        pacing = 0.0

    # --- Character coverage (0.20) ---
    if characters:
        char_names = {c["name"].lower() for c in characters}
        pov_chars = {s.get("pov", "").lower() for s in scenes if s.get("pov")}
        covered = len(char_names & pov_chars)
        character_coverage = (covered / len(char_names)) * 100
    else:
        character_coverage = 0.0

    # --- Relationship density (0.15) ---
    n_chars = len(characters)
    max_edges = n_chars * (n_chars - 1) / 2 if n_chars >= 2 else 1
    edge_count = len(edges) if edges else 0
    relationship_density = min(100.0, (edge_count / max(max_edges, 1)) * 100)

    # --- Structural integrity (0.15) ---
    if scenes:
        acts = [s.get("act", 1) for s in scenes]
        unique_acts = set(acts)
        # 3-act structure: expect acts 1, 2, 3
        if len(unique_acts) >= 3:
            act_counts = [acts.count(a) for a in sorted(unique_acts)]
            total = sum(act_counts)
            # Ideal: ~25% act 1, ~50% act 2, ~25% act 3
            balance = 1.0 - np.std([c / total for c in act_counts])
            structural_integrity = max(0, min(100.0, balance * 100))
        elif len(unique_acts) == 2:
            structural_integrity = 50.0
        else:
            structural_integrity = 25.0
    else:
        structural_integrity = 0.0

    # --- Issue load (0.10) ---
    open_issues = len([i for i in insights if not i.get("dismissed", False)]) if insights else 0
    # Fewer open issues = better health; 0 issues = 100, 10+ issues = 0
    issue_load = max(0.0, 100.0 - open_issues * 10)

    # --- Weighted sum ---
    components = {
        "completion": round(completion, 1),
        "pacing": round(pacing, 1),
        "character_coverage": round(character_coverage, 1),
        "relationship_density": round(relationship_density, 1),
        "structural_integrity": round(structural_integrity, 1),
        "issue_load": round(issue_load, 1),
    }

    weights = {
        "completion": 0.20,
        "pacing": 0.20,
        "character_coverage": 0.20,
        "relationship_density": 0.15,
        "structural_integrity": 0.15,
        "issue_load": 0.10,
    }

    score = sum(components[k] * weights[k] for k in weights)
    score = round(min(100.0, max(0.0, score)), 1)

    if score >= 90:
        grade = "A"
    elif score >= 75:
        grade = "B"
    elif score >= 60:
        grade = "C"
    elif score >= 40:
        grade = "D"
    else:
        grade = "F"

    return {
        "score": score,
        "grade": grade,
        "components": components,
    }
