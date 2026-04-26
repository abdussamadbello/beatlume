from textwrap import dedent

from app.ai.context.assembler import AssembledContext
from app.ai.llm import parse_json_response
from app.ai.prompts._validators import normalize_insight_item


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

                You will see scene metadata, scene summaries, AND draft prose for each scene
                in this act. Read the prose closely — many of the most useful insights are
                visible only at the sentence level.

                Think step by step:
                1. Pacing: are tension levels monotonous or compelling? Do scenes drag or rush?
                2. Characters: does any character disappear too long? Are motivations clear in scene?
                3. Relationships: are stated relationships tested in scenes? Do they evolve?
                4. Structure: are expected beats present for this act? Setup/rising/midpoint/etc.?
                5. Continuity: do locations, timeline, and plot threads track logically?
                6. Voice: is POV consistent? Is the narrator's voice steady across scenes?
                7. Dialogue: do characters sound distinct? Does dialogue do work (not just chat)?
                8. Theme: is the central conflict surfacing in scene-level choices?
                9. Worldbuilding: is the setting earning its place, or is it inert backdrop?
                10. Stakes: does the reader know what the POV stands to lose? Is risk concrete?

                When prose is available, you may quote 5-15 words from a scene to ground a
                finding (use refs like "S03" so the user can locate it). When prose is missing,
                say so explicitly in the body — the user may need to draft that scene first.

                OUTPUT FORMAT — JSON array. Use ONLY these exact lowercase severity values
                ("red", "amber", "blue") and these exact category values: "Pacing", "Characters",
                "Relationships", "Structure", "Continuity", "Voice", "Dialogue", "Theme",
                "Worldbuilding", "Stakes". Do not invent other labels.
                [
                  {{
                    "severity": "red" | "amber" | "blue",
                    "category": "<one of the categories above>",
                    "title": "Short headline (max 10 words)",
                    "body": "2-3 sentences explaining the problem and pointing at evidence.",
                    "refs": ["S03", "S07"]
                  }}
                ]

                SEVERITY: red = must fix, amber = should fix, blue = suggestion.
                Limit to 4-9 findings. Output ONLY the JSON array.
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
    """Parse and coerce insight analysis output.

    Coerces synonyms (e.g. "Critical" → "red"), drops uncoercible findings, and
    only fails the whole task if no findings remain. Models occasionally return
    valid-but-off-vocabulary values; failing the entire task for one bad item
    wastes tokens and frustrates users.
    """
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
