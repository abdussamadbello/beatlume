"""Tension curve computation with cubic spline interpolation and peak detection."""

from __future__ import annotations

import numpy as np
from scipy.interpolate import CubicSpline
from scipy.signal import find_peaks, savgol_filter


def _label_peak(position: float, total: int) -> str:
    """Label a peak by its relative position in the story."""
    ratio = position / max(total - 1, 1)
    if ratio <= 0.25:
        return "Inciting incident"
    if 0.40 <= ratio <= 0.60:
        return "Midpoint"
    if ratio >= 0.70:
        return "Climax"
    return "Crisis"


def compute_tension_curve(tensions: list[int]) -> dict:
    """Compute an interpolated tension curve with peaks, valleys, and metrics.

    Args:
        tensions: list of scene tension values (1-10).

    Returns:
        Dict with points, raw_points, peaks, valleys, and metrics.
    """
    n = len(tensions)
    if n == 0:
        return {
            "points": [],
            "raw_points": [],
            "peaks": [],
            "valleys": [],
            "metrics": {
                "mean": 0,
                "std": 0,
                "max": 0,
                "min": 0,
                "range": 0,
                "climax_position": 0,
            },
        }

    arr = np.array(tensions, dtype=float)
    x_raw = np.arange(n)

    # Interpolation — 200 points along the curve
    num_points = 200
    x_smooth = np.linspace(0, n - 1, num_points)

    if n >= 4:
        cs = CubicSpline(x_raw, arr)
        y_smooth = cs(x_smooth)
    elif n >= 2:
        y_smooth = np.interp(x_smooth, x_raw, arr)
    else:
        y_smooth = np.full(num_points, arr[0])

    # Savitzky-Golay smoothing when enough points
    if n >= 7:
        window = min(7, num_points if num_points % 2 == 1 else num_points - 1)
        y_smooth = savgol_filter(y_smooth, window_length=window, polyorder=3)

    # Clamp to valid range
    y_smooth = np.clip(y_smooth, 1, 10)

    points = [{"x": float(x_smooth[i]), "y": float(y_smooth[i])} for i in range(num_points)]
    raw_points = [{"x": int(i), "y": int(tensions[i])} for i in range(n)]

    # Peak detection on raw data
    peaks_list = []
    valleys_list = []

    if n >= 3:
        peak_idx, peak_props = find_peaks(arr, prominence=2, distance=max(1, min(3, n // 3)))
        for idx in peak_idx:
            peaks_list.append({
                "scene_index": int(idx),
                "tension": int(arr[idx]),
                "label": _label_peak(idx, n),
            })

        valley_idx, _ = find_peaks(-arr, prominence=2, distance=max(1, min(3, n // 3)))
        for idx in valley_idx:
            valleys_list.append({
                "scene_index": int(idx),
                "tension": int(arr[idx]),
            })

    # Metrics
    climax_pos = int(np.argmax(arr))
    metrics = {
        "mean": round(float(np.mean(arr)), 2),
        "std": round(float(np.std(arr)), 2),
        "max": int(np.max(arr)),
        "min": int(np.min(arr)),
        "range": int(np.max(arr) - np.min(arr)),
        "climax_position": climax_pos,
    }

    return {
        "points": points,
        "raw_points": raw_points,
        "peaks": peaks_list,
        "valleys": valleys_list,
        "metrics": metrics,
    }
