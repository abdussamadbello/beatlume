import json

import pytest

from app.ai.prompts import (
    insight_analysis,
    insight_apply,
    insight_synthesis,
    prose_continuation,
    relationship_inference,
    scene_summarization,
    story_scaffolding,
)
from app.ai.context.assembler import AssembledContext


def test_prose_continuation_prompt_builds():
    ctx = AssembledContext(sections={
        "story_skeleton": "Test skeleton",
        "prior_scene_prose": "Prior prose...",
        "current_scene_prose": "Current prose...",
    })
    scene = {"n": 3, "title": "The Letter", "pov": "Iris", "tension": 6, "act": 1, "location": "Kitchen"}
    story_ctx = {"genre": "Literary", "tense": "past", "tone": "literary"}
    pov = {"name": "Iris", "role": "Protagonist", "desire": "truth", "flaw": "distrust"}
    messages = prose_continuation.build_prompt(ctx, scene, story_ctx, pov)
    assert len(messages) == 2
    assert "ghostwriter" in messages[0]["content"].lower()
    assert "Current prose" in messages[1]["content"]


def test_prose_continuation_validation():
    long_prose = "The wind shifted and she looked up at the clouds gathering above the old barn, their dark shapes promising rain before nightfall."
    assert prose_continuation.validate_output(long_prose) is not None
    try:
        prose_continuation.validate_output("")
        assert False, "Should have raised"
    except ValueError:
        pass


def test_insight_analysis_prompt_builds():
    ctx = AssembledContext(sections={
        "story_skeleton": "Skeleton",
        "act_scenes": "Scene 1 | Title | POV: Iris | Tension: 3/10",
    })
    story_ctx = {"title": "Test", "genre": "Literary"}
    messages = insight_analysis.build_prompt(ctx, story_ctx, 1)
    assert len(messages) == 2
    assert "developmental editor" in messages[0]["content"].lower()


def test_insight_analysis_validation():
    valid = json.dumps([{
        "severity": "red", "category": "Pacing",
        "title": "Flat tension", "body": "Tension doesn't change.", "refs": ["S01"],
    }])
    result = insight_analysis.validate_output(valid)
    assert len(result) == 1
    assert result[0]["severity"] == "red"


def test_insight_apply_collect_scene_numbers():
    assert insight_apply.collect_scene_numbers(["S3", "S12"], "") == [3, 12]
    assert insight_apply.collect_scene_numbers([], "See S5 and S7.") == [5, 7]


def test_insight_apply_validation():
    raw = json.dumps(
        {
            "operations": [
                {
                    "kind": "append_draft",
                    "scene_n": 2,
                    "text": "She shut the door.",
                }
            ]
        }
    )
    ops = insight_apply.validate_output(raw)
    assert len(ops) == 1
    assert ops[0]["kind"] == "append_draft"


def test_insight_apply_prompt_builds():
    insight = {
        "severity": "amber",
        "category": "Pacing",
        "title": "Lull",
        "body": "Tension flattens in S2.",
        "refs": ["S2"],
    }
    blocks = [
        {
            "n": 2,
            "title": "Field",
            "act": 1,
            "tension": 4,
            "summary": "Iris walks.",
            "draft_excerpt": "The grass was wet.",
        }
    ]
    messages = insight_apply.build_prompt(insight, blocks)
    assert len(messages) == 2
    assert "S2" in messages[1]["content"]
    assert "append_draft" in messages[0]["content"]


def test_insight_analysis_validation_rejects_bad_severity():
    invalid = json.dumps([{
        "severity": "green", "category": "Pacing",
        "title": "Test", "body": "Test", "refs": [],
    }])
    try:
        insight_analysis.validate_output(invalid)
        assert False
    except ValueError:
        pass


def test_scene_summarization_prompt_builds():
    scene = {"n": 1, "title": "Opening", "pov": "Iris", "tension": 3, "act": 1, "location": "Garden"}
    messages = scene_summarization.build_prompt(scene, "Prose text here...", None)
    assert len(messages) == 2


def test_scene_summarization_validation():
    valid = json.dumps({"summary": "Iris finds the letter.", "beats": ["Opens door", "Finds letter"]})
    result = scene_summarization.validate_output(valid)
    assert result["summary"] == "Iris finds the letter."
    assert len(result["beats"]) == 2


def test_story_scaffolding_prompt_builds():
    messages = story_scaffolding.build_prompt(
        "A woman returns to her hometown", "3-act", 80000, ["Literary"], [],
    )
    assert len(messages) == 2
    assert "scaffold" in messages[0]["content"].lower()


def test_story_scaffolding_validation():
    valid = json.dumps({
        "title_suggestion": "Test",
        "genre": ["Literary"],
        "themes": ["Identity"],
        "acts": [{"act": 1, "label": "Setup", "scenes": [
            {"n": 1, "title": "Test", "pov": "Iris", "location": "Town",
             "tension": 2, "tag": "setup", "summary": "Opening"}
        ]}],
        "characters": [],
        "relationships": [],
    })
    result = story_scaffolding.validate_output(valid)
    assert len(result["acts"]) == 1


def test_story_scaffolding_validation_rejects_missing_summary():
    missing_summary = json.dumps({
        "title_suggestion": "Test",
        "genre": ["Literary"],
        "themes": ["Identity"],
        "acts": [{"act": 1, "label": "Setup", "scenes": [
            {"n": 1, "title": "Test", "pov": "Iris", "location": "Town",
             "tension": 2, "tag": "setup"}
        ]}],
        "characters": [],
        "relationships": [],
    })
    try:
        story_scaffolding.validate_output(missing_summary)
        assert False, "expected ValueError for missing scene summary"
    except ValueError as e:
        assert "summary" in str(e).lower()


def test_relationship_inference_prompt_builds():
    messages = relationship_inference.build_prompt(
        {"name": "Iris", "role": "Protagonist", "desire": "truth", "flaw": "distrust"},
        {"name": "Cole", "role": "Antagonist", "desire": "power", "flaw": "pride"},
        [{"n": 3}], ["They argued about the boundary."], None,
    )
    assert len(messages) == 2


def test_relationship_inference_validation():
    valid = json.dumps({
        "kind": "conflict", "weight": 0.8,
        "direction": "mutual", "reasoning": "Clear opposition.", "changed": False,
    })
    result = relationship_inference.validate_output(valid)
    assert result["kind"] == "conflict"


# ─────────────────────────────────────────────────────────────────────────────
# Insight validator coercion: real-world LLM outputs
# ─────────────────────────────────────────────────────────────────────────────

def test_insight_analysis_coerces_critical_to_red():
    """Models sometimes return 'Critical' instead of canonical 'red' — must coerce."""
    raw = json.dumps([{
        "severity": "Critical", "category": "Pacing",
        "title": "Flat tension", "body": "Tension doesn't change.", "refs": ["S01"],
    }])
    result = insight_analysis.validate_output(raw)
    assert len(result) == 1
    assert result[0]["severity"] == "red"


def test_insight_analysis_coerces_severity_synonyms():
    raw = json.dumps([
        {"severity": "High",     "category": "Pacing",        "title": "a", "body": "b"},
        {"severity": "Medium",   "category": "Characters",    "title": "a", "body": "b"},
        {"severity": "Low",      "category": "Continuity",    "title": "a", "body": "b"},
        {"severity": "Yellow",   "category": "Structure",     "title": "a", "body": "b"},
        {"severity": "blue",     "category": "Relationships", "title": "a", "body": "b"},
    ])
    result = insight_analysis.validate_output(raw)
    severities = [r["severity"] for r in result]
    assert severities == ["red", "amber", "blue", "amber", "blue"]


def test_insight_analysis_coerces_category_synonyms():
    raw = json.dumps([
        {"severity": "red",   "category": "character",    "title": "a", "body": "b"},
        {"severity": "amber", "category": "tempo",        "title": "a", "body": "b"},
        {"severity": "blue",  "category": "consistency",  "title": "a", "body": "b"},
    ])
    result = insight_analysis.validate_output(raw)
    cats = [r["category"] for r in result]
    assert cats == ["Characters", "Pacing", "Continuity"]


def test_insight_analysis_drops_bad_item_keeps_good_ones():
    """One bad finding shouldn't fail the whole task."""
    raw = json.dumps([
        {"severity": "red",       "category": "Pacing", "title": "good",  "body": "ok"},
        {"severity": "WeirdNew",  "category": "Pacing", "title": "drop",  "body": "ok"},
        {"severity": "amber",     "category": "Pacing", "title": "good2", "body": "ok"},
    ])
    result = insight_analysis.validate_output(raw)
    assert len(result) == 2
    assert {r["title"] for r in result} == {"good", "good2"}


def test_insight_analysis_empty_after_drops_fails():
    """If everything is uncoercible, fail loud — there's nothing to show the user."""
    raw = json.dumps([
        {"severity": "Eldritch", "category": "Cosmic", "title": "x", "body": "y"},
    ])
    with pytest.raises(ValueError, match="No valid insights"):
        insight_analysis.validate_output(raw)


def test_insight_analysis_drops_missing_title():
    raw = json.dumps([
        {"severity": "red", "category": "Pacing", "title": "", "body": "ok"},
        {"severity": "red", "category": "Pacing", "title": "kept", "body": "ok"},
    ])
    result = insight_analysis.validate_output(raw)
    assert len(result) == 1
    assert result[0]["title"] == "kept"


def test_insight_synthesis_coerces_same_way():
    """Synthesis validator uses the same coercion path."""
    from app.ai.prompts import insight_synthesis
    raw = json.dumps([
        {"severity": "Critical", "category": "Plot",  "title": "a", "body": "b"},
        {"severity": "Note",     "category": "Cast",  "title": "a", "body": "b"},
    ])
    result = insight_synthesis.validate_output(raw)
    assert [r["severity"] for r in result] == ["red", "blue"]
    assert [r["category"] for r in result] == ["Structure", "Characters"]


# ─────────────────────────────────────────────────────────────────────────────
# Expanded category coverage: prose-level concerns now have a home
# ─────────────────────────────────────────────────────────────────────────────

def test_insight_analysis_accepts_voice_category():
    raw = json.dumps([{
        "severity": "amber", "category": "Voice",
        "title": "POV slips in S03", "body": "Narration drifts to omniscient.",
    }])
    result = insight_analysis.validate_output(raw)
    assert result[0]["category"] == "Voice"


def test_insight_analysis_accepts_dialogue_category():
    raw = json.dumps([{
        "severity": "blue", "category": "Dialogue",
        "title": "Stiff exchanges", "body": "Beat dialogue feels expository.",
    }])
    result = insight_analysis.validate_output(raw)
    assert result[0]["category"] == "Dialogue"


def test_insight_analysis_accepts_theme_worldbuilding_stakes():
    raw = json.dumps([
        {"severity": "red",   "category": "Theme",        "title": "a", "body": "b"},
        {"severity": "amber", "category": "Worldbuilding","title": "a", "body": "b"},
        {"severity": "blue",  "category": "Stakes",       "title": "a", "body": "b"},
    ])
    result = insight_analysis.validate_output(raw)
    cats = [r["category"] for r in result]
    assert cats == ["Theme", "Worldbuilding", "Stakes"]


def test_insight_synthesis_build_prompt_includes_skeleton_when_provided():
    """Synthesis prompt must expose the skeleton so cross-act issues are visible."""
    findings = [[{"severity": "red", "category": "Pacing",
                  "title": "x", "body": "y", "refs": []}]]
    story_ctx = {"title": "T", "genre": "Literary"}
    skeleton = "STORY OVERVIEW:\nSCENES (3): Scene 1 ... Scene 3 ..."
    messages = insight_synthesis.build_prompt(findings, story_ctx, skeleton)
    user_content = messages[1]["content"]
    assert "STORY SKELETON" in user_content
    assert "Scene 1" in user_content


def test_insight_synthesis_build_prompt_works_without_skeleton():
    """Backward-compat: skeleton is optional — older callers shouldn't break."""
    findings = [[{"severity": "red", "category": "Pacing",
                  "title": "x", "body": "y", "refs": []}]]
    story_ctx = {"title": "T", "genre": "Literary"}
    messages = insight_synthesis.build_prompt(findings, story_ctx)
    assert len(messages) == 2
    assert "STORY SKELETON" not in messages[1]["content"]


# ─────────────────────────────────────────────────────────────────────────────
# parse_json_response: empty / malformed model output
# ─────────────────────────────────────────────────────────────────────────────

def test_parse_json_response_rejects_empty_string():
    """An empty model response must raise a clean, short ValueError — not bleed Python's
    'Expecting value: line 1 column 1 (char 0)' to the user."""
    from app.ai.llm import parse_json_response
    with pytest.raises(ValueError) as exc_info:
        parse_json_response("")
    msg = str(exc_info.value)
    assert "Expecting value" not in msg
    assert "(char 0)" not in msg
    assert "line 1 column 1" not in msg
    assert "AI" in msg or "empty" in msg.lower()


def test_parse_json_response_rejects_whitespace():
    from app.ai.llm import parse_json_response
    with pytest.raises(ValueError) as exc_info:
        parse_json_response("   \n\n  ")
    assert "Expecting value" not in str(exc_info.value)


def test_parse_json_response_rejects_empty_code_fence():
    """Model returns ```json\\n``` with nothing inside."""
    from app.ai.llm import parse_json_response
    with pytest.raises(ValueError) as exc_info:
        parse_json_response("```json\n```")
    assert "Expecting value" not in str(exc_info.value)


def test_parse_json_response_rejects_garbage():
    """Model returns prose like 'Sure, here are the findings:' — no JSON."""
    from app.ai.llm import parse_json_response
    with pytest.raises(ValueError) as exc_info:
        parse_json_response("Sure, here are the findings:")
    msg = str(exc_info.value)
    assert "Expecting value" not in msg
    assert "JSONDecodeError" not in msg


def test_parse_json_response_accepts_valid_json():
    from app.ai.llm import parse_json_response
    assert parse_json_response('{"x": 1}') == {"x": 1}


def test_parse_json_response_strips_markdown_code_fence():
    from app.ai.llm import parse_json_response
    assert parse_json_response('```json\n{"x": 1}\n```') == {"x": 1}


def test_safe_error_message_sanitizes_jsondecodeerror():
    """The needles must catch json-parse leakage that reaches the user."""
    from app.ai.errors import safe_error_message
    msg = safe_error_message(ValueError("Expecting value: line 1 column 1 (char 0)"))
    assert "Expecting value" not in msg
    assert "(char 0)" not in msg


def test_insight_validator_with_empty_response_fails_loud():
    """If the LLM returned nothing at all, validate_output should produce a clean error."""
    with pytest.raises(ValueError) as exc_info:
        insight_analysis.validate_output("")
    msg = str(exc_info.value)
    assert "Expecting value" not in msg
