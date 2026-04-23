import json

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
