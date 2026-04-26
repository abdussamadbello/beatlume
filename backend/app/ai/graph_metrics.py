"""OpenTelemetry metrics for LangGraph workflows and individual nodes.

Two levels of instrumentation:
- Workflow: one metric per `graph.ainvoke()` — the user-facing unit of work.
- Node: one metric per node execution — useful for pinpointing which node is slow
  or failing within an otherwise-"successful" workflow (many nodes return
  {"error": ...} instead of raising).
"""

from __future__ import annotations

import logging
import time
from functools import wraps
from typing import Any, Awaitable, Callable

from opentelemetry import metrics as otel_metrics

logger = logging.getLogger(__name__)

_meter = otel_metrics.get_meter("app.ai.graph")

_node_runs = _meter.create_counter(
    "graph.node.runs",
    unit="1",
    description="LangGraph node executions grouped by graph, node, and outcome",
)
_node_duration = _meter.create_histogram(
    "graph.node.duration",
    unit="s",
    description="LangGraph node execution duration",
)
_workflow_runs = _meter.create_counter(
    "graph.workflow.runs",
    unit="1",
    description="LangGraph workflow invocations (ainvoke) grouped by graph and outcome",
)
_workflow_duration = _meter.create_histogram(
    "graph.workflow.duration",
    unit="s",
    description="End-to-end LangGraph workflow duration",
)


def _outcome_from_result(result: Any) -> str:
    """Many nodes/workflows return {"error": "..."} on failure without raising.
    Treat that as an error outcome so metrics match reality."""
    if isinstance(result, dict) and result.get("error"):
        return "error"
    return "success"


def instrumented_node(graph: str, node: str) -> Callable:
    """Decorator for LangGraph node functions. Emits one metric sample per invocation
    with outcome inferred from the returned dict (error key presence) or exception."""

    def decorator(fn: Callable[..., Awaitable[dict]]):
        @wraps(fn)
        async def wrapper(state):
            start = time.monotonic()
            outcome = "error"
            try:
                result = await fn(state)
                outcome = _outcome_from_result(result)
                return result
            except Exception:
                outcome = "exception"
                raise
            finally:
                duration = time.monotonic() - start
                _node_runs.add(1, {"graph": graph, "node": node, "outcome": outcome})
                _node_duration.record(duration, {"graph": graph, "node": node})

        return wrapper

    return decorator


async def run_graph(graph_name: str, graph, state: dict):
    """Wrap `graph.ainvoke(state)` with workflow-level metrics.

    Replaces `await graph.ainvoke(state)` at every call site to get one metric
    sample per workflow invocation. Exceptions propagate unchanged.
    """
    start = time.monotonic()
    outcome = "error"
    try:
        result = await graph.ainvoke(state)
        outcome = _outcome_from_result(result)
        return result
    except Exception:
        outcome = "exception"
        raise
    finally:
        duration = time.monotonic() - start
        _workflow_runs.add(1, {"graph": graph_name, "outcome": outcome})
        _workflow_duration.record(duration, {"graph": graph_name})
