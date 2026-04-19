from app.ai.context.token_budget import TokenBudget, count_tokens
from app.ai.context.formatters import format_scene_metadata, format_character_card, format_edge
from app.ai.context.retrievers import SceneContext, CharacterContext, EdgeContext
from app.ai.context.rankers import rank_scenes_for_continuation


def test_count_tokens():
    tokens = count_tokens("Hello, world!")
    assert tokens > 0
    assert tokens < 10


def test_token_budget_allocation():
    budget = TokenBudget("standard", output_reserve=2000)
    alloc = budget.allocate({"a": 0.5, "b": 0.3, "c": 0.2})
    assert sum(alloc.values()) <= budget.available
    assert alloc["a"] > alloc["b"] > alloc["c"]


def test_token_budget_truncation():
    budget = TokenBudget("fast")
    long_text = "word " * 10000
    truncated = budget.truncate_to_budget(long_text, 100)
    assert len(truncated) < len(long_text)


def test_token_budget_truncation_keep_end():
    budget = TokenBudget("fast")
    text = "Start of text. " * 100 + "End of text."
    truncated = budget.truncate_to_budget(text, 50, keep_end=True)
    assert truncated.startswith("...")
    assert "End of text" in truncated


def test_format_scene_metadata():
    scene = SceneContext(n=3, title="The Letter", pov="Iris", tension=7, act=2, location="Kitchen", tag="rising")
    result = format_scene_metadata(scene)
    assert "Scene 3" in result
    assert "Iris" in result
    assert "7/10" in result


def test_format_character_card():
    char = CharacterContext(name="Iris", role="Protagonist", desire="truth", flaw="distrust", scene_count=12)
    result = format_character_card(char)
    assert "Iris" in result
    assert "truth" in result


def test_format_edge():
    edge = EdgeContext(source="Iris", target="Cole", kind="conflict", weight=0.8)
    result = format_edge(edge)
    assert "Iris" in result
    assert "conflict" in result


def test_rank_scenes_proximity():
    scenes = [
        SceneContext(n=1, title="S1", pov="A", tension=3, act=1, location="X", tag=""),
        SceneContext(n=5, title="S5", pov="A", tension=5, act=2, location="X", tag=""),
        SceneContext(n=3, title="S3", pov="A", tension=4, act=1, location="X", tag=""),
    ]
    ranked = rank_scenes_for_continuation(scenes, target_n=3)
    # Scene 3 should rank highest (distance 0)
    assert ranked[0][0].n == 3
