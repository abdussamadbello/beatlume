from textwrap import dedent

from app.ai.llm import parse_json_response


def build_prompt(
    char_a: dict,
    char_b: dict,
    shared_scenes: list[dict],
    shared_prose_excerpts: list[str],
    existing_edge: dict | None,
) -> list[dict]:
    excerpts_block = "\n---\n".join(shared_prose_excerpts[:5])
    existing_block = (
        f"Current relationship: {existing_edge['kind']} (weight: {existing_edge['weight']})"
        if existing_edge
        else "No existing relationship defined."
    )

    return [
        {
            "role": "system",
            "content": dedent("""
                You are a literary analyst specializing in character dynamics.

                Given two characters and prose where they interact, determine their relationship.

                RELATIONSHIP TYPES: conflict, alliance, romance, mentor, secret, family

                OUTPUT — JSON object:
                {
                  "kind": "conflict" | "alliance" | "romance" | "mentor" | "secret" | "family" | null,
                  "weight": 0.1-1.0,
                  "direction": "a_to_b" | "b_to_a" | "mutual",
                  "reasoning": "1-2 sentences with evidence from the text.",
                  "changed": true | false
                }

                If insufficient evidence: {"kind": null, "weight": 0, "reasoning": "Insufficient data."}
                Output ONLY the JSON object.
            """).strip(),
        },
        {
            "role": "user",
            "content": dedent(f"""
                CHARACTER A: {char_a.get('name', '?')} ({char_a.get('role', '?')})
                  Desire: {char_a.get('desire', '?')}
                  Flaw: {char_a.get('flaw', '?')}

                CHARACTER B: {char_b.get('name', '?')} ({char_b.get('role', '?')})
                  Desire: {char_b.get('desire', '?')}
                  Flaw: {char_b.get('flaw', '?')}

                {existing_block}

                SHARED SCENES: {', '.join(f"S{{s.get('n', '?'):02d}}" for s in shared_scenes)}

                PROSE EXCERPTS:
                {excerpts_block or 'No prose available'}

                Analyze their relationship.
            """).strip(),
        },
    ]


def validate_output(raw: str) -> dict:
    data = parse_json_response(raw)
    if not isinstance(data, dict):
        raise ValueError("Expected JSON object")
    if data.get("kind") is not None and data["kind"] not in (
        "conflict", "alliance", "romance", "mentor", "secret", "family"
    ):
        raise ValueError(f"Invalid kind: {data['kind']}")
    return data
