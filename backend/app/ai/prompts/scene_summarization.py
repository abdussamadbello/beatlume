from textwrap import dedent

from app.ai.llm import parse_json_response


def build_prompt(scene: dict, prose: str, pov_character: dict | None) -> list[dict]:
    pov_block = ""
    if pov_character:
        pov_block = f"POV: {pov_character['name']} ({pov_character['role']})"

    return [
        {
            "role": "system",
            "content": dedent(f"""
                You are a story editor creating scene breakdowns.

                SCENE {scene.get('n', '?')}: "{scene.get('title', '?')}"
                {pov_block}
                Location: {scene.get('location', '?')}
                Act {scene.get('act', '?')} — Tension: {scene.get('tension', 5)}/10

                Produce:
                1. SUMMARY: 1-2 sentences capturing what changes in this scene.
                2. BEATS: 3-5 present-tense action bullet points.

                OUTPUT — JSON: {{"summary": "...", "beats": ["...", "..."]}}
                Output ONLY the JSON object.
            """).strip(),
        },
        {
            "role": "user",
            "content": f"SCENE PROSE:\n---\n{prose}\n---\n\nSummarize this scene.",
        },
    ]


def validate_output(raw: str) -> dict:
    data = parse_json_response(raw)
    if not isinstance(data, dict):
        raise ValueError("Expected JSON object")
    if "summary" not in data:
        raise ValueError("Missing summary")
    if "beats" not in data or not isinstance(data["beats"], list):
        raise ValueError("Missing or invalid beats")
    return data
