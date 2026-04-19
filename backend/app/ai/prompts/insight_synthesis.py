from textwrap import dedent

from app.ai.llm import parse_json_response


def build_prompt(
    all_chunk_findings: list[list[dict]],
    story_context: dict,
) -> list[dict]:
    findings_block = ""
    for i, findings in enumerate(all_chunk_findings, 1):
        findings_block += f"\nACT {i} FINDINGS:\n"
        for f in findings:
            findings_block += (
                f"  [{f['severity']}] {f['category']}: {f['title']} — "
                f"{f['body']} (refs: {', '.join(f.get('refs', []))})\n"
            )

    return [
        {
            "role": "system",
            "content": dedent("""
                You are a senior developmental editor producing a final analysis from per-act findings.

                1. Deduplicate findings that flag the same underlying issue across acts.
                2. Promote/demote severity based on scope (multi-act = escalate).
                3. Add cross-act findings only visible in the full arc.
                4. Rank by impact, most critical first.

                OUTPUT: JSON array of 5-10 final insights:
                [{"severity": "...", "category": "...", "title": "...", "body": "...", "refs": [...]}]

                Output ONLY the JSON array.
            """).strip(),
        },
        {
            "role": "user",
            "content": dedent(f"""
                STORY: "{story_context.get('title', 'Untitled')}" — {story_context.get('genre', 'Literary')}

                PER-ACT FINDINGS:
                {findings_block}

                Synthesize into a final insight report.
            """).strip(),
        },
    ]


def validate_output(raw: str) -> list[dict]:
    data = parse_json_response(raw)
    if not isinstance(data, list):
        raise ValueError("Expected JSON array")
    for item in data:
        if item.get("severity") not in ("red", "amber", "blue"):
            raise ValueError(f"Invalid severity: {item.get('severity')}")
    return data
