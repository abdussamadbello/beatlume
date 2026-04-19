# BeatLume Backend CRUD API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all REST CRUD endpoints for story data: stories, scenes, characters, graph (nodes/edges), insights, draft content, core config, manuscript chapters, and collaboration (collaborators, comments, activity). Every endpoint is auth-protected and org-scoped via RLS.

**Architecture:** Each domain gets a Pydantic schema module, a service module, and an API router module. All routers are nested under `/api/stories/{story_id}/` (except stories themselves at `/api/stories/`). Services work directly with SQLAlchemy async sessions. The `get_current_org` dependency sets RLS context per-request.

**Tech Stack:** FastAPI, SQLAlchemy 2 async, Pydantic v2, PostgreSQL 16

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `backend/app/schemas/story.py` | StoryCreate, StoryRead, StoryUpdate |
| `backend/app/schemas/scene.py` | SceneCreate, SceneRead, SceneUpdate |
| `backend/app/schemas/character.py` | CharacterCreate, CharacterRead, CharacterUpdate |
| `backend/app/schemas/graph.py` | NodeRead, NodeUpdate, EdgeCreate, EdgeRead, EdgeUpdate, GraphResponse |
| `backend/app/schemas/insight.py` | InsightRead |
| `backend/app/schemas/draft.py` | DraftRead, DraftUpdate |
| `backend/app/schemas/core.py` | CoreNodeRead, CoreNodeUpdate, CoreSettingRead, CoreSettingUpdate |
| `backend/app/schemas/manuscript.py` | ChapterRead, ChapterUpdate |
| `backend/app/schemas/collaboration.py` | CollaboratorRead, InviteRequest, CommentCreate, CommentRead, ActivityRead |
| `backend/app/schemas/common.py` | PaginatedResponse generic |
| `backend/app/services/story.py` | Story CRUD |
| `backend/app/services/scene.py` | Scene CRUD with reordering |
| `backend/app/services/character.py` | Character CRUD |
| `backend/app/services/graph.py` | Graph node/edge CRUD |
| `backend/app/services/insight.py` | Insight list/dismiss |
| `backend/app/services/draft.py` | Draft content read/write |
| `backend/app/services/collaboration.py` | Collaborators, comments, activity |
| `backend/app/api/stories.py` | /api/stories/* |
| `backend/app/api/scenes.py` | /api/stories/{story_id}/scenes/* |
| `backend/app/api/characters.py` | /api/stories/{story_id}/characters/* |
| `backend/app/api/graph.py` | /api/stories/{story_id}/graph/* |
| `backend/app/api/insights.py` | /api/stories/{story_id}/insights/* |
| `backend/app/api/draft.py` | /api/stories/{story_id}/draft/* |
| `backend/app/api/core.py` | /api/stories/{story_id}/core/* |
| `backend/app/api/manuscript.py` | /api/stories/{story_id}/manuscript/* |
| `backend/app/api/collaboration.py` | /api/stories/{story_id}/collaboration/* |
| `backend/tests/test_stories.py` | Story CRUD tests |
| `backend/tests/test_scenes.py` | Scene CRUD tests |

### Modified Files

| File | Changes |
|------|---------|
| `backend/app/schemas/__init__.py` | Add new schema imports |
| `backend/app/api/router.py` | Include all new routers |
| `backend/app/deps.py` | Add `get_story` dependency |

---

### Task 1: Common Schema + Story Schemas + Story Service + Story Router

**Files:**
- Create: `backend/app/schemas/common.py`
- Create: `backend/app/schemas/story.py`
- Create: `backend/app/services/story.py`
- Create: `backend/app/api/stories.py`
- Modify: `backend/app/api/router.py`
- Modify: `backend/app/deps.py`

- [ ] **Step 1: Create common paginated response**

Create `backend/app/schemas/common.py`:

```python
from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
```

- [ ] **Step 2: Create story schemas**

Create `backend/app/schemas/story.py`:

```python
import uuid
from pydantic import BaseModel


class StoryCreate(BaseModel):
    title: str
    genres: list[str] = []
    target_words: int = 80000
    structure_type: str = "3-act"


class StoryRead(BaseModel):
    id: uuid.UUID
    title: str
    genres: list[str]
    target_words: int
    draft_number: int
    status: str
    structure_type: str

    model_config = {"from_attributes": True}


class StoryUpdate(BaseModel):
    title: str | None = None
    genres: list[str] | None = None
    target_words: int | None = None
    draft_number: int | None = None
    status: str | None = None
    structure_type: str | None = None
```

- [ ] **Step 3: Create story service**

Create `backend/app/services/story.py`:

```python
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.story import Story


async def list_stories(db: AsyncSession, org_id: uuid.UUID) -> tuple[list[Story], int]:
    result = await db.execute(select(Story).where(Story.org_id == org_id))
    stories = result.scalars().all()
    count_result = await db.execute(select(func.count()).select_from(Story).where(Story.org_id == org_id))
    total = count_result.scalar()
    return list(stories), total


async def get_story(db: AsyncSession, story_id: uuid.UUID) -> Story | None:
    result = await db.execute(select(Story).where(Story.id == story_id))
    return result.scalar_one_or_none()


async def create_story(db: AsyncSession, org_id: uuid.UUID, title: str, genres: list[str], target_words: int, structure_type: str) -> Story:
    story = Story(
        org_id=org_id,
        title=title,
        genres=genres,
        target_words=target_words,
        structure_type=structure_type,
    )
    db.add(story)
    await db.commit()
    await db.refresh(story)
    return story


async def update_story(db: AsyncSession, story: Story, patch: dict) -> Story:
    for key, value in patch.items():
        if value is not None:
            setattr(story, key, value)
    await db.commit()
    await db.refresh(story)
    return story


async def delete_story(db: AsyncSession, story: Story) -> None:
    await db.delete(story)
    await db.commit()
```

- [ ] **Step 4: Add get_story dependency to deps.py**

Add to `backend/app/deps.py`:

```python
from app.models.story import Story as StoryModel

async def get_story(
    story_id: uuid.UUID,
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> StoryModel:
    """Resolve story by ID within the current org. 404 if not found."""
    result = await db.execute(
        select(StoryModel).where(StoryModel.id == story_id, StoryModel.org_id == org.id)
    )
    story = result.scalar_one_or_none()
    if story is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")
    return story
```

- [ ] **Step 5: Create stories router**

Create `backend/app/api/stories.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_org, get_db, get_story
from app.models.user import Organization
from app.models.story import Story
from app.schemas.story import StoryCreate, StoryRead, StoryUpdate
from app.schemas.common import PaginatedResponse
from app.services import story as story_service

router = APIRouter(prefix="/api/stories", tags=["stories"])


@router.get("", response_model=PaginatedResponse[StoryRead])
async def list_stories(
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    stories, total = await story_service.list_stories(db, org.id)
    return PaginatedResponse(items=stories, total=total)


@router.post("", response_model=StoryRead, status_code=status.HTTP_201_CREATED)
async def create_story(
    body: StoryCreate,
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    story = await story_service.create_story(
        db, org.id, body.title, body.genres, body.target_words, body.structure_type,
    )
    return story


@router.get("/{story_id}", response_model=StoryRead)
async def get_story_detail(story: Story = Depends(get_story)):
    return story


@router.put("/{story_id}", response_model=StoryRead)
async def update_story(
    body: StoryUpdate,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    updated = await story_service.update_story(db, story, body.model_dump(exclude_unset=True))
    return updated


@router.delete("/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_story(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    await story_service.delete_story(db, story)
    return None
```

- [ ] **Step 6: Add stories router to api/router.py**

Update `backend/app/api/router.py`:

```python
from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.stories import router as stories_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(stories_router)
```

- [ ] **Step 7: Verify and commit**

```bash
cd /home/abdussamadbello/beatlume/backend
PYTHONPATH=. uv run python -c "from app.main import app; print([r.path for r in app.routes if 'stories' in getattr(r, 'path', '')])"
```

```bash
git add backend/app/schemas/common.py backend/app/schemas/story.py backend/app/services/story.py backend/app/api/stories.py backend/app/api/router.py backend/app/deps.py
git commit -m "feat: add stories CRUD API with schemas, service, and router"
```

---

### Task 2: Scene Schemas + Service + Router

**Files:**
- Create: `backend/app/schemas/scene.py`
- Create: `backend/app/services/scene.py`
- Create: `backend/app/api/scenes.py`
- Modify: `backend/app/api/router.py`

- [ ] **Step 1: Create scene schemas**

Create `backend/app/schemas/scene.py`:

```python
import uuid
from pydantic import BaseModel


class SceneCreate(BaseModel):
    title: str
    pov: str = ""
    tension: int = 5
    act: int = 1
    location: str = ""
    tag: str = ""
    summary: str | None = None


class SceneRead(BaseModel):
    id: uuid.UUID
    story_id: uuid.UUID
    n: int
    title: str
    pov: str
    tension: int
    act: int
    location: str
    tag: str
    summary: str | None = None

    model_config = {"from_attributes": True}


class SceneUpdate(BaseModel):
    title: str | None = None
    pov: str | None = None
    tension: int | None = None
    act: int | None = None
    location: str | None = None
    tag: str | None = None
    summary: str | None = None
```

- [ ] **Step 2: Create scene service**

Create `backend/app/services/scene.py`:

```python
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scene import Scene


async def list_scenes(
    db: AsyncSession,
    story_id: uuid.UUID,
    act: int | None = None,
    pov: str | None = None,
    sort: str | None = None,
) -> tuple[list[Scene], int]:
    query = select(Scene).where(Scene.story_id == story_id)
    count_query = select(func.count()).select_from(Scene).where(Scene.story_id == story_id)

    if act is not None:
        query = query.where(Scene.act == act)
        count_query = count_query.where(Scene.act == act)
    if pov:
        query = query.where(Scene.pov == pov)
        count_query = count_query.where(Scene.pov == pov)

    if sort == "tension":
        query = query.order_by(Scene.tension.desc())
    elif sort == "pov":
        query = query.order_by(Scene.pov, Scene.n)
    else:
        query = query.order_by(Scene.n)

    result = await db.execute(query)
    scenes = list(result.scalars().all())
    total = (await db.execute(count_query)).scalar()
    return scenes, total


async def get_scene(db: AsyncSession, story_id: uuid.UUID, scene_id: uuid.UUID) -> Scene | None:
    result = await db.execute(
        select(Scene).where(Scene.id == scene_id, Scene.story_id == story_id)
    )
    return result.scalar_one_or_none()


async def create_scene(db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, data: dict) -> Scene:
    # Auto-assign next scene number
    max_n = await db.execute(
        select(func.max(Scene.n)).where(Scene.story_id == story_id)
    )
    next_n = (max_n.scalar() or 0) + 1

    scene = Scene(story_id=story_id, org_id=org_id, n=next_n, **data)
    db.add(scene)
    await db.commit()
    await db.refresh(scene)
    return scene


async def update_scene(db: AsyncSession, scene: Scene, patch: dict) -> Scene:
    for key, value in patch.items():
        if value is not None:
            setattr(scene, key, value)
    await db.commit()
    await db.refresh(scene)
    return scene


async def delete_scene(db: AsyncSession, scene: Scene) -> None:
    await db.delete(scene)
    await db.commit()
```

- [ ] **Step 3: Create scenes router**

Create `backend/app/api/scenes.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_org, get_db, get_story
from app.models.story import Story
from app.models.user import Organization
from app.schemas.scene import SceneCreate, SceneRead, SceneUpdate
from app.schemas.common import PaginatedResponse
from app.services import scene as scene_service

router = APIRouter(prefix="/api/stories/{story_id}/scenes", tags=["scenes"])


@router.get("", response_model=PaginatedResponse[SceneRead])
async def list_scenes(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
    act: int | None = Query(None),
    pov: str | None = Query(None),
    sort: str | None = Query(None),
):
    scenes, total = await scene_service.list_scenes(db, story.id, act=act, pov=pov, sort=sort)
    return PaginatedResponse(items=scenes, total=total)


@router.post("", response_model=SceneRead, status_code=status.HTTP_201_CREATED)
async def create_scene(
    body: SceneCreate,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    scene = await scene_service.create_scene(db, story.id, org.id, body.model_dump())
    return scene


@router.get("/{scene_id}", response_model=SceneRead)
async def get_scene(
    scene_id: uuid.UUID,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    scene = await scene_service.get_scene(db, story.id, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene


@router.put("/{scene_id}", response_model=SceneRead)
async def update_scene(
    scene_id: uuid.UUID,
    body: SceneUpdate,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    scene = await scene_service.get_scene(db, story.id, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    updated = await scene_service.update_scene(db, scene, body.model_dump(exclude_unset=True))
    return updated


@router.delete("/{scene_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scene(
    scene_id: uuid.UUID,
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
):
    scene = await scene_service.get_scene(db, story.id, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    await scene_service.delete_scene(db, scene)
    return None
```

- [ ] **Step 4: Add to router.py and commit**

Add `from app.api.scenes import router as scenes_router` and `api_router.include_router(scenes_router)` to `backend/app/api/router.py`.

```bash
git add backend/app/schemas/scene.py backend/app/services/scene.py backend/app/api/scenes.py backend/app/api/router.py
git commit -m "feat: add scenes CRUD API"
```

---

### Task 3: Character Schemas + Service + Router

**Files:**
- Create: `backend/app/schemas/character.py`
- Create: `backend/app/services/character.py`
- Create: `backend/app/api/characters.py`
- Modify: `backend/app/api/router.py`

- [ ] **Step 1: Create character schemas**

Create `backend/app/schemas/character.py`:

```python
import uuid
from pydantic import BaseModel


class CharacterCreate(BaseModel):
    name: str
    role: str = ""
    desire: str = ""
    flaw: str = ""


class CharacterRead(BaseModel):
    id: uuid.UUID
    story_id: uuid.UUID
    name: str
    role: str
    desire: str
    flaw: str
    scene_count: int
    longest_gap: int

    model_config = {"from_attributes": True}


class CharacterUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    desire: str | None = None
    flaw: str | None = None
    scene_count: int | None = None
    longest_gap: int | None = None
```

- [ ] **Step 2: Create character service**

Create `backend/app/services/character.py`:

```python
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.character import Character


async def list_characters(db: AsyncSession, story_id: uuid.UUID) -> tuple[list[Character], int]:
    result = await db.execute(select(Character).where(Character.story_id == story_id))
    chars = list(result.scalars().all())
    count = (await db.execute(select(func.count()).select_from(Character).where(Character.story_id == story_id))).scalar()
    return chars, count


async def get_character(db: AsyncSession, story_id: uuid.UUID, char_id: uuid.UUID) -> Character | None:
    result = await db.execute(select(Character).where(Character.id == char_id, Character.story_id == story_id))
    return result.scalar_one_or_none()


async def create_character(db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, data: dict) -> Character:
    char = Character(story_id=story_id, org_id=org_id, **data)
    db.add(char)
    await db.commit()
    await db.refresh(char)
    return char


async def update_character(db: AsyncSession, char: Character, patch: dict) -> Character:
    for key, value in patch.items():
        if value is not None:
            setattr(char, key, value)
    await db.commit()
    await db.refresh(char)
    return char


async def delete_character(db: AsyncSession, char: Character) -> None:
    await db.delete(char)
    await db.commit()
```

- [ ] **Step 3: Create characters router**

Create `backend/app/api/characters.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_org, get_db, get_story
from app.models.story import Story
from app.models.user import Organization
from app.schemas.character import CharacterCreate, CharacterRead, CharacterUpdate
from app.schemas.common import PaginatedResponse
from app.services import character as character_service

router = APIRouter(prefix="/api/stories/{story_id}/characters", tags=["characters"])


@router.get("", response_model=PaginatedResponse[CharacterRead])
async def list_characters(story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    chars, total = await character_service.list_characters(db, story.id)
    return PaginatedResponse(items=chars, total=total)


@router.post("", response_model=CharacterRead, status_code=status.HTTP_201_CREATED)
async def create_character(
    body: CharacterCreate,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    char = await character_service.create_character(db, story.id, org.id, body.model_dump())
    return char


@router.get("/{character_id}", response_model=CharacterRead)
async def get_character(character_id: uuid.UUID, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    char = await character_service.get_character(db, story.id, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    return char


@router.put("/{character_id}", response_model=CharacterRead)
async def update_character(character_id: uuid.UUID, body: CharacterUpdate, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    char = await character_service.get_character(db, story.id, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    return await character_service.update_character(db, char, body.model_dump(exclude_unset=True))


@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_character(character_id: uuid.UUID, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    char = await character_service.get_character(db, story.id, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    await character_service.delete_character(db, char)
    return None
```

- [ ] **Step 4: Add to router.py and commit**

```bash
git add backend/app/schemas/character.py backend/app/services/character.py backend/app/api/characters.py backend/app/api/router.py
git commit -m "feat: add characters CRUD API"
```

---

### Task 4: Graph, Insight, Draft, Core, Manuscript, Collaboration — Schemas + Services + Routers

**Files:**
- Create: All remaining schema, service, and router files listed in File Structure
- Modify: `backend/app/api/router.py`
- Modify: `backend/app/schemas/__init__.py`

This task creates the remaining 6 domain APIs. Each follows the same pattern as stories/scenes/characters.

- [ ] **Step 1: Create graph schemas and service**

Create `backend/app/schemas/graph.py`:

```python
import uuid
from pydantic import BaseModel


class NodeRead(BaseModel):
    id: uuid.UUID
    character_id: uuid.UUID
    x: float
    y: float
    label: str
    initials: str
    node_type: str | None = None
    first_appearance_scene: int

    model_config = {"from_attributes": True}


class NodeUpdate(BaseModel):
    x: float | None = None
    y: float | None = None


class EdgeCreate(BaseModel):
    source_node_id: uuid.UUID
    target_node_id: uuid.UUID
    kind: str
    weight: float = 0.5


class EdgeRead(BaseModel):
    id: uuid.UUID
    source_node_id: uuid.UUID
    target_node_id: uuid.UUID
    kind: str
    weight: float
    provenance: str
    evidence: list = []
    first_evidenced_scene: int

    model_config = {"from_attributes": True}


class EdgeUpdate(BaseModel):
    kind: str | None = None
    weight: float | None = None


class GraphResponse(BaseModel):
    nodes: list[NodeRead]
    edges: list[EdgeRead]
```

Create `backend/app/services/graph.py`:

```python
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.graph import CharacterEdge, CharacterNode


async def get_graph(db: AsyncSession, story_id: uuid.UUID) -> tuple[list[CharacterNode], list[CharacterEdge]]:
    nodes = (await db.execute(select(CharacterNode).where(CharacterNode.story_id == story_id))).scalars().all()
    edges = (await db.execute(select(CharacterEdge).where(CharacterEdge.story_id == story_id))).scalars().all()
    return list(nodes), list(edges)


async def update_node(db: AsyncSession, story_id: uuid.UUID, node_id: uuid.UUID, patch: dict) -> CharacterNode | None:
    result = await db.execute(select(CharacterNode).where(CharacterNode.id == node_id, CharacterNode.story_id == story_id))
    node = result.scalar_one_or_none()
    if not node:
        return None
    for k, v in patch.items():
        if v is not None:
            setattr(node, k, v)
    await db.commit()
    await db.refresh(node)
    return node


async def create_edge(db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, data: dict) -> CharacterEdge:
    edge = CharacterEdge(story_id=story_id, org_id=org_id, **data)
    db.add(edge)
    await db.commit()
    await db.refresh(edge)
    return edge


async def update_edge(db: AsyncSession, story_id: uuid.UUID, edge_id: uuid.UUID, patch: dict) -> CharacterEdge | None:
    result = await db.execute(select(CharacterEdge).where(CharacterEdge.id == edge_id, CharacterEdge.story_id == story_id))
    edge = result.scalar_one_or_none()
    if not edge:
        return None
    for k, v in patch.items():
        if v is not None:
            setattr(edge, k, v)
    await db.commit()
    await db.refresh(edge)
    return edge


async def delete_edge(db: AsyncSession, story_id: uuid.UUID, edge_id: uuid.UUID) -> bool:
    result = await db.execute(select(CharacterEdge).where(CharacterEdge.id == edge_id, CharacterEdge.story_id == story_id))
    edge = result.scalar_one_or_none()
    if not edge:
        return False
    await db.delete(edge)
    await db.commit()
    return True
```

- [ ] **Step 2: Create insight schemas and service**

Create `backend/app/schemas/insight.py`:

```python
import uuid
from pydantic import BaseModel


class InsightRead(BaseModel):
    id: uuid.UUID
    severity: str
    category: str
    title: str
    body: str
    refs: list[str]
    dismissed: bool

    model_config = {"from_attributes": True}
```

Create `backend/app/services/insight.py`:

```python
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.insight import Insight


async def list_insights(
    db: AsyncSession, story_id: uuid.UUID, category: str | None = None, severity: str | None = None
) -> tuple[list[Insight], int]:
    query = select(Insight).where(Insight.story_id == story_id, Insight.dismissed == False)
    count_q = select(func.count()).select_from(Insight).where(Insight.story_id == story_id, Insight.dismissed == False)
    if category:
        query = query.where(Insight.category == category)
        count_q = count_q.where(Insight.category == category)
    if severity:
        query = query.where(Insight.severity == severity)
        count_q = count_q.where(Insight.severity == severity)
    result = await db.execute(query)
    total = (await db.execute(count_q)).scalar()
    return list(result.scalars().all()), total


async def dismiss_insight(db: AsyncSession, story_id: uuid.UUID, insight_id: uuid.UUID) -> bool:
    result = await db.execute(select(Insight).where(Insight.id == insight_id, Insight.story_id == story_id))
    insight = result.scalar_one_or_none()
    if not insight:
        return False
    insight.dismissed = True
    await db.commit()
    return True
```

- [ ] **Step 3: Create draft schemas and service**

Create `backend/app/schemas/draft.py`:

```python
import uuid
from pydantic import BaseModel


class DraftRead(BaseModel):
    id: uuid.UUID
    scene_id: uuid.UUID
    content: str
    word_count: int

    model_config = {"from_attributes": True}


class DraftUpdate(BaseModel):
    content: str
```

Create `backend/app/services/draft.py`:

```python
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.draft import DraftContent


async def get_draft(db: AsyncSession, story_id: uuid.UUID, scene_id: uuid.UUID) -> DraftContent | None:
    result = await db.execute(
        select(DraftContent).where(DraftContent.story_id == story_id, DraftContent.scene_id == scene_id)
    )
    return result.scalar_one_or_none()


async def upsert_draft(db: AsyncSession, story_id: uuid.UUID, scene_id: uuid.UUID, org_id: uuid.UUID, content: str) -> DraftContent:
    result = await db.execute(
        select(DraftContent).where(DraftContent.story_id == story_id, DraftContent.scene_id == scene_id)
    )
    draft = result.scalar_one_or_none()
    if draft:
        draft.content = content
        draft.word_count = len(content.split())
    else:
        draft = DraftContent(
            story_id=story_id,
            scene_id=scene_id,
            org_id=org_id,
            content=content,
            word_count=len(content.split()),
        )
        db.add(draft)
    await db.commit()
    await db.refresh(draft)
    return draft
```

- [ ] **Step 4: Create core schemas and service**

Create `backend/app/schemas/core.py`:

```python
import uuid
from pydantic import BaseModel


class CoreNodeRead(BaseModel):
    id: uuid.UUID
    depth: int
    label: str
    kind: str
    active: bool
    sort_order: int

    model_config = {"from_attributes": True}


class CoreNodeUpdate(BaseModel):
    active: bool | None = None
    label: str | None = None


class CoreSettingRead(BaseModel):
    id: uuid.UUID
    key: str
    value: str
    source: str
    tag: str | None = None

    model_config = {"from_attributes": True}


class CoreSettingUpdate(BaseModel):
    value: str
```

- [ ] **Step 5: Create manuscript schemas**

Create `backend/app/schemas/manuscript.py`:

```python
import uuid
from pydantic import BaseModel


class ChapterRead(BaseModel):
    id: uuid.UUID
    num: int
    title: str
    content: str
    sort_order: int

    model_config = {"from_attributes": True}


class ChapterUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
```

- [ ] **Step 6: Create collaboration schemas**

Create `backend/app/schemas/collaboration.py`:

```python
import uuid
from datetime import datetime
from pydantic import BaseModel


class CollaboratorRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    role: str
    invited_at: datetime
    accepted_at: datetime | None = None

    model_config = {"from_attributes": True}


class InviteRequest(BaseModel):
    email: str
    role: str = "reader"


class CommentCreate(BaseModel):
    body: str
    scene_id: uuid.UUID | None = None


class CommentRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    scene_id: uuid.UUID | None = None
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    action: str
    detail: dict
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 7: Create collaboration service**

Create `backend/app/services/collaboration.py`:

```python
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collaboration import ActivityEvent, Collaborator, Comment


async def list_collaborators(db: AsyncSession, story_id: uuid.UUID) -> list[Collaborator]:
    result = await db.execute(select(Collaborator).where(Collaborator.story_id == story_id))
    return list(result.scalars().all())


async def list_comments(db: AsyncSession, story_id: uuid.UUID, scene_id: uuid.UUID | None = None) -> list[Comment]:
    query = select(Comment).where(Comment.story_id == story_id).order_by(Comment.created_at.desc())
    if scene_id:
        query = query.where(Comment.scene_id == scene_id)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_comment(
    db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, user_id: uuid.UUID, body: str, scene_id: uuid.UUID | None = None
) -> Comment:
    comment = Comment(story_id=story_id, org_id=org_id, user_id=user_id, body=body, scene_id=scene_id)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


async def list_activity(db: AsyncSession, story_id: uuid.UUID) -> list[ActivityEvent]:
    result = await db.execute(
        select(ActivityEvent).where(ActivityEvent.story_id == story_id).order_by(ActivityEvent.created_at.desc()).limit(50)
    )
    return list(result.scalars().all())


async def log_activity(
    db: AsyncSession, story_id: uuid.UUID, org_id: uuid.UUID, user_id: uuid.UUID, action: str, detail: dict
) -> ActivityEvent:
    event = ActivityEvent(story_id=story_id, org_id=org_id, user_id=user_id, action=action, detail=detail)
    db.add(event)
    await db.commit()
    return event
```

- [ ] **Step 8: Create remaining routers (graph, insights, draft, core, manuscript, collaboration)**

Create `backend/app/api/graph.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_org, get_db, get_story
from app.models.story import Story
from app.models.user import Organization
from app.schemas.graph import EdgeCreate, EdgeRead, EdgeUpdate, GraphResponse, NodeRead, NodeUpdate
from app.services import graph as graph_service

router = APIRouter(prefix="/api/stories/{story_id}/graph", tags=["graph"])


@router.get("", response_model=GraphResponse)
async def get_graph(story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    nodes, edges = await graph_service.get_graph(db, story.id)
    return GraphResponse(nodes=nodes, edges=edges)


@router.put("/nodes/{node_id}", response_model=NodeRead)
async def update_node(node_id: uuid.UUID, body: NodeUpdate, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    node = await graph_service.update_node(db, story.id, node_id, body.model_dump(exclude_unset=True))
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.post("/edges", response_model=EdgeRead, status_code=status.HTTP_201_CREATED)
async def create_edge(body: EdgeCreate, story: Story = Depends(get_story), org: Organization = Depends(get_current_org), db: AsyncSession = Depends(get_db)):
    edge = await graph_service.create_edge(db, story.id, org.id, body.model_dump())
    return edge


@router.put("/edges/{edge_id}", response_model=EdgeRead)
async def update_edge(edge_id: uuid.UUID, body: EdgeUpdate, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    edge = await graph_service.update_edge(db, story.id, edge_id, body.model_dump(exclude_unset=True))
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    return edge


@router.delete("/edges/{edge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_edge(edge_id: uuid.UUID, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    deleted = await graph_service.delete_edge(db, story.id, edge_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Edge not found")
    return None
```

Create `backend/app/api/insights.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_story
from app.models.story import Story
from app.schemas.insight import InsightRead
from app.schemas.common import PaginatedResponse
from app.services import insight as insight_service

router = APIRouter(prefix="/api/stories/{story_id}/insights", tags=["insights"])


@router.get("", response_model=PaginatedResponse[InsightRead])
async def list_insights(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
    category: str | None = Query(None),
    severity: str | None = Query(None),
):
    insights, total = await insight_service.list_insights(db, story.id, category, severity)
    return PaginatedResponse(items=insights, total=total)


@router.put("/{insight_id}/dismiss")
async def dismiss_insight(insight_id: uuid.UUID, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    dismissed = await insight_service.dismiss_insight(db, story.id, insight_id)
    if not dismissed:
        raise HTTPException(status_code=404, detail="Insight not found")
    return {"status": "dismissed"}
```

Create `backend/app/api/draft.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_org, get_db, get_story
from app.models.story import Story
from app.models.user import Organization
from app.schemas.draft import DraftRead, DraftUpdate
from app.services import draft as draft_service

router = APIRouter(prefix="/api/stories/{story_id}/draft", tags=["draft"])


@router.get("/{scene_id}", response_model=DraftRead)
async def get_draft(scene_id: uuid.UUID, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    draft = await draft_service.get_draft(db, story.id, scene_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return draft


@router.put("/{scene_id}", response_model=DraftRead)
async def update_draft(
    scene_id: uuid.UUID,
    body: DraftUpdate,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
):
    draft = await draft_service.upsert_draft(db, story.id, scene_id, org.id, body.content)
    return draft
```

Create `backend/app/api/core.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_story
from app.models.core import CoreConfigNode, CoreSetting
from app.models.story import Story
from app.schemas.core import CoreNodeRead, CoreNodeUpdate, CoreSettingRead, CoreSettingUpdate

router = APIRouter(prefix="/api/stories/{story_id}/core", tags=["core"])


@router.get("/tree", response_model=list[CoreNodeRead])
async def get_tree(story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CoreConfigNode).where(CoreConfigNode.story_id == story.id).order_by(CoreConfigNode.sort_order)
    )
    return result.scalars().all()


@router.put("/tree/{node_id}", response_model=CoreNodeRead)
async def update_tree_node(node_id: uuid.UUID, body: CoreNodeUpdate, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CoreConfigNode).where(CoreConfigNode.id == node_id, CoreConfigNode.story_id == story.id))
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Config node not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(node, k, v)
    await db.commit()
    await db.refresh(node)
    return node


@router.get("/settings", response_model=list[CoreSettingRead])
async def get_settings(story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CoreSetting).where(CoreSetting.story_id == story.id))
    return result.scalars().all()


@router.put("/settings/{key}", response_model=CoreSettingRead)
async def update_setting(key: str, body: CoreSettingUpdate, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CoreSetting).where(CoreSetting.story_id == story.id, CoreSetting.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    setting.value = body.value
    await db.commit()
    await db.refresh(setting)
    return setting
```

Create `backend/app/api/manuscript.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_story
from app.models.manuscript import ManuscriptChapter
from app.models.story import Story
from app.schemas.manuscript import ChapterRead, ChapterUpdate

router = APIRouter(prefix="/api/stories/{story_id}/manuscript", tags=["manuscript"])


@router.get("", response_model=list[ChapterRead])
async def list_chapters(story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ManuscriptChapter).where(ManuscriptChapter.story_id == story.id).order_by(ManuscriptChapter.sort_order)
    )
    return result.scalars().all()


@router.get("/{num}", response_model=ChapterRead)
async def get_chapter(num: int, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ManuscriptChapter).where(ManuscriptChapter.story_id == story.id, ManuscriptChapter.num == num)
    )
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return chapter


@router.put("/{num}", response_model=ChapterRead)
async def update_chapter(num: int, body: ChapterUpdate, story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ManuscriptChapter).where(ManuscriptChapter.story_id == story.id, ManuscriptChapter.num == num)
    )
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(chapter, k, v)
    await db.commit()
    await db.refresh(chapter)
    return chapter
```

Create `backend/app/api/collaboration.py`:

```python
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_org, get_current_user, get_db, get_story
from app.models.story import Story
from app.models.user import Organization, User
from app.schemas.collaboration import ActivityRead, CollaboratorRead, CommentCreate, CommentRead
from app.schemas.common import PaginatedResponse
from app.services import collaboration as collab_service

router = APIRouter(prefix="/api/stories/{story_id}", tags=["collaboration"])


@router.get("/collaborators", response_model=list[CollaboratorRead])
async def list_collaborators(story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    return await collab_service.list_collaborators(db, story.id)


@router.get("/comments", response_model=list[CommentRead])
async def list_comments(
    story: Story = Depends(get_story),
    db: AsyncSession = Depends(get_db),
    scene_id: uuid.UUID | None = Query(None),
):
    return await collab_service.list_comments(db, story.id, scene_id)


@router.post("/comments", response_model=CommentRead, status_code=201)
async def create_comment(
    body: CommentCreate,
    story: Story = Depends(get_story),
    org: Organization = Depends(get_current_org),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await collab_service.create_comment(db, story.id, org.id, user.id, body.body, body.scene_id)


@router.get("/activity", response_model=list[ActivityRead])
async def list_activity(story: Story = Depends(get_story), db: AsyncSession = Depends(get_db)):
    return await collab_service.list_activity(db, story.id)
```

- [ ] **Step 9: Update router.py with all routers**

Replace `backend/app/api/router.py`:

```python
from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.stories import router as stories_router
from app.api.scenes import router as scenes_router
from app.api.characters import router as characters_router
from app.api.graph import router as graph_router
from app.api.insights import router as insights_router
from app.api.draft import router as draft_router
from app.api.core import router as core_router
from app.api.manuscript import router as manuscript_router
from app.api.collaboration import router as collaboration_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(stories_router)
api_router.include_router(scenes_router)
api_router.include_router(characters_router)
api_router.include_router(graph_router)
api_router.include_router(insights_router)
api_router.include_router(draft_router)
api_router.include_router(core_router)
api_router.include_router(manuscript_router)
api_router.include_router(collaboration_router)
```

- [ ] **Step 10: Verify all routes and commit**

```bash
PYTHONPATH=. uv run python -c "
from app.main import app
routes = sorted(set(r.path for r in app.routes if hasattr(r, 'path') and '/api' in r.path or '/auth' in r.path))
print(f'Total API routes: {len(routes)}')
for r in routes:
    print(f'  {r}')
"
```

```bash
git add backend/app/schemas/ backend/app/services/ backend/app/api/
git commit -m "feat: add all CRUD APIs (graph, insights, draft, core, manuscript, collaboration)"
```

---

### Task 5: Stories + Scenes Integration Tests

**Files:**
- Create: `backend/tests/test_stories.py`
- Create: `backend/tests/test_scenes.py`

- [ ] **Step 1: Create story tests**

Create `backend/tests/test_stories.py`:

```python
import pytest


async def get_auth_token(client) -> str:
    resp = await client.post("/auth/signup", json={
        "name": "Writer", "email": "writer@example.com", "password": "pass123",
    })
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_create_story(client):
    token = await get_auth_token(client)
    resp = await client.post(
        "/api/stories",
        json={"title": "My Novel", "genres": ["Literary", "Mystery"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "My Novel"
    assert data["genres"] == ["Literary", "Mystery"]
    assert data["status"] == "not_started"


@pytest.mark.asyncio
async def test_list_stories(client):
    token = await get_auth_token(client)
    await client.post("/api/stories", json={"title": "Story 1"}, headers={"Authorization": f"Bearer {token}"})
    await client.post("/api/stories", json={"title": "Story 2"}, headers={"Authorization": f"Bearer {token}"})
    resp = await client.get("/api/stories", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


@pytest.mark.asyncio
async def test_get_story(client):
    token = await get_auth_token(client)
    create = await client.post("/api/stories", json={"title": "My Novel"}, headers={"Authorization": f"Bearer {token}"})
    story_id = create.json()["id"]
    resp = await client.get(f"/api/stories/{story_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "My Novel"


@pytest.mark.asyncio
async def test_update_story(client):
    token = await get_auth_token(client)
    create = await client.post("/api/stories", json={"title": "Draft"}, headers={"Authorization": f"Bearer {token}"})
    story_id = create.json()["id"]
    resp = await client.put(f"/api/stories/{story_id}", json={"title": "Final"}, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Final"


@pytest.mark.asyncio
async def test_delete_story(client):
    token = await get_auth_token(client)
    create = await client.post("/api/stories", json={"title": "Doomed"}, headers={"Authorization": f"Bearer {token}"})
    story_id = create.json()["id"]
    resp = await client.delete(f"/api/stories/{story_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 204
    resp = await client.get(f"/api/stories/{story_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_stories_require_auth(client):
    resp = await client.get("/api/stories")
    assert resp.status_code == 401
```

- [ ] **Step 2: Create scene tests**

Create `backend/tests/test_scenes.py`:

```python
import pytest


async def setup_story(client) -> tuple[str, str]:
    """Create user + story, return (token, story_id)."""
    signup = await client.post("/auth/signup", json={
        "name": "Writer", "email": "scenes@example.com", "password": "pass123",
    })
    token = signup.json()["access_token"]
    story = await client.post("/api/stories", json={"title": "Test Story"}, headers={"Authorization": f"Bearer {token}"})
    return token, story.json()["id"]


@pytest.mark.asyncio
async def test_create_scene(client):
    token, story_id = await setup_story(client)
    resp = await client.post(
        f"/api/stories/{story_id}/scenes",
        json={"title": "Opening", "pov": "Iris", "tension": 3, "act": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Opening"
    assert data["n"] == 1
    assert data["pov"] == "Iris"


@pytest.mark.asyncio
async def test_scene_auto_increment_n(client):
    token, story_id = await setup_story(client)
    headers = {"Authorization": f"Bearer {token}"}
    await client.post(f"/api/stories/{story_id}/scenes", json={"title": "S1"}, headers=headers)
    resp = await client.post(f"/api/stories/{story_id}/scenes", json={"title": "S2"}, headers=headers)
    assert resp.json()["n"] == 2


@pytest.mark.asyncio
async def test_list_scenes(client):
    token, story_id = await setup_story(client)
    headers = {"Authorization": f"Bearer {token}"}
    await client.post(f"/api/stories/{story_id}/scenes", json={"title": "S1", "act": 1}, headers=headers)
    await client.post(f"/api/stories/{story_id}/scenes", json={"title": "S2", "act": 2}, headers=headers)
    resp = await client.get(f"/api/stories/{story_id}/scenes", headers=headers)
    assert resp.json()["total"] == 2


@pytest.mark.asyncio
async def test_filter_scenes_by_act(client):
    token, story_id = await setup_story(client)
    headers = {"Authorization": f"Bearer {token}"}
    await client.post(f"/api/stories/{story_id}/scenes", json={"title": "S1", "act": 1}, headers=headers)
    await client.post(f"/api/stories/{story_id}/scenes", json={"title": "S2", "act": 2}, headers=headers)
    resp = await client.get(f"/api/stories/{story_id}/scenes?act=1", headers=headers)
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_update_scene(client):
    token, story_id = await setup_story(client)
    headers = {"Authorization": f"Bearer {token}"}
    create = await client.post(f"/api/stories/{story_id}/scenes", json={"title": "Draft"}, headers=headers)
    scene_id = create.json()["id"]
    resp = await client.put(f"/api/stories/{story_id}/scenes/{scene_id}", json={"title": "Revised", "tension": 8}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "Revised"
    assert resp.json()["tension"] == 8


@pytest.mark.asyncio
async def test_delete_scene(client):
    token, story_id = await setup_story(client)
    headers = {"Authorization": f"Bearer {token}"}
    create = await client.post(f"/api/stories/{story_id}/scenes", json={"title": "Gone"}, headers=headers)
    scene_id = create.json()["id"]
    resp = await client.delete(f"/api/stories/{story_id}/scenes/{scene_id}", headers=headers)
    assert resp.status_code == 204
```

- [ ] **Step 3: Run all tests**

```bash
cd /home/abdussamadbello/beatlume/backend
PYTHONPATH=. uv run pytest tests/ -v
```

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_stories.py backend/tests/test_scenes.py
git commit -m "test: add stories and scenes CRUD integration tests"
```

---

## Verification Checklist

1. All story CRUD endpoints work (list, create, get, update, delete)
2. All scene CRUD endpoints work with filtering (act, pov, sort)
3. Scene numbers auto-increment per story
4. Characters CRUD works
5. Graph endpoints: get graph, update node position, create/update/delete edges
6. Insights: list with filters, dismiss
7. Draft: get and upsert
8. Core: tree list/update, settings list/update
9. Manuscript: chapters list/get/update
10. Collaboration: collaborators list, comments list/create, activity feed
11. All endpoints require auth (401 without token)
12. All endpoints are org-scoped (RLS enforced)
13. All tests pass
