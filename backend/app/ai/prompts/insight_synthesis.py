from textwrap import dedent

from app.ai.llm import parse_json_response
from app.ai.prompts._validators import normalize_insight_item


def build_prompt(
    all_chunk_findings: list[list[dict]],
    story_context: dict,
    story_skeleton_text: str = "",
) -> list[dict]:
    findings_block = ""
    for i, findings in enumerate(all_chunk_findings, 1):
        findings_block += f"\nACT {i} FINDINGS:\n"
        for f in findings:
            findings_block += (
                f"  [{f['severity']}] {f['category']}: {f['title']} — "
                f"{f['body']} (refs: {', '.join(f.get('refs', []))})\n"
            )

    skeleton_block = (
        f"\nSTORY SKELETON (for cross-act reasoning):\n{story_skeleton_text}\n"
        if story_skeleton_text
        else ""
    )

    return [
        {
            "role": "system",
            "content": dedent("""
                You are a senior developmental editor producing a final analysis from per-act findings.
                You will see per-act findings AND the full story skeleton (scenes, characters,
                relationships). Use the skeleton to spot issues NO single act could surface alone:
                arcs that don't pay off, setups without follow-through, characters whose
                presence pattern is wrong across the whole story.

                1. Deduplicate findings that flag the same underlying issue across acts.
                2. Promote/demote severity based on scope (multi-act = escalate).
                3. ADD cross-act findings the per-act passes couldn't see — these are the most
                   valuable insights. Look for: setup-payoff mismatches, character disappearance
                   patterns, theme that surfaces in one act and vanishes, relationship arcs that
                   plateau, escalation curves that flatten across acts.
                4. Rank by impact, most critical first.

                OUTPUT: JSON array of 6-12 final insights. Use ONLY these exact lowercase
                severity values ("red", "amber", "blue") and these exact category values:
                "Pacing", "Characters", "Relationships", "Structure", "Continuity", "Voice",
                "Dialogue", "Theme", "Worldbuilding", "Stakes".
                [{"severity": "red"|"amber"|"blue", "category": "<one of the categories above>", "title": "...", "body": "...", "refs": [...]}]

                Output ONLY the JSON array.
            """).strip(),
        },
        {
            "role": "user",
            "content": dedent(f"""
                STORY: "{story_context.get('title', 'Untitled')}" — {story_context.get('genre', 'Literary')}
                {skeleton_block}
                PER-ACT FINDINGS:
                {findings_block}

                Synthesize into a final insight report. Prioritize cross-act findings the
                per-act passes couldn't see.
            """).strip(),
        },
    ]


def validate_output(raw: str) -> list[dict]:
    """Parse and coerce synthesized insight output. Mirrors insight_analysis behavior:
    drops uncoercible findings, only fails if nothing remains."""
    data = parse_json_response(raw)
    if not isinstance(data, list):
        raise ValueError("Expected JSON array")
    normalized: list[dict] = []
    for item in data:
        coerced = normalize_insight_item(item)
        if coerced is not None:
            normalized.append(coerced)
    if not normalized:
        raise ValueError("No valid insights returned")
    return normalized
