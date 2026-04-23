"""LLM prompt to turn one insight into concrete story edits."""

from __future__ import annotations

import re
from textwrap import dedent
from typing import Any

from app.ai.llm import parse_json_response

SCENE_REF_RE = re.compile(r"^S(\d+)$", re.IGNORECASE)
BODY_SCENE_RE = re.compile(r"\bS(\d+)\b", re.IGNORECASE)

KINDS = frozenset({"append_draft", "patch_scene_summary", "adjust_tension"})


def collect_scene_numbers(refs: list[str] | None, body: str | None) -> list[int]:
    """Resolve scene indices from refs like S19 and from S# mentions in the body."""
    nums: set[int] = set()
    for r in refs or []:
        m = SCENE_REF_RE.match((r or "").strip())
        if m:
            nums.add(int(m.group(1)))
    for m in BODY_SCENE_RE.finditer(body or ""):
        nums.add(int(m.group(1)))
    return sorted(nums)


def build_prompt(
    insight: dict[str, Any],
    scene_blocks: list[dict[str, Any]],
) -> list[dict[str, str]]:
    """scene_blocks: {n, title, act, summary, draft_excerpt, tension}."""
    blocks = ""
    for s in scene_blocks:
        blocks += dedent(
            f"""
            --- Scene S{s['n']} (act {s.get('act', 1)}, tension {s.get('tension', 5)}) — {s.get('title', '')}
            Summary: {(s.get('summary') or '(none)').strip()[:4000]}
            Draft (excerpt): {(s.get('draft_excerpt') or '(empty)').strip()[:12000]}
            """
        )

    sev = insight.get("severity", "amber")
    return [
        {
            "role": "system",
            "content": dedent(
                """
                You are a fiction editor. The user will apply your plan automatically to their manuscript.

                Propose 1-6 operations that directly address the insight. Use ONLY scene numbers (S#) that
                appear in the allowed list in the user message. Do not invent scenes.

                Each operation is one of:
                - {"kind": "append_draft", "scene_n": <int>, "text": "<new prose to append at end of scene>"}
                - {"kind": "patch_scene_summary", "scene_n": <int>, "summary": "<replacement scene summary>"}
                - {"kind": "adjust_tension", "scene_n": <int>, "tension": <1-10>}

                Prefer append_draft to fix continuity, character presence, and clarity. Use patch_scene_summary
                when the planning summary should reflect a fix. Use adjust_tension for pacing lulls (raise where
                the insight calls for more momentum).

                "text" and "summary" must be plain prose (no JSON inside strings). Keep additions concise but useful.

                OUTPUT: JSON only, no markdown:
                {"operations": [ ... ]}
                """
            ).strip(),
        },
        {
            "role": "user",
            "content": dedent(
                f"""
                STORY INSIGHT
                severity: {sev}
                category: {insight.get("category", "")}
                title: {insight.get("title", "")}
                body: {insight.get("body", "")}
                refs: {", ".join(insight.get("refs") or [])}

                ALLOWED scene numbers only: {", ".join("S" + str(n) for n in [b["n"] for b in scene_blocks])}

                SCENE DATA:
                {blocks}

                Return {{"operations": [...]}} as specified.
                """
            ).strip(),
        },
    ]


def validate_output(raw: str) -> list[dict[str, Any]]:
    data = parse_json_response(raw)
    if not isinstance(data, dict):
        raise ValueError("Expected JSON object")
    ops = data.get("operations")
    if not isinstance(ops, list):
        raise ValueError("Expected operations array")
    if len(ops) > 12:
        raise ValueError("Too many operations")
    if len(ops) < 1:
        raise ValueError("operations must not be empty")
    for op in ops:
        if not isinstance(op, dict):
            raise ValueError("Invalid operation")
        kind = op.get("kind")
        if kind not in KINDS:
            raise ValueError(f"Invalid operation kind: {kind}")
        n = op.get("scene_n")
        if not isinstance(n, int) or n < 1:
            raise ValueError("Invalid scene_n")
        if kind == "append_draft":
            t = op.get("text")
            if not isinstance(t, str) or not t.strip():
                raise ValueError("append_draft needs non-empty text")
            if len(t) > 20000:
                raise ValueError("append_draft text too long")
        elif kind == "patch_scene_summary":
            s = op.get("summary")
            if not isinstance(s, str) or not s.strip():
                raise ValueError("patch_scene_summary needs non-empty summary")
            if len(s) > 20000:
                raise ValueError("summary too long")
        elif kind == "adjust_tension":
            te = op.get("tension")
            if not isinstance(te, int) or te < 1 or te > 10:
                raise ValueError("tension must be 1-10")
    return ops
