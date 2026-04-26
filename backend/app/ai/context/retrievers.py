import uuid
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.character import Character
from app.models.core import CoreConfigNode, CoreKind, CoreSetting
from app.models.draft import DraftContent
from app.models.graph import CharacterEdge, CharacterNode
from app.models.scene import Scene
from app.services.core import resolved_settings_dict


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

    async def get_story_settings(self, story_id: uuid.UUID) -> dict[str, str]:
        """Fetch story-root core settings as a flat {key: value} map.

        Only returns the NULL-node (story-level) rows. For scene-scoped values
        that respect per-node overrides, use `get_resolved_settings_for_scene`.
        """
        result = await self.db.execute(
            select(CoreSetting).where(
                CoreSetting.story_id == story_id,
                CoreSetting.config_node_id.is_(None),
            )
        )
        return {r.key: r.value for r in result.scalars().all()}

    async def get_resolved_settings_for_scene(
        self, story_id: uuid.UUID, scene_n: int
    ) -> dict[str, str]:
        """Resolve core settings for the config node that represents this scene.

        The scene's config node is matched by label convention: ``Sxx`` (with
        optional zero-padding) at the start of the node's label. When no
        matching node is found, falls back to story-root settings.
        """
        result = await self.db.execute(
            select(CoreConfigNode).where(
                CoreConfigNode.story_id == story_id,
                CoreConfigNode.kind == CoreKind.scene,
            )
        )
        scene_nodes = result.scalars().all()
        match: CoreConfigNode | None = None
        for node in scene_nodes:
            label = node.label.strip()
            # Labels look like "S05 — Jon watches from the ridge"; extract the
            # leading integer after the S prefix.
            if not label:
                continue
            head = label.split(None, 1)[0].lstrip("Ss").lstrip("0") or "0"
            try:
                if int(head) == scene_n:
                    match = node
                    break
            except ValueError:
                continue
        target_node_id = match.id if match is not None else None
        return await resolved_settings_dict(self.db, story_id, target_node_id)

    async def get_act_scenes(self, story_id: uuid.UUID, act: int) -> list[SceneContext]:
        result = await self.db.execute(
            select(Scene).where(Scene.story_id == story_id, Scene.act == act).order_by(Scene.n)
        )
        return [
            SceneContext(n=s.n, title=s.title, pov=s.pov, tension=s.tension,
                         act=s.act, location=s.location, tag=s.tag, summary=s.summary)
            for s in result.scalars().all()
        ]

    async def get_act_scenes_with_prose(
        self, story_id: uuid.UUID, act: int
    ) -> list[SceneContext]:
        """Like get_act_scenes but also loads draft prose for each scene.

        Used by the insight analyzer so the model can flag prose-level issues
        (voice, dialogue, telling-not-showing) that are invisible from summaries alone.
        """
        result = await self.db.execute(
            select(Scene).where(Scene.story_id == story_id, Scene.act == act).order_by(Scene.n)
        )
        scenes = result.scalars().all()
        if not scenes:
            return []
        scene_ids = [s.id for s in scenes]
        draft_r = await self.db.execute(
            select(DraftContent).where(DraftContent.scene_id.in_(scene_ids))
        )
        drafts_by_scene = {d.scene_id: d.content for d in draft_r.scalars().all()}
        return [
            SceneContext(
                n=s.n, title=s.title, pov=s.pov, tension=s.tension,
                act=s.act, location=s.location, tag=s.tag, summary=s.summary,
                prose=drafts_by_scene.get(s.id),
            )
            for s in scenes
        ]
