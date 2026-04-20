"""Character arc shape classification."""

from __future__ import annotations

import numpy as np
from scipy.signal import find_peaks


def compute_character_arc(tensions: list[int], presence: list[bool]) -> dict:
    """Compute a character's emotional arc from scene tensions where the character is present.

    Args:
        tensions: per-scene tension values.
        presence: boolean mask — True where character is present.

    Returns:
        Dict with points, arc_shape, and turning_points.
    """
    if not tensions or not presence:
        return {"points": [], "arc_shape": "flat", "turning_points": []}

    # Filter to scenes where character is present
    filtered = [
        {"scene_index": i, "tension": tensions[i]}
        for i in range(min(len(tensions), len(presence)))
        if presence[i]
    ]

    if len(filtered) < 2:
        return {
            "points": filtered,
            "arc_shape": "flat",
            "turning_points": [],
        }

    values = np.array([p["tension"] for p in filtered], dtype=float)
    x = np.arange(len(values))

    # Linear slope
    slope = float(np.polyfit(x, values, 1)[0])

    # Peak / valley count
    peaks, _ = find_peaks(values, prominence=1)
    valleys, _ = find_peaks(-values, prominence=1)
    n_peaks = len(peaks)
    n_valleys = len(valleys)

    # Turning points
    turning_points = []
    for idx in peaks:
        turning_points.append({
            "scene_index": filtered[int(idx)]["scene_index"],
            "tension": int(values[idx]),
            "type": "peak",
        })
    for idx in valleys:
        turning_points.append({
            "scene_index": filtered[int(idx)]["scene_index"],
            "tension": int(values[idx]),
            "type": "valley",
        })
    turning_points.sort(key=lambda t: t["scene_index"])

    # Classify shape
    if n_peaks + n_valleys >= 4:
        arc_shape = "wave"
    elif slope > 0.3 and n_peaks <= 1 and n_valleys <= 1:
        if n_peaks == 1 and peaks[0] > len(values) * 0.4:
            arc_shape = "rise-fall"
        else:
            arc_shape = "rise"
    elif slope < -0.3 and n_peaks <= 1 and n_valleys <= 1:
        if n_valleys == 1 and valleys[0] < len(values) * 0.6:
            arc_shape = "fall-rise"
        else:
            arc_shape = "fall"
    elif n_peaks >= 1 and n_valleys >= 1:
        first_event = min(
            (peaks[0] if n_peaks else len(values)),
            (valleys[0] if n_valleys else len(values)),
        )
        if n_peaks > 0 and (n_valleys == 0 or peaks[0] < valleys[0]):
            arc_shape = "rise-fall"
        else:
            arc_shape = "fall-rise"
    else:
        arc_shape = "flat"

    return {
        "points": filtered,
        "arc_shape": arc_shape,
        "turning_points": turning_points,
    }
