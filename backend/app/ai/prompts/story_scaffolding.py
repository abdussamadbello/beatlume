from textwrap import dedent

from app.ai.llm import parse_json_response


def build_prompt(
    premise: str,
    structure_type: str,
    target_word_count: int,
    genre_hints: list[str],
    characters: list[dict],
) -> list[dict]:
    chars_block = "\n".join(
        f"  - {c.get('name', '?')} ({c.get('role', '?')}): {c.get('description', '')}"
        for c in characters
    ) if characters else "  No characters defined yet."

    act_count = int(structure_type[0]) if structure_type[0].isdigit() else 3
    target_scenes = max(15, target_word_count // 2000)

    return [
        {
            "role": "system",
            "content": dedent(f"""
                You are a story architect helping scaffold a new novel project.

                STRUCTURE: {act_count}-act, ~{target_scenes} scenes
                TENSION GUIDE: Act 1: 1-4, Act 2 first half: 3-6, midpoint: 7-8,
                Act 2 second half: 5-8, Act 3 climax: 9-10, denouement: 2-4.

                OUTPUT — JSON:
                {{
                  "title_suggestion": "...",
                  "genre": ["...", "..."],
                  "themes": ["...", "..."],
                  "acts": [
                    {{
                      "act": 1,
                      "label": "Setup",
                      "scenes": [
                        {{
                          "n": 1,
                          "title": "Evocative title",
                          "pov": "Character name",
                          "location": "Specific place",
                          "tension": 2,
                          "tag": "setup",
                          "summary": "1-2 sentences."
                        }}
                      ]
                    }}
                  ],
                  "characters": [
                    {{
                      "name": "...",
                      "role": "Protagonist",
                      "desire": "...",
                      "flaw": "...",
                      "arc": "..."
                    }}
                  ],
                  "relationships": [
                    {{
                      "source": "Name A",
                      "target": "Name B",
                      "kind": "conflict",
                      "weight": 0.8
                    }}
                  ]
                }}

                RULES:
                - Every scene has a distinct purpose. No filler.
                - Every scene MUST include a non-empty "summary" (1–2 sentences; the story beat, not only the title).
                - Alternate POVs if multiple POV characters.
                - Evocative scene titles, not "Chapter 1".
                - Output ONLY the JSON object.
            """).strip(),
        },
        {
            "role": "user",
            "content": dedent(f"""
                PREMISE:
                {premise}

                STRUCTURE: {structure_type}
                TARGET: ~{target_word_count:,} words (~{target_scenes} scenes)
                GENRE HINTS: {', '.join(genre_hints) if genre_hints else 'None'}

                CHARACTERS FROM AUTHOR:
                {chars_block}

                Generate the story scaffold.
            """).strip(),
        },
    ]


def validate_output(raw: str) -> dict:
    data = parse_json_response(raw)
    if not isinstance(data, dict):
        raise ValueError("Expected JSON object")
    if "acts" not in data or not isinstance(data["acts"], list):
        raise ValueError("Missing or invalid acts")
    for act in data["acts"]:
        if "scenes" not in act or not isinstance(act["scenes"], list):
            raise ValueError(f"Act {act.get('act')} missing scenes")
        for scene in act["scenes"]:
            if "title" not in scene or "pov" not in scene:
                raise ValueError("Scene missing required fields")
            if "summary" not in scene or not str(scene.get("summary", "")).strip():
                raise ValueError("Every scene must include a non-empty summary")
    return data
