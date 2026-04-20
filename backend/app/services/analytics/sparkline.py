"""Sparkline generation via LTTB (Largest-Triangle-Three-Buckets) downsampling."""

from __future__ import annotations


def tension_sparkline(tensions: list[int], target_points: int = 12) -> list[float]:
    """Downsample tension values to a fixed-length array preserving visual peaks.

    Uses the LTTB algorithm for perceptually accurate downsampling.

    Args:
        tensions: raw tension values.
        target_points: desired output length (default 12).

    Returns:
        List of float tension values of length target_points.
    """
    n = len(tensions)
    if n == 0:
        return [0.0] * target_points

    if n <= target_points:
        # Pad or return as-is
        result = [float(t) for t in tensions]
        while len(result) < target_points:
            result.append(result[-1])
        return result

    # LTTB algorithm
    data = [(float(i), float(tensions[i])) for i in range(n)]
    sampled = [data[0]]  # Always keep first point

    bucket_size = (n - 2) / (target_points - 2)

    for i in range(1, target_points - 1):
        # Current bucket range
        bucket_start = int((i - 1) * bucket_size) + 1
        bucket_end = int(i * bucket_size) + 1

        # Next bucket range for average
        next_start = int(i * bucket_size) + 1
        next_end = int((i + 1) * bucket_size) + 1
        next_end = min(next_end, n)

        # Average of next bucket
        avg_x = sum(data[j][0] for j in range(next_start, next_end)) / max(
            1, next_end - next_start
        )
        avg_y = sum(data[j][1] for j in range(next_start, next_end)) / max(
            1, next_end - next_start
        )

        # Find point in current bucket with max triangle area
        prev_x, prev_y = sampled[-1]
        max_area = -1.0
        best_idx = bucket_start

        for j in range(bucket_start, min(bucket_end, n)):
            area = abs(
                (data[j][0] - prev_x) * (avg_y - prev_y)
                - (avg_x - prev_x) * (data[j][1] - prev_y)
            )
            if area > max_area:
                max_area = area
                best_idx = j

        sampled.append(data[best_idx])

    sampled.append(data[-1])  # Always keep last point

    return [round(p[1], 2) for p in sampled]
