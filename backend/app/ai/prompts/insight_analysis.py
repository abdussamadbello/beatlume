from textwrap import dedent

from app.ai.context.assembler import AssembledContext
from app.ai.llm import parse_json_response


def build_prompt(
    ctx: AssembledContext,
    story_context: dict,
    act_number: int,
) -> list[dict]:
    return [
        {
            "role": "system",
            "content": dedent(f"""
                You are a senior developmental editor analyzing a novel manuscript.
                You are analyzing Act {act_number} of a {story_context.get('genre', 'literary')} novel.

                Think step by step:
                1. Check pacing: are tension levels monotonous or compelling?
                2. Check character presence: does any character disappear too long?
                3. Check relationships: are stated relationships tested in scenes?
                4. Check structural beats: are expected beats present for this act?
                5. Check continuity: do locations and plot threads track logically?

                OUTPUT FORMAT — JSON array:
                [
                  {{
                    "severity": "red" | "amber" | "blue",
                    "category": "Pacing" | "Characters" | "Relationships" | "Structure" | "Continuity",
                    "title": "Short headline (max 10 words)",
                    "body": "2-3 sentences explaining the problem.",
                    "refs": ["S03", "S07"]
                  }}
                ]

                SEVERITY: red = must fix, amber = should fix, blue = suggestion.
                Limit to 3-7 findings. Output ONLY the JSON array.
            """).strip(),
        },
        {
            "role": "user",
            "content": dedent(f"""
                STORY: "{story_context.get('title', 'Untitled')}" — {story_context.get('genre', 'Literary')}

                {ctx.sections.get('story_skeleton', '')}

                ACT {act_number} SCENES:
                {ctx.sections.get('act_scenes', 'No scenes')}

                Analyze this act and return findings as JSON.
            """).strip(),
        },
    ]


def validate_output(raw: str) -> list[dict]:
    """Parse and validate insight analysis output."""
    data = parse_json_response(raw)
    if not isinstance(data, list):
        raise ValueError("Expected JSON array")
    for item in data:
        if item.get("severity") not in ("red", "amber", "blue"):
            raise ValueError(f"Invalid severity: {item.get('severity')}")
        if item.get("category") not in ("Pacing", "Characters", "Relationships", "Structure", "Continuity"):
            raise ValueError(f"Invalid category: {item.get('category')}")
        if not item.get("title"):
            raise ValueError("Missing title")
        if not item.get("body"):
            raise ValueError("Missing body")
        if not isinstance(item.get("refs", []), list):
            raise ValueError("refs must be a list")
    return data
