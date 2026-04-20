"""Custom tracing utilities: decorator and AI-call helper."""

from __future__ import annotations

import functools
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _get_tracer():
    try:
        from opentelemetry import trace
        return trace.get_tracer("beatlume")
    except Exception:
        return None


def traced(span_name: str | None = None):
    """Decorator that wraps a function in an OpenTelemetry span.

    Args:
        span_name: custom span name; defaults to the function's qualified name.
    """
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            tracer = _get_tracer()
            name = span_name or f"{fn.__module__}.{fn.__qualname__}"
            if tracer is None:
                return fn(*args, **kwargs)
            with tracer.start_as_current_span(name):
                return fn(*args, **kwargs)

        @functools.wraps(fn)
        async def async_wrapper(*args, **kwargs):
            tracer = _get_tracer()
            name = span_name or f"{fn.__module__}.{fn.__qualname__}"
            if tracer is None:
                return await fn(*args, **kwargs)
            with tracer.start_as_current_span(name):
                return await fn(*args, **kwargs)

        import asyncio
        if asyncio.iscoroutinefunction(fn):
            return async_wrapper
        return wrapper

    return decorator


def trace_ai_call(
    model: str,
    task_type: str,
    tokens_in: int = 0,
    tokens_out: int = 0,
) -> None:
    """Record AI call metadata on the current span.

    Call this inside a traced function to annotate the span with LLM info.
    """
    try:
        from opentelemetry import trace
        span = trace.get_current_span()
        if span and span.is_recording():
            span.set_attribute("ai.model", model)
            span.set_attribute("ai.task_type", task_type)
            span.set_attribute("ai.tokens.input", tokens_in)
            span.set_attribute("ai.tokens.output", tokens_out)
            span.set_attribute("ai.tokens.total", tokens_in + tokens_out)
    except Exception:
        logger.debug("Failed to record AI call trace", exc_info=True)
