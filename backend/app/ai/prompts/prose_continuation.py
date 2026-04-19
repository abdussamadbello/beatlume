from textwrap import dedent

from app.ai.context.assembler import AssembledContext
from app.ai.llm import parse_json_response


def build_prompt(
    ctx: AssembledContext,
    scene: dict,
    story_context: dict,
    pov_character: dict | None,
) -> list[dict]:
    char_block = ""
    if pov_character:
        char_block = dedent(f"""
            POV CHARACTER
            Name: {pov_character['name']}
            Role: {pov_character['role']}
            Core desire: {pov_character['desire']}
            Fatal flaw: {pov_character['flaw']}
        """)

    return [
        {
            "role": "system",
            "content": dedent(f"""
                You are a literary fiction ghostwriter continuing a novel-in-progress.

                STORY CONTEXT
                Genre: {story_context.get('genre', 'Literary')}
                Narrative tense: {story_context.get('tense', 'past')}
                Tone: {story_context.get('tone', 'literary')}

                {char_block}

                CURRENT SCENE
                Scene {scene['n']}: "{scene['title']}"
                Location: {scene.get('location', 'Unknown')}
                Act {scene.get('act', 1)} — Tension level: {scene.get('tension', 5)}/10

                YOUR TASK
                Continue the prose from exactly where it left off. Write 150-250 words.

                RULES
                - Match the author's existing voice, sentence rhythm, and vocabulary level exactly.
                - Stay strictly in {scene.get('pov', 'the character')}'s point of view.
                - Honor the tension level: {scene.get('tension', 5)}/10.
                - Advance the scene — don't restate what already happened.
                - Show, don't tell. No "She felt sad." — show sadness through action.
                - Never use cliché filler: "a sense of", "couldn't help but", "it was as if".
                - Do not introduce new named characters.
                - Output ONLY the continuation prose. No meta-commentary, no labels, no markdown.
            """).strip(),
        },
        {
            "role": "user",
            "content": dedent(f"""
                STORY OVERVIEW:
                {ctx.sections.get('story_skeleton', 'Not available')}

                PRECEDING SCENES:
                {ctx.sections.get('prior_scene_prose', 'No prior scenes')}

                CURRENT SCENE PROSE (continue from here):
                {ctx.sections.get('current_scene_prose', '')}

                Continue writing.
            """).strip(),
        },
    ]


def validate_output(raw: str) -> str:
    """Validate prose continuation output. Returns cleaned prose."""
    text = raw.strip()
    if not text:
        raise ValueError("Empty prose output")
    if len(text) < 50:
        raise ValueError(f"Prose too short: {len(text)} chars")
    return text
