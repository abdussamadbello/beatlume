"""Pacing analysis: velocity, flatlines, whiplash, and breathing room."""

from __future__ import annotations

import numpy as np


def analyze_pacing(tensions: list[int]) -> dict:
    """Analyze pacing patterns in tension data.

    Args:
        tensions: list of scene tension values (1-10).

    Returns:
        Dict with velocity, flatlines, whiplash, and breathing_room.
    """
    n = len(tensions)
    if n < 2:
        return {
            "velocity": [],
            "flatlines": [],
            "whiplash": [],
            "breathing_room": [],
        }

    arr = np.array(tensions, dtype=float)

    # --- Velocity ---
    diffs = np.diff(arr)
    velocity = []
    for i, d in enumerate(diffs):
        if abs(d) > 4:
            label = "spike" if d > 0 else "drop"
        elif d > 0:
            label = "rising"
        elif d < 0:
            label = "falling"
        else:
            label = "flat"
        velocity.append({
            "from_scene": i,
            "to_scene": i + 1,
            "delta": float(d),
            "label": label,
        })

    # --- Flatlines: runs of 3+ scenes with variance <= 1 ---
    flatlines = []
    run_start = 0
    for i in range(1, n):
        window = arr[run_start : i + 1]
        if np.var(window) > 1:
            run_len = i - run_start
            if run_len >= 3:
                flatlines.append({
                    "start": int(run_start),
                    "end": int(i - 1),
                    "length": run_len,
                    "avg_tension": round(float(np.mean(arr[run_start:i])), 2),
                })
            run_start = i
    # Final run
    run_len = n - run_start
    if run_len >= 3 and np.var(arr[run_start:]) <= 1:
        flatlines.append({
            "start": int(run_start),
            "end": int(n - 1),
            "length": run_len,
            "avg_tension": round(float(np.mean(arr[run_start:])), 2),
        })

    # --- Whiplash: adjacent jumps > 4 ---
    whiplash = []
    for i in range(len(diffs)):
        if abs(diffs[i]) > 4:
            whiplash.append({
                "from_scene": i,
                "to_scene": i + 1,
                "delta": float(diffs[i]),
                "from_tension": int(arr[i]),
                "to_tension": int(arr[i + 1]),
            })

    # --- Breathing room: after peaks >= 7, check for valley <= 4 within 3 scenes ---
    breathing_room = []
    for i in range(n):
        if arr[i] >= 7:
            has_relief = False
            for j in range(i + 1, min(i + 4, n)):
                if arr[j] <= 4:
                    has_relief = True
                    break
            breathing_room.append({
                "peak_scene": i,
                "peak_tension": int(arr[i]),
                "has_relief": has_relief,
            })

    return {
        "velocity": velocity,
        "flatlines": flatlines,
        "whiplash": whiplash,
        "breathing_room": breathing_room,
    }
