import uuid
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.context.formatters import (
    format_character_card,
    format_scene_with_prose,
    format_story_metadata,
    format_story_skeleton,
)
from app.ai.context.retrievers import ContextRetriever
from app.ai.context.token_budget import TokenBudget, count_tokens


@dataclass
class AssembledContext:
    """Ready-to-use context for prompt building."""
    sections: dict[str, str] = field(default_factory=dict)
    token_counts: dict[str, int] = field(default_factory=dict)
    total_tokens: int = 0
    budget_remaining: int = 0
    dropped_items: list[str] = field(default_factory=list)


class ContextAssembler:
    """Assemble, rank, truncate, and format context for AI tasks."""

    def __init__(self, db: AsyncSession, model_tier: str = "standard"):
        self.retriever = ContextRetriever(db)
        self.budget = TokenBudget(model_tier)

    async def assemble_for_prose_continuation(
        self, story_id: uuid.UUID, scene_id: uuid.UUID, scene_n: int, pov: str
    ) -> AssembledContext:
        ctx = AssembledContext()

        # Resolve core settings for the specific scene. The resolver walks
        # parent -> chapter -> part -> story, so per-chapter or per-scene
        # overrides (e.g. POV/Tense) take priority over story-level defaults.
        settings = await self.retriever.get_resolved_settings_for_scene(story_id, scene_n)
        metadata_text = format_story_metadata(settings)
        if metadata_text:
            ctx.sections["story_metadata"] = metadata_text

        # Get story skeleton
        skeleton = await self.retriever.get_story_skeleton(story_id)
        skeleton_text = format_story_skeleton(skeleton)
        ctx.sections["story_skeleton"] = self.budget.truncate_to_budget(
            skeleton_text, self.budget.allocate({"skeleton": 0.10})["skeleton"]
        )

        # Get POV character
        char = await self.retriever.get_character_by_name(story_id, pov)
        if char:
            ctx.sections["character_profile"] = format_character_card(char)

        # Get scene window (prior scenes for context)
        window = await self.retriever.get_scene_window(story_id, scene_n, radius=2)
        prior_texts = []
        for s in window:
            if s.n < scene_n and s.prose:
                prior_texts.append(format_scene_with_prose(s))
        if prior_texts:
            prior_text = "\n\n".join(prior_texts)
            ctx.sections["prior_scene_prose"] = self.budget.truncate_to_budget(
                prior_text, self.budget.allocate({"prior": 0.35})["prior"]
            )

        # Get current scene
        current = await self.retriever.get_scene_with_prose(scene_id)
        if current and current.prose:
            ctx.sections["current_scene_prose"] = self.budget.truncate_to_budget(
                current.prose, self.budget.allocate({"current": 0.30})["current"],
                keep_end=True,
            )

        # Calculate totals
        for name, text in ctx.sections.items():
            tokens = count_tokens(text)
            ctx.token_counts[name] = tokens
            ctx.total_tokens += tokens
        ctx.budget_remaining = self.budget.available - ctx.total_tokens
        return ctx

    async def assemble_for_insight_analysis(
        self, story_id: uuid.UUID, act: int
    ) -> AssembledContext:
        ctx = AssembledContext()

        settings = await self.retriever.get_story_settings(story_id)
        metadata_text = format_story_metadata(settings)
        if metadata_text:
            ctx.sections["story_metadata"] = metadata_text

        skeleton = await self.retriever.get_story_skeleton(story_id)
        ctx.sections["story_skeleton"] = format_story_skeleton(skeleton)

        act_scenes = await self.retriever.get_act_scenes(story_id, act)
        scenes_text = "\n".join(
            f"  Scene {s.n} | \"{s.title}\" | POV: {s.pov} | "
            f"Tension: {s.tension}/10 | Location: {s.location} | "
            f"Tag: {s.tag} | Summary: {s.summary or '\u2014'}"
            for s in act_scenes
        )
        ctx.sections["act_scenes"] = scenes_text

        for name, text in ctx.sections.items():
            tokens = count_tokens(text)
            ctx.token_counts[name] = tokens
            ctx.total_tokens += tokens
        ctx.budget_remaining = self.budget.available - ctx.total_tokens
        return ctx

    async def assemble_for_scaffolding(
        self, premise: str, characters: list[dict], genres: list[str]
    ) -> AssembledContext:
        """Scaffolding needs minimal context -- just the user's inputs."""
        ctx = AssembledContext()
        ctx.sections["premise"] = premise
        if characters:
            ctx.sections["characters"] = "\n".join(
                f"  - {c.get('name', '?')} ({c.get('role', '?')}): {c.get('description', '')}"
                for c in characters
            )
        if genres:
            ctx.sections["genres"] = ", ".join(genres)
        for name, text in ctx.sections.items():
            ctx.token_counts[name] = count_tokens(text)
            ctx.total_tokens += ctx.token_counts[name]
        return ctx


async def build_chat_context(
    db: "AsyncSession",
    story_id: "uuid.UUID",
    *,
    active_scene_id: "uuid.UUID | None" = None,
) -> str:
    """Adaptive medium-tier context for the chat agent.

    Always: title + logline + genres + structure + target words + flat scene list + char roster.
    If active_scene_id is given, also include that scene's full draft.
    Refresh every turn — content is small (<1k tokens for typical stories).
    """
    from sqlalchemy import select  # local import to avoid touching the existing import block
    from app.models.story import Story
    from app.models.scene import Scene
    from app.models.character import Character
    from app.services import draft as draft_service

    story = (await db.execute(select(Story).where(Story.id == story_id))).scalar_one_or_none()
    if story is None:
        return ""

    scenes = list((await db.execute(
        select(Scene).where(Scene.story_id == story_id).order_by(Scene.n.asc())
    )).scalars().all())
    chars = list((await db.execute(
        select(Character).where(Character.story_id == story_id).order_by(Character.name.asc())
    )).scalars().all())

    parts = [
        f"# Story: {story.title}",
        f"Logline: {getattr(story, 'logline', '') or ''}",
        f"Genres: {', '.join(getattr(story, 'genres', None) or [])}",
        f"Structure: {getattr(story, 'structure_type', '?')}; target words: {getattr(story, 'target_words', '?')}",
        "",
        "## Scenes (n · title — summary)",
        *[f"{s.n} · {s.title} — {(s.summary or '')[:120]}" for s in scenes],
        "",
        "## Characters",
        *[f"- {c.name} ({c.role or 'unknown'})" for c in chars],
    ]

    if active_scene_id is not None:
        active = next((s for s in scenes if s.id == active_scene_id), None)
        if active is not None:
            draft = await draft_service.get_draft(db, story_id, active_scene_id)
            parts += [
                "",
                f"## Active scene draft (scene {active.n} · {active.title})",
                draft.content if draft else "(no draft yet)",
            ]

    return "\n".join(parts)
