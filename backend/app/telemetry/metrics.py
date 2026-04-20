"""Custom application metrics for BeatLume."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# Module-level metric handles — initialized lazily on first call.
_meter = None
_ai_task_duration = None
_ai_tokens_total = None
_analytics_compute_duration = None
_export_duration = None
_sse_connections_active = None
_analytics_cache_hit = None
_analytics_cache_miss = None


def _ensure_meter():
    global (
        _meter,
        _ai_task_duration,
        _ai_tokens_total,
        _analytics_compute_duration,
        _export_duration,
        _sse_connections_active,
        _analytics_cache_hit,
        _analytics_cache_miss,
    )
    if _meter is not None:
        return

    try:
        from opentelemetry import metrics

        _meter = metrics.get_meter("beatlume", version="0.1.0")

        _ai_task_duration = _meter.create_histogram(
            name="ai.task.duration",
            description="Duration of AI task execution in seconds",
            unit="s",
        )
        _ai_tokens_total = _meter.create_counter(
            name="ai.tokens.total",
            description="Total tokens consumed by AI calls",
            unit="tokens",
        )
        _analytics_compute_duration = _meter.create_histogram(
            name="analytics.compute.duration",
            description="Duration of analytics computation in seconds",
            unit="s",
        )
        _export_duration = _meter.create_histogram(
            name="export.duration",
            description="Duration of export generation in seconds",
            unit="s",
        )
        _sse_connections_active = _meter.create_up_down_counter(
            name="sse.connections.active",
            description="Currently active SSE connections",
        )
        _analytics_cache_hit = _meter.create_counter(
            name="analytics.cache.hit",
            description="Analytics cache hit count",
        )
        _analytics_cache_miss = _meter.create_counter(
            name="analytics.cache.miss",
            description="Analytics cache miss count",
        )
    except Exception:
        logger.debug("Metrics initialization skipped — OTel not available", exc_info=True)


def record_ai_duration(duration_s: float, **attributes):
    _ensure_meter()
    if _ai_task_duration:
        _ai_task_duration.record(duration_s, attributes)


def record_ai_tokens(count: int, **attributes):
    _ensure_meter()
    if _ai_tokens_total:
        _ai_tokens_total.add(count, attributes)


def record_analytics_duration(duration_s: float, **attributes):
    _ensure_meter()
    if _analytics_compute_duration:
        _analytics_compute_duration.record(duration_s, attributes)


def record_export_duration(duration_s: float, **attributes):
    _ensure_meter()
    if _export_duration:
        _export_duration.record(duration_s, attributes)


def sse_connection_opened(**attributes):
    _ensure_meter()
    if _sse_connections_active:
        _sse_connections_active.add(1, attributes)


def sse_connection_closed(**attributes):
    _ensure_meter()
    if _sse_connections_active:
        _sse_connections_active.add(-1, attributes)


def cache_hit(**attributes):
    _ensure_meter()
    if _analytics_cache_hit:
        _analytics_cache_hit.add(1, attributes)


def cache_miss(**attributes):
    _ensure_meter()
    if _analytics_cache_miss:
        _analytics_cache_miss.add(1, attributes)
