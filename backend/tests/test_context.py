import uuid

import pytest

from app.ai.context.assembler import ContextAssembler
from app.ai.context.formatters import (
    format_character_card,
    format_edge,
    format_scene_metadata,
    format_story_metadata,
)
from app.ai.context.rankers import rank_scenes_for_continuation
from app.ai.context.retrievers import CharacterContext, EdgeContext, SceneContext
from app.ai.context.token_budget import TokenBudget, count_tokens
from app.models.scene import Scene
from app.models.story import Story
from app.models.user import Organization
from app.services.core import populate_default_core


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


def test_format_story_metadata_renders_known_keys():
    out = format_story_metadata({
        "Title": "A Stranger in the Orchard",
        "POV": "Third-person limited",
        "Tense": "Past",
        "Genre": "Literary",
        "Unrelated": "ignored",
    })
    assert "STORY METADATA:" in out
    assert "Title: A Stranger in the Orchard" in out
    assert "POV: Third-person limited" in out
    assert "Genre: Literary" in out
    assert "Unrelated" not in out


def test_format_story_metadata_empty_dict():
    assert format_story_metadata({}) == ""
    assert format_story_metadata({"Unrelated": "x"}) == ""


@pytest.mark.asyncio
async def test_assembler_includes_story_metadata(db_session):
    org = Organization(id=uuid.uuid4(), name="Org", slug="org")
    db_session.add(org)
    await db_session.flush()

    story = Story(
        id=uuid.uuid4(),
        org_id=org.id,
        title="Assembler Test",
        genres=["Literary"],
        target_words=80000,
        structure_type="3-act",
    )
    db_session.add(story)
    await db_session.flush()

    scene = Scene(
        id=uuid.uuid4(),
        org_id=org.id,
        story_id=story.id,
        n=1,
        title="Opening",
        pov="Iris",
        tension=5,
        act=1,
        location="Orchard",
        tag="Setup",
    )
    db_session.add(scene)
    await populate_default_core(db_session, story)
    await db_session.flush()

    assembler = ContextAssembler(db_session, model_tier="standard")
    ctx = await assembler.assemble_for_prose_continuation(
        story_id=story.id, scene_id=scene.id, scene_n=1, pov="Iris"
    )
    assert "story_metadata" in ctx.sections
    assert "Title: Assembler Test" in ctx.sections["story_metadata"]


@pytest.mark.asyncio
async def test_assembler_uses_scene_override(db_session):
    """Per-scene override in core_settings should beat the story-root value
    when the assembler resolves story_metadata."""
    from app.models.core import CoreConfigNode, CoreKind, CoreSetting

    org = Organization(id=uuid.uuid4(), name="OrgScene", slug=f"org-{uuid.uuid4().hex[:8]}")
    db_session.add(org)
    await db_session.flush()

    story = Story(
        id=uuid.uuid4(),
        org_id=org.id,
        title="Override Test",
        genres=["Literary"],
        target_words=80000,
        structure_type="3-act",
    )
    db_session.add(story)
    await db_session.flush()

    scene = Scene(
        id=uuid.uuid4(),
        org_id=org.id,
        story_id=story.id,
        n=5,
        title="Jon on the ridge",
        pov="Jon",
        tension=5,
        act=2,
        location="Ridge",
        tag="",
    )
    db_session.add(scene)
    await populate_default_core(db_session, story)
    await db_session.flush()

    # Add a scene-level config node for scene 5 and override POV there.
    scene_node = CoreConfigNode(
        id=uuid.uuid4(),
        org_id=org.id,
        story_id=story.id,
        parent_id=None,
        depth=3,
        label="S05 - Jon watches",
        kind=CoreKind.scene,
        active=False,
        sort_order=1,
    )
    db_session.add(scene_node)
    await db_session.flush()

    db_session.add(
        CoreSetting(
            id=uuid.uuid4(),
            org_id=org.id,
            story_id=story.id,
            config_node_id=scene_node.id,
            key="POV",
            value="Third-person close (Jon)",
            source="user",
            tag=None,
        )
    )
    # Also set a story-level POV that the scene override should beat.
    db_session.add(
        CoreSetting(
            id=uuid.uuid4(),
            org_id=org.id,
            story_id=story.id,
            config_node_id=None,
            key="POV",
            value="Third-person limited",
            source="user",
            tag=None,
        )
    )
    await db_session.flush()

    assembler = ContextAssembler(db_session, model_tier="standard")
    ctx = await assembler.assemble_for_prose_continuation(
        story_id=story.id, scene_id=scene.id, scene_n=5, pov="Jon"
    )
    meta = ctx.sections.get("story_metadata", "")
    assert "POV: Third-person close (Jon)" in meta
    assert "POV: Third-person limited" not in meta


@pytest.mark.asyncio
async def test_assembler_omits_story_metadata_when_empty(db_session):
    org = Organization(id=uuid.uuid4(), name="Org2", slug="org2")
    db_session.add(org)
    await db_session.flush()

    story = Story(
        id=uuid.uuid4(),
        org_id=org.id,
        title="Empty",
        genres=[],
        target_words=80000,
        structure_type="3-act",
    )
    db_session.add(story)
    await db_session.flush()

    scene = Scene(
        id=uuid.uuid4(),
        org_id=org.id,
        story_id=story.id,
        n=1,
        title="Opening",
        pov="Iris",
        tension=5,
        act=1,
        location="",
        tag="",
    )
    db_session.add(scene)
    await db_session.flush()

    assembler = ContextAssembler(db_session, model_tier="standard")
    ctx = await assembler.assemble_for_prose_continuation(
        story_id=story.id, scene_id=scene.id, scene_n=1, pov="Iris"
    )
    assert "story_metadata" not in ctx.sections


@pytest.mark.asyncio
async def test_build_chat_context_medium_includes_scene_list_and_chars(
    db_session, sample_story, sample_scene, sample_character
):
    from app.ai.context.assembler import build_chat_context
    ctx = await build_chat_context(db_session, sample_story.id, active_scene_id=None)
    assert sample_story.title in ctx
    assert sample_character.name in ctx
    assert str(sample_scene.n) in ctx


@pytest.mark.asyncio
async def test_build_chat_context_includes_active_scene_draft(
    db_session, sample_story, sample_scene
):
    from app.services import draft as draft_service
    await draft_service.upsert_draft(
        db_session, sample_story.id, sample_scene.id, sample_scene.org_id, "ACTIVE_DRAFT_TEXT"
    )
    from app.ai.context.assembler import build_chat_context
    ctx = await build_chat_context(db_session, sample_story.id, active_scene_id=sample_scene.id)
    assert "ACTIVE_DRAFT_TEXT" in ctx
