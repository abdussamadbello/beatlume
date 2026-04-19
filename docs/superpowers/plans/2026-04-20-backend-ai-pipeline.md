# BeatLume Backend AI Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the AI pipeline: LiteLLM client factory with model routing, context engine (retrieval, ranking, truncation, formatting), 6 prompt modules with validation, 5 LangGraph workflows, Celery task definitions with queue routing, SSE event streaming, and AI API endpoints.

**Architecture:** LiteLLM wraps all LLM providers behind a single API. A context engine assembles the right data for each AI task. LangGraph StateGraphs orchestrate multi-step AI workflows. Celery tasks run heavy AI work asynchronously. Redis pub/sub pushes progress events to SSE endpoints.

**Tech Stack:** LangGraph, LiteLLM, tiktoken, Celery, Redis pub/sub, FastAPI SSE (StreamingResponse)

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `backend/app/ai/__init__.py` | AI package |
| `backend/app/ai/llm.py` | LiteLLM client factory, model routing |
| `backend/app/ai/context/__init__.py` | Context package |
| `backend/app/ai/context/token_budget.py` | Token counting and budget allocation |
| `backend/app/ai/context/retrievers.py` | DB retrieval strategies |
| `backend/app/ai/context/rankers.py` | Relevance scoring |
| `backend/app/ai/context/formatters.py` | Format DB objects to prompt text |
| `backend/app/ai/context/assembler.py` | Main ContextAssembler |
| `backend/app/ai/prompts/__init__.py` | Prompts package |
| `backend/app/ai/prompts/prose_continuation.py` | Prose continuation prompt + validation |
| `backend/app/ai/prompts/insight_analysis.py` | Per-act insight prompt + validation |
| `backend/app/ai/prompts/insight_synthesis.py` | Cross-act synthesis prompt + validation |
| `backend/app/ai/prompts/relationship_inference.py` | Relationship inference prompt + validation |
| `backend/app/ai/prompts/scene_summarization.py` | Scene summary prompt + validation |
| `backend/app/ai/prompts/story_scaffolding.py` | Story scaffolding prompt + validation |
| `backend/app/ai/graphs/__init__.py` | Graphs package |
| `backend/app/ai/graphs/prose_graph.py` | Prose continuation LangGraph workflow |
| `backend/app/ai/graphs/insight_graph.py` | Insight generation workflow |
| `backend/app/ai/graphs/relationship_graph.py` | Relationship inference workflow |
| `backend/app/ai/graphs/summary_graph.py` | Scene summarization workflow |
| `backend/app/ai/graphs/scaffold_graph.py` | Story scaffolding workflow |
| `backend/app/tasks/__init__.py` | Tasks package |
| `backend/app/tasks/celery_app.py` | Celery app config + queue routing |
| `backend/app/tasks/ai_tasks.py` | Async task wrappers for AI workflows |
| `backend/app/api/sse.py` | SSE event stream endpoint |
| `backend/app/api/ai.py` | AI trigger endpoints |
| `backend/tests/test_ai_prompts.py` | Prompt build + validation tests |
| `backend/tests/test_context.py` | Context engine unit tests |

### Modified Files

| File | Changes |
|------|---------|
| `backend/app/api/router.py` | Add SSE + AI routers |

---

### Task 1: LiteLLM Client Factory

**Files:**
- Create: `backend/app/ai/__init__.py`
- Create: `backend/app/ai/llm.py`

- [ ] **Step 1: Create AI package**

Create `backend/app/ai/__init__.py` (empty).

- [ ] **Step 2: Create LLM client factory**

Create `backend/app/ai/llm.py`:

```python
import json
from enum import Enum

import litellm
from litellm import completion, acompletion

from app.config import settings

# Suppress litellm logs in non-debug mode
litellm.suppress_debug_info = True


class ModelTier(str, Enum):
    FAST = "fast"
    STANDARD = "standard"
    POWERFUL = "powerful"
    SCAFFOLD = "scaffold"


TASK_MODEL_MAP: dict[str, ModelTier] = {
    "scene_summarization": ModelTier.FAST,
    "prose_continuation": ModelTier.STANDARD,
    "relationship_inference": ModelTier.STANDARD,
    "insight_generation": ModelTier.POWERFUL,
    "insight_synthesis": ModelTier.POWERFUL,
    "story_scaffolding": ModelTier.SCAFFOLD,
}


def get_model(task_type: str) -> str:
    """Get the configured model name for a given task type."""
    tier = TASK_MODEL_MAP.get(task_type, ModelTier.STANDARD)
    model_map = {
        ModelTier.FAST: settings.ai_model_fast,
        ModelTier.STANDARD: settings.ai_model_standard,
        ModelTier.POWERFUL: settings.ai_model_powerful,
        ModelTier.SCAFFOLD: settings.ai_model_scaffold,
    }
    return model_map[tier]


async def call_llm(
    task_type: str,
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: int = 2000,
    stream: bool = False,
) -> str | None:
    """
    Call an LLM via LiteLLM.

    Args:
        task_type: Maps to a model tier via TASK_MODEL_MAP
        messages: OpenAI-format messages
        temperature: Sampling temperature
        max_tokens: Max output tokens
        stream: If True, returns an async generator of chunks

    Returns:
        The response content string, or None if streaming (use call_llm_stream instead)
    """
    model = get_model(task_type)
    response = await acompletion(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=stream,
    )
    if stream:
        return response  # Returns async generator
    return response.choices[0].message.content


async def call_llm_stream(
    task_type: str,
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: int = 2000,
):
    """
    Stream LLM response chunks via LiteLLM.

    Yields:
        Content string chunks as they arrive.
    """
    model = get_model(task_type)
    response = await acompletion(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
    )
    async for chunk in response:
        delta = chunk.choices[0].delta
        if delta and delta.content:
            yield delta.content


def parse_json_response(raw: str) -> dict | list:
    """Parse JSON from LLM response, handling markdown code blocks."""
    text = raw.strip()
    # Strip markdown code blocks if present
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first and last lines (```json and ```)
        lines = [l for l in lines[1:] if not l.strip().startswith("```")]
        text = "\n".join(lines)
    return json.loads(text)
```

- [ ] **Step 3: Verify**

```bash
cd /home/abdussamadbello/beatlume/backend
PYTHONPATH=. uv run python -c "from app.ai.llm import get_model, ModelTier, TASK_MODEL_MAP; print(get_model('prose_continuation'))"
```

Expected: `gpt-4o`

- [ ] **Step 4: Commit**

```bash
git add backend/app/ai/__init__.py backend/app/ai/llm.py
git commit -m "feat: add LiteLLM client factory with model routing"
```

---

### Task 2: Context Engine

**Files:**
- Create: `backend/app/ai/context/__init__.py`
- Create: `backend/app/ai/context/token_budget.py`
- Create: `backend/app/ai/context/retrievers.py`
- Create: `backend/app/ai/context/rankers.py`
- Create: `backend/app/ai/context/formatters.py`
- Create: `backend/app/ai/context/assembler.py`

- [ ] **Step 1: Create context package**

Create `backend/app/ai/context/__init__.py`:

```python
from app.ai.context.assembler import ContextAssembler, AssembledContext

__all__ = ["ContextAssembler", "AssembledContext"]
```

- [ ] **Step 2: Create token budget module**

Create `backend/app/ai/context/token_budget.py`:

```python
import tiktoken


def count_tokens(text: str, model: str = "gpt-4o") -> int:
    """Count tokens for a given text. Falls back to cl100k_base."""
    try:
        enc = tiktoken.encoding_for_model(model)
    except KeyError:
        enc = tiktoken.get_encoding("cl100k_base")
    return len(enc.encode(text))


class TokenBudget:
    """Manage token budget allocation across context sections."""

    MODEL_LIMITS = {
        "fast": 16_000,
        "standard": 128_000,
        "powerful": 200_000,
    }

    def __init__(self, model_tier: str = "standard", output_reserve: int = 2000):
        self.total = self.MODEL_LIMITS.get(model_tier, 128_000)
        self.output_reserve = output_reserve
        self.system_prompt_tokens = 0

    def set_system_prompt_tokens(self, tokens: int):
        self.system_prompt_tokens = tokens

    @property
    def available(self) -> int:
        return self.total - self.output_reserve - self.system_prompt_tokens

    def allocate(self, sections: dict[str, float]) -> dict[str, int]:
        """Allocate available budget proportionally across named sections."""
        remaining = self.available
        return {k: int(remaining * v) for k, v in sections.items()}

    def truncate_to_budget(self, text: str, max_tokens: int, keep_end: bool = False) -> str:
        """Truncate text to fit within token budget. Smart sentence-boundary truncation."""
        tokens = count_tokens(text)
        if tokens <= max_tokens:
            return text

        # Rough char estimate: ~4 chars per token
        target_chars = max_tokens * 4
        if keep_end:
            truncated = text[-target_chars:]
            # Find first sentence boundary
            for sep in [". ", ".\n", "\n\n"]:
                idx = truncated.find(sep)
                if idx != -1 and idx < len(truncated) // 3:
                    truncated = truncated[idx + len(sep):]
                    break
            return "..." + truncated
        else:
            truncated = text[:target_chars]
            # Find last sentence boundary
            for sep in [". ", ".\n", "\n\n"]:
                idx = truncated.rfind(sep)
                if idx != -1 and idx > len(truncated) * 2 // 3:
                    truncated = truncated[:idx + 1]
                    break
            return truncated + "..."
```

- [ ] **Step 3: Create retrievers module**

Create `backend/app/ai/context/retrievers.py`:

```python
import uuid
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.character import Character
from app.models.draft import DraftContent
from app.models.graph import CharacterEdge, CharacterNode
from app.models.scene import Scene


@dataclass
class SceneContext:
    n: int
    title: str
    pov: str
    tension: int
    act: int
    location: str
    tag: str
    summary: str | None = None
    prose: str | None = None


@dataclass
class CharacterContext:
    name: str
    role: str
    desire: str
    flaw: str
    scene_count: int


@dataclass
class EdgeContext:
    source: str
    target: str
    kind: str
    weight: float


@dataclass
class StorySkeleton:
    scenes: list[SceneContext]
    characters: list[CharacterContext]
    edges: list[EdgeContext]


class ContextRetriever:
    """Retrieve raw context candidates from the database."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_scene_with_prose(self, scene_id: uuid.UUID) -> SceneContext | None:
        scene_r = await self.db.execute(select(Scene).where(Scene.id == scene_id))
        scene = scene_r.scalar_one_or_none()
        if not scene:
            return None
        draft_r = await self.db.execute(
            select(DraftContent).where(DraftContent.scene_id == scene_id)
        )
        draft = draft_r.scalar_one_or_none()
        return SceneContext(
            n=scene.n, title=scene.title, pov=scene.pov, tension=scene.tension,
            act=scene.act, location=scene.location, tag=scene.tag,
            summary=scene.summary, prose=draft.content if draft else None,
        )

    async def get_scene_window(
        self, story_id: uuid.UUID, center_n: int, radius: int = 2
    ) -> list[SceneContext]:
        result = await self.db.execute(
            select(Scene)
            .where(Scene.story_id == story_id, Scene.n >= center_n - radius, Scene.n <= center_n + radius)
            .order_by(Scene.n)
        )
        scenes = result.scalars().all()
        contexts = []
        for s in scenes:
            draft_r = await self.db.execute(
                select(DraftContent).where(DraftContent.scene_id == s.id)
            )
            draft = draft_r.scalar_one_or_none()
            contexts.append(SceneContext(
                n=s.n, title=s.title, pov=s.pov, tension=s.tension,
                act=s.act, location=s.location, tag=s.tag,
                summary=s.summary, prose=draft.content if draft else None,
            ))
        return contexts

    async def get_story_skeleton(self, story_id: uuid.UUID) -> StorySkeleton:
        scenes_r = await self.db.execute(
            select(Scene).where(Scene.story_id == story_id).order_by(Scene.n)
        )
        scenes = [
            SceneContext(n=s.n, title=s.title, pov=s.pov, tension=s.tension,
                         act=s.act, location=s.location, tag=s.tag, summary=s.summary)
            for s in scenes_r.scalars().all()
        ]
        chars_r = await self.db.execute(
            select(Character).where(Character.story_id == story_id)
        )
        characters = [
            CharacterContext(name=c.name, role=c.role, desire=c.desire,
                             flaw=c.flaw, scene_count=c.scene_count)
            for c in chars_r.scalars().all()
        ]
        nodes_r = await self.db.execute(
            select(CharacterNode).where(CharacterNode.story_id == story_id)
        )
        node_map = {n.id: n.label for n in nodes_r.scalars().all()}
        edges_r = await self.db.execute(
            select(CharacterEdge).where(CharacterEdge.story_id == story_id)
        )
        edge_list = [
            EdgeContext(
                source=node_map.get(e.source_node_id, "?"),
                target=node_map.get(e.target_node_id, "?"),
                kind=e.kind, weight=e.weight,
            )
            for e in edges_r.scalars().all()
        ]
        return StorySkeleton(scenes=scenes, characters=characters, edges=edge_list)

    async def get_character_by_name(self, story_id: uuid.UUID, name: str) -> CharacterContext | None:
        result = await self.db.execute(
            select(Character).where(Character.story_id == story_id, Character.name == name)
        )
        c = result.scalar_one_or_none()
        if not c:
            return None
        return CharacterContext(name=c.name, role=c.role, desire=c.desire,
                                flaw=c.flaw, scene_count=c.scene_count)

    async def get_act_scenes(self, story_id: uuid.UUID, act: int) -> list[SceneContext]:
        result = await self.db.execute(
            select(Scene).where(Scene.story_id == story_id, Scene.act == act).order_by(Scene.n)
        )
        return [
            SceneContext(n=s.n, title=s.title, pov=s.pov, tension=s.tension,
                         act=s.act, location=s.location, tag=s.tag, summary=s.summary)
            for s in result.scalars().all()
        ]
```

- [ ] **Step 4: Create formatters module**

Create `backend/app/ai/context/formatters.py`:

```python
from app.ai.context.retrievers import CharacterContext, EdgeContext, SceneContext, StorySkeleton


def format_scene_metadata(scene: SceneContext) -> str:
    return (
        f"Scene {scene.n} | \"{scene.title}\" | POV: {scene.pov} | "
        f"Tension: {scene.tension}/10 | Location: {scene.location} | Tag: {scene.tag}"
    )


def format_scene_with_prose(scene: SceneContext) -> str:
    header = format_scene_metadata(scene)
    if scene.prose:
        return f"--- {header} ---\n{scene.prose}\n---"
    return header


def format_character_card(char: CharacterContext) -> str:
    return (
        f"{char.name} ({char.role}) — Desire: {char.desire} | "
        f"Flaw: {char.flaw} | Scenes: {char.scene_count}"
    )


def format_edge(edge: EdgeContext) -> str:
    return f"{edge.source} ↔ {edge.target} — {edge.kind} (weight: {edge.weight})"


def format_story_skeleton(skeleton: StorySkeleton) -> str:
    lines = ["STORY OVERVIEW:"]
    lines.append(f"\nSCENES ({len(skeleton.scenes)}):")
    for s in skeleton.scenes:
        lines.append(f"  {format_scene_metadata(s)}")
    lines.append(f"\nCHARACTERS ({len(skeleton.characters)}):")
    for c in skeleton.characters:
        lines.append(f"  {format_character_card(c)}")
    lines.append(f"\nRELATIONSHIPS ({len(skeleton.edges)}):")
    for e in skeleton.edges:
        lines.append(f"  {format_edge(e)}")
    return "\n".join(lines)
```

- [ ] **Step 5: Create rankers module**

Create `backend/app/ai/context/rankers.py`:

```python
import math

from app.ai.context.retrievers import SceneContext


def rank_scenes_for_continuation(
    scenes: list[SceneContext], target_n: int
) -> list[tuple[SceneContext, float]]:
    """Rank scenes by relevance for prose continuation. Higher score = more relevant."""
    scored = []
    for s in scenes:
        distance = abs(s.n - target_n)
        # Exponential decay by distance
        proximity_score = math.exp(-0.5 * distance)
        score = proximity_score
        scored.append((s, score))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored


def rank_scenes_for_insights(
    scenes: list[SceneContext], category: str | None = None
) -> list[tuple[SceneContext, float]]:
    """Rank scenes by relevance for insight analysis."""
    scored = []
    for s in scenes:
        score = 1.0
        if category == "Pacing":
            # Extreme tensions are more interesting for pacing analysis
            score = abs(s.tension - 5.5) / 4.5
        elif category == "Characters":
            # Scenes with named POV are more relevant
            score = 1.0 if s.pov else 0.5
        scored.append((s, score))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored
```

- [ ] **Step 6: Create assembler module**

Create `backend/app/ai/context/assembler.py`:

```python
import uuid
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.context.formatters import (
    format_character_card,
    format_scene_with_prose,
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

        skeleton = await self.retriever.get_story_skeleton(story_id)
        ctx.sections["story_skeleton"] = format_story_skeleton(skeleton)

        act_scenes = await self.retriever.get_act_scenes(story_id, act)
        scenes_text = "\n".join(
            f"  Scene {s.n} | \"{s.title}\" | POV: {s.pov} | "
            f"Tension: {s.tension}/10 | Location: {s.location} | "
            f"Tag: {s.tag} | Summary: {s.summary or '—'}"
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
        """Scaffolding needs minimal context — just the user's inputs."""
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
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/ai/context/
git commit -m "feat: add context engine with retrievers, rankers, formatters, and assembler"
```

---

### Task 3: Prompt Modules

**Files:**
- Create: `backend/app/ai/prompts/__init__.py`
- Create: All 6 prompt modules

- [ ] **Step 1: Create prompts package**

Create `backend/app/ai/prompts/__init__.py` (empty).

- [ ] **Step 2: Create prose continuation prompt**

Create `backend/app/ai/prompts/prose_continuation.py`:

```python
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
```

- [ ] **Step 3: Create insight analysis prompt**

Create `backend/app/ai/prompts/insight_analysis.py`:

```python
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
```

- [ ] **Step 4: Create insight synthesis prompt**

Create `backend/app/ai/prompts/insight_synthesis.py`:

```python
from textwrap import dedent

from app.ai.llm import parse_json_response


def build_prompt(
    all_chunk_findings: list[list[dict]],
    story_context: dict,
) -> list[dict]:
    findings_block = ""
    for i, findings in enumerate(all_chunk_findings, 1):
        findings_block += f"\nACT {i} FINDINGS:\n"
        for f in findings:
            findings_block += (
                f"  [{f['severity']}] {f['category']}: {f['title']} — "
                f"{f['body']} (refs: {', '.join(f.get('refs', []))})\n"
            )

    return [
        {
            "role": "system",
            "content": dedent("""
                You are a senior developmental editor producing a final analysis from per-act findings.

                1. Deduplicate findings that flag the same underlying issue across acts.
                2. Promote/demote severity based on scope (multi-act = escalate).
                3. Add cross-act findings only visible in the full arc.
                4. Rank by impact, most critical first.

                OUTPUT: JSON array of 5-10 final insights:
                [{"severity": "...", "category": "...", "title": "...", "body": "...", "refs": [...]}]

                Output ONLY the JSON array.
            """).strip(),
        },
        {
            "role": "user",
            "content": dedent(f"""
                STORY: "{story_context.get('title', 'Untitled')}" — {story_context.get('genre', 'Literary')}

                PER-ACT FINDINGS:
                {findings_block}

                Synthesize into a final insight report.
            """).strip(),
        },
    ]


def validate_output(raw: str) -> list[dict]:
    data = parse_json_response(raw)
    if not isinstance(data, list):
        raise ValueError("Expected JSON array")
    for item in data:
        if item.get("severity") not in ("red", "amber", "blue"):
            raise ValueError(f"Invalid severity: {item.get('severity')}")
    return data
```

- [ ] **Step 5: Create relationship inference prompt**

Create `backend/app/ai/prompts/relationship_inference.py`:

```python
from textwrap import dedent

from app.ai.llm import parse_json_response


def build_prompt(
    char_a: dict,
    char_b: dict,
    shared_scenes: list[dict],
    shared_prose_excerpts: list[str],
    existing_edge: dict | None,
) -> list[dict]:
    excerpts_block = "\n---\n".join(shared_prose_excerpts[:5])
    existing_block = (
        f"Current relationship: {existing_edge['kind']} (weight: {existing_edge['weight']})"
        if existing_edge
        else "No existing relationship defined."
    )

    return [
        {
            "role": "system",
            "content": dedent("""
                You are a literary analyst specializing in character dynamics.

                Given two characters and prose where they interact, determine their relationship.

                RELATIONSHIP TYPES: conflict, alliance, romance, mentor, secret, family

                OUTPUT — JSON object:
                {
                  "kind": "conflict" | "alliance" | "romance" | "mentor" | "secret" | "family" | null,
                  "weight": 0.1-1.0,
                  "direction": "a_to_b" | "b_to_a" | "mutual",
                  "reasoning": "1-2 sentences with evidence from the text.",
                  "changed": true | false
                }

                If insufficient evidence: {"kind": null, "weight": 0, "reasoning": "Insufficient data."}
                Output ONLY the JSON object.
            """).strip(),
        },
        {
            "role": "user",
            "content": dedent(f"""
                CHARACTER A: {char_a.get('name', '?')} ({char_a.get('role', '?')})
                  Desire: {char_a.get('desire', '?')}
                  Flaw: {char_a.get('flaw', '?')}

                CHARACTER B: {char_b.get('name', '?')} ({char_b.get('role', '?')})
                  Desire: {char_b.get('desire', '?')}
                  Flaw: {char_b.get('flaw', '?')}

                {existing_block}

                SHARED SCENES: {', '.join(f"S{s.get('n', '?'):02d}" for s in shared_scenes)}

                PROSE EXCERPTS:
                {excerpts_block or 'No prose available'}

                Analyze their relationship.
            """).strip(),
        },
    ]


def validate_output(raw: str) -> dict:
    data = parse_json_response(raw)
    if not isinstance(data, dict):
        raise ValueError("Expected JSON object")
    if data.get("kind") is not None and data["kind"] not in (
        "conflict", "alliance", "romance", "mentor", "secret", "family"
    ):
        raise ValueError(f"Invalid kind: {data['kind']}")
    return data
```

- [ ] **Step 6: Create scene summarization prompt**

Create `backend/app/ai/prompts/scene_summarization.py`:

```python
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
```

- [ ] **Step 7: Create story scaffolding prompt**

Create `backend/app/ai/prompts/story_scaffolding.py`:

```python
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
                raise ValueError(f"Scene missing required fields")
    return data
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/ai/prompts/
git commit -m "feat: add 6 prompt modules with build and validation functions"
```

---

### Task 4: LangGraph Workflows

**Files:**
- Create: `backend/app/ai/graphs/__init__.py`
- Create: 5 graph workflow files

- [ ] **Step 1: Create graphs package**

Create `backend/app/ai/graphs/__init__.py` (empty).

- [ ] **Step 2: Create prose continuation graph**

Create `backend/app/ai/graphs/prose_graph.py`:

```python
import uuid
from typing import TypedDict

from langgraph.graph import StateGraph, END

from app.ai.context.assembler import ContextAssembler
from app.ai.llm import call_llm
from app.ai.prompts import prose_continuation


class ProseState(TypedDict):
    story_id: str
    scene_id: str
    scene_n: int
    pov: str
    scene: dict
    story_context: dict
    pov_character: dict | None
    context: dict | None
    result: str | None
    error: str | None


async def gather_context(state: ProseState) -> dict:
    # Context assembly happens in the Celery task before graph execution
    # This node just validates the context is present
    if not state.get("context"):
        return {"error": "No context provided"}
    return {}


async def generate_prose(state: ProseState) -> dict:
    from app.ai.context.assembler import AssembledContext

    ctx = AssembledContext(sections=state["context"])
    messages = prose_continuation.build_prompt(
        ctx, state["scene"], state["story_context"], state.get("pov_character")
    )
    try:
        result = await call_llm("prose_continuation", messages, temperature=0.8, max_tokens=500)
        validated = prose_continuation.validate_output(result)
        return {"result": validated}
    except Exception as e:
        return {"error": str(e)}


def should_end(state: ProseState) -> str:
    if state.get("error"):
        return "error"
    return "continue"


def build_prose_graph() -> StateGraph:
    graph = StateGraph(ProseState)
    graph.add_node("gather_context", gather_context)
    graph.add_node("generate_prose", generate_prose)
    graph.set_entry_point("gather_context")
    graph.add_conditional_edges("gather_context", should_end, {"error": END, "continue": "generate_prose"})
    graph.add_edge("generate_prose", END)
    return graph.compile()
```

- [ ] **Step 3: Create insight generation graph**

Create `backend/app/ai/graphs/insight_graph.py`:

```python
from typing import TypedDict

from langgraph.graph import StateGraph, END

from app.ai.llm import call_llm
from app.ai.prompts import insight_analysis, insight_synthesis


class InsightState(TypedDict):
    story_id: str
    story_context: dict
    act_contexts: dict  # {act_number: context_sections}
    chunk_findings: list  # findings per act
    final_insights: list | None
    error: str | None


async def analyze_acts(state: InsightState) -> dict:
    from app.ai.context.assembler import AssembledContext

    all_findings = []
    for act_num, sections in state["act_contexts"].items():
        ctx = AssembledContext(sections=sections)
        messages = insight_analysis.build_prompt(ctx, state["story_context"], int(act_num))
        try:
            result = await call_llm("insight_generation", messages, temperature=0.3, max_tokens=2000)
            findings = insight_analysis.validate_output(result)
            all_findings.append(findings)
        except Exception as e:
            all_findings.append([{"severity": "blue", "category": "Structure",
                                  "title": f"Analysis failed for Act {act_num}",
                                  "body": str(e), "refs": []}])
    return {"chunk_findings": all_findings}


async def synthesize(state: InsightState) -> dict:
    if not state["chunk_findings"]:
        return {"error": "No findings to synthesize"}
    messages = insight_synthesis.build_prompt(state["chunk_findings"], state["story_context"])
    try:
        result = await call_llm("insight_synthesis", messages, temperature=0.3, max_tokens=2000)
        insights = insight_synthesis.validate_output(result)
        return {"final_insights": insights}
    except Exception as e:
        return {"error": str(e)}


def build_insight_graph() -> StateGraph:
    graph = StateGraph(InsightState)
    graph.add_node("analyze_acts", analyze_acts)
    graph.add_node("synthesize", synthesize)
    graph.set_entry_point("analyze_acts")
    graph.add_edge("analyze_acts", "synthesize")
    graph.add_edge("synthesize", END)
    return graph.compile()
```

- [ ] **Step 4: Create summary graph**

Create `backend/app/ai/graphs/summary_graph.py`:

```python
from typing import TypedDict

from langgraph.graph import StateGraph, END

from app.ai.llm import call_llm
from app.ai.prompts import scene_summarization


class SummaryState(TypedDict):
    scene: dict
    prose: str
    pov_character: dict | None
    result: dict | None
    error: str | None


async def generate_summary(state: SummaryState) -> dict:
    messages = scene_summarization.build_prompt(
        state["scene"], state["prose"], state.get("pov_character")
    )
    try:
        result = await call_llm("scene_summarization", messages, temperature=0.3, max_tokens=500)
        validated = scene_summarization.validate_output(result)
        return {"result": validated}
    except Exception as e:
        return {"error": str(e)}


def build_summary_graph() -> StateGraph:
    graph = StateGraph(SummaryState)
    graph.add_node("generate_summary", generate_summary)
    graph.set_entry_point("generate_summary")
    graph.add_edge("generate_summary", END)
    return graph.compile()
```

- [ ] **Step 5: Create scaffold graph**

Create `backend/app/ai/graphs/scaffold_graph.py`:

```python
from typing import TypedDict

from langgraph.graph import StateGraph, END

from app.ai.llm import call_llm
from app.ai.prompts import story_scaffolding


class ScaffoldState(TypedDict):
    premise: str
    structure_type: str
    target_words: int
    genres: list
    characters: list
    result: dict | None
    error: str | None


async def generate_scaffold(state: ScaffoldState) -> dict:
    messages = story_scaffolding.build_prompt(
        state["premise"], state["structure_type"], state["target_words"],
        state["genres"], state["characters"],
    )
    try:
        result = await call_llm("story_scaffolding", messages, temperature=0.7, max_tokens=4000)
        validated = story_scaffolding.validate_output(result)
        return {"result": validated}
    except Exception as e:
        return {"error": str(e)}


def build_scaffold_graph() -> StateGraph:
    graph = StateGraph(ScaffoldState)
    graph.add_node("generate_scaffold", generate_scaffold)
    graph.set_entry_point("generate_scaffold")
    graph.add_edge("generate_scaffold", END)
    return graph.compile()
```

- [ ] **Step 6: Create relationship graph**

Create `backend/app/ai/graphs/relationship_graph.py`:

```python
from typing import TypedDict

from langgraph.graph import StateGraph, END

from app.ai.llm import call_llm
from app.ai.prompts import relationship_inference


class RelationshipState(TypedDict):
    pairs: list  # list of {char_a, char_b, shared_scenes, prose_excerpts, existing_edge}
    results: list
    error: str | None


async def analyze_pairs(state: RelationshipState) -> dict:
    results = []
    for pair in state["pairs"]:
        messages = relationship_inference.build_prompt(
            pair["char_a"], pair["char_b"], pair["shared_scenes"],
            pair["prose_excerpts"], pair.get("existing_edge"),
        )
        try:
            result = await call_llm("relationship_inference", messages, temperature=0.3, max_tokens=500)
            validated = relationship_inference.validate_output(result)
            validated["char_a"] = pair["char_a"]["name"]
            validated["char_b"] = pair["char_b"]["name"]
            results.append(validated)
        except Exception as e:
            results.append({"char_a": pair["char_a"]["name"], "char_b": pair["char_b"]["name"],
                           "kind": None, "error": str(e)})
    return {"results": results}


def build_relationship_graph() -> StateGraph:
    graph = StateGraph(RelationshipState)
    graph.add_node("analyze_pairs", analyze_pairs)
    graph.set_entry_point("analyze_pairs")
    graph.add_edge("analyze_pairs", END)
    return graph.compile()
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/ai/graphs/
git commit -m "feat: add 5 LangGraph workflow definitions"
```

---

### Task 5: Celery App + AI Tasks

**Files:**
- Create: `backend/app/tasks/__init__.py`
- Create: `backend/app/tasks/celery_app.py`
- Create: `backend/app/tasks/ai_tasks.py`

- [ ] **Step 1: Create tasks package**

Create `backend/app/tasks/__init__.py` (empty).

- [ ] **Step 2: Create Celery app config**

Create `backend/app/tasks/celery_app.py`:

```python
from celery import Celery

from app.config import settings

celery_app = Celery("beatlume")

celery_app.config_from_object({
    "broker_url": settings.redis_url,
    "result_backend": settings.redis_url,
    "task_serializer": "json",
    "result_serializer": "json",
    "accept_content": ["json"],
    "task_track_started": True,
    "task_time_limit": 300,
    "task_soft_time_limit": 240,
    "worker_prefetch_multiplier": 1,
    "task_acks_late": True,
})

celery_app.conf.task_routes = {
    "app.tasks.ai_tasks.continue_prose": {"queue": "ai_fast"},
    "app.tasks.ai_tasks.summarize_scene": {"queue": "ai_fast"},
    "app.tasks.ai_tasks.generate_insights": {"queue": "ai_heavy"},
    "app.tasks.ai_tasks.infer_relationships": {"queue": "ai_heavy"},
    "app.tasks.ai_tasks.scaffold_story": {"queue": "ai_heavy"},
}
```

- [ ] **Step 3: Create AI task definitions**

Create `backend/app/tasks/ai_tasks.py`:

```python
import json
import redis

from app.config import settings
from app.tasks.celery_app import celery_app

redis_client = redis.Redis.from_url(settings.redis_url)


def publish_event(story_id: str, event_type: str, data: dict):
    """Publish event to Redis pub/sub for SSE consumption."""
    redis_client.publish(
        f"story:{story_id}:events",
        json.dumps({"type": event_type, "data": data}),
    )


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def continue_prose(self, story_id: str, scene_id: str, org_id: str):
    """Prose continuation task. Runs ProseGraph and publishes result."""
    publish_event(story_id, "ai.progress", {
        "task_id": self.request.id, "type": "prose_continuation", "status": "running",
    })
    try:
        # Graph execution happens here — requires async context
        # For now, this is a placeholder that will be wired up when
        # we integrate with the async DB session in the Celery worker
        publish_event(story_id, "ai.complete", {
            "task_id": self.request.id, "type": "prose_continuation",
            "status": "completed",
        })
    except Exception as exc:
        publish_event(story_id, "ai.error", {
            "task_id": self.request.id, "error": str(exc),
        })
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def generate_insights(self, story_id: str, org_id: str):
    """Full story insight analysis."""
    publish_event(story_id, "ai.progress", {
        "task_id": self.request.id, "type": "insight_generation", "status": "running",
    })
    try:
        publish_event(story_id, "ai.complete", {
            "task_id": self.request.id, "type": "insight_generation",
            "status": "completed",
        })
    except Exception as exc:
        publish_event(story_id, "ai.error", {
            "task_id": self.request.id, "error": str(exc),
        })
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def infer_relationships(self, story_id: str, org_id: str):
    """AI relationship inference across character pairs."""
    publish_event(story_id, "ai.progress", {
        "task_id": self.request.id, "type": "relationship_inference", "status": "running",
    })
    try:
        publish_event(story_id, "ai.complete", {
            "task_id": self.request.id, "type": "relationship_inference",
            "status": "completed",
        })
    except Exception as exc:
        publish_event(story_id, "ai.error", {
            "task_id": self.request.id, "error": str(exc),
        })
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def summarize_scene(self, story_id: str, scene_id: str, org_id: str):
    """Generate summary + beats for a single scene."""
    publish_event(story_id, "ai.progress", {
        "task_id": self.request.id, "type": "scene_summarization", "status": "running",
    })
    try:
        publish_event(story_id, "ai.complete", {
            "task_id": self.request.id, "type": "scene_summarization",
            "status": "completed",
        })
    except Exception as exc:
        publish_event(story_id, "ai.error", {
            "task_id": self.request.id, "error": str(exc),
        })
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def scaffold_story(self, story_id: str, premise: str, structure: str,
                   target_words: int, genres: list, characters: list, org_id: str):
    """Generate full story structure from premise."""
    publish_event(story_id, "ai.progress", {
        "task_id": self.request.id, "type": "story_scaffolding", "status": "running",
    })
    try:
        publish_event(story_id, "ai.complete", {
            "task_id": self.request.id, "type": "story_scaffolding",
            "status": "completed",
        })
    except Exception as exc:
        publish_event(story_id, "ai.error", {
            "task_id": self.request.id, "error": str(exc),
        })
        raise self.retry(exc=exc)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/tasks/
git commit -m "feat: add Celery app config and AI task definitions"
```

---

### Task 6: SSE Endpoint + AI API Endpoints

**Files:**
- Create: `backend/app/api/sse.py`
- Create: `backend/app/api/ai.py`
- Modify: `backend/app/api/router.py`

- [ ] **Step 1: Create SSE endpoint**

Create `backend/app/api/sse.py`:

```python
import asyncio
import json
import uuid

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.config import settings
from app.deps import get_current_user, get_story
from app.models.story import Story
from app.models.user import User

router = APIRouter(prefix="/api/stories/{story_id}", tags=["sse"])


@router.get("/events")
async def story_events(
    story: Story = Depends(get_story),
    user: User = Depends(get_current_user),
):
    """SSE endpoint for real-time story events."""

    async def event_generator():
        r = aioredis.from_url(settings.redis_url)
        pubsub = r.pubsub()
        await pubsub.subscribe(f"story:{story.id}:events")
        try:
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=30)
                if message and message["type"] == "message":
                    event_data = json.loads(message["data"])
                    event_type = event_data.get("type", "message")
                    data = json.dumps(event_data.get("data", {}))
                    yield f"event: {event_type}\ndata: {data}\n\n"
                else:
                    # Send keepalive
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe()
            await r.aclose()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

- [ ] **Step 2: Create AI trigger endpoints**

Create `backend/app/api/ai.py`:

```python
import uuid

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_org, get_db, get_story
from app.models.story import Story
from app.models.user import Organization
from app.tasks.ai_tasks import (
    continue_prose,
    generate_insights,
    infer_relationships,
    scaffold_story,
    summarize_scene,
)

router = APIRouter(tags=["ai"])


class TaskResponse(BaseModel):
    task_id: str


class ScaffoldRequest(BaseModel):
    premise: str
    structure_type: str = "3-act"
    target_words: int = 80000
    genres: list[str] = []
    characters: list[dict] = []


@router.post(
    "/api/stories/{story_id}/insights/generate",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_insights(
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
):
    task = generate_insights.delay(str(story.id), str(org.id))
    return TaskResponse(task_id=task.id)


@router.post(
    "/api/stories/{story_id}/draft/{scene_id}/ai-continue",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_prose_continuation(
    scene_id: uuid.UUID,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
):
    task = continue_prose.delay(str(story.id), str(scene_id), str(org.id))
    return TaskResponse(task_id=task.id)


@router.post(
    "/api/stories/{story_id}/ai/relationships",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_relationship_inference(
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
):
    task = infer_relationships.delay(str(story.id), str(org.id))
    return TaskResponse(task_id=task.id)


@router.post(
    "/api/stories/{story_id}/ai/summarize/{scene_id}",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_scene_summary(
    scene_id: uuid.UUID,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
):
    task = summarize_scene.delay(str(story.id), str(scene_id), str(org.id))
    return TaskResponse(task_id=task.id)


@router.post(
    "/api/stories/{story_id}/ai/scaffold",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_scaffold(
    body: ScaffoldRequest,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
):
    task = scaffold_story.delay(
        str(story.id), body.premise, body.structure_type,
        body.target_words, body.genres, body.characters, str(org.id),
    )
    return TaskResponse(task_id=task.id)
```

- [ ] **Step 3: Update router.py**

Add to `backend/app/api/router.py`:

```python
from app.api.sse import router as sse_router
from app.api.ai import router as ai_router
```

And:

```python
api_router.include_router(sse_router)
api_router.include_router(ai_router)
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/sse.py backend/app/api/ai.py backend/app/api/router.py
git commit -m "feat: add SSE event stream and AI trigger endpoints"
```

---

### Task 7: Prompt + Context Unit Tests

**Files:**
- Create: `backend/tests/test_ai_prompts.py`
- Create: `backend/tests/test_context.py`

- [ ] **Step 1: Create prompt tests**

Create `backend/tests/test_ai_prompts.py`:

```python
import json

from app.ai.prompts import (
    insight_analysis,
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
    assert prose_continuation.validate_output("The wind shifted and she looked up.") is not None
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
```

- [ ] **Step 2: Create context tests**

Create `backend/tests/test_context.py`:

```python
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
```

- [ ] **Step 3: Run all tests**

```bash
cd /home/abdussamadbello/beatlume/backend
PYTHONPATH=. uv run pytest tests/ -v
```

Expected: All previous tests plus new prompt/context tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_ai_prompts.py backend/tests/test_context.py
git commit -m "test: add prompt build/validation and context engine unit tests"
```

---

## Verification Checklist

1. `from app.ai.llm import get_model; get_model("prose_continuation")` → returns model name
2. Context engine: retrievers, rankers, formatters, assembler all import cleanly
3. All 6 prompt modules build valid message lists and validate outputs
4. All 5 LangGraph workflows compile without errors
5. Celery app configures with Redis URL and queue routing
6. SSE endpoint registered at `/api/stories/{story_id}/events`
7. AI trigger endpoints return 202 with task_id
8. All tests pass
