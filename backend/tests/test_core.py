import uuid

import pytest

from app.models.core import CoreConfigNode, CoreKind, CoreSetting
from app.models.story import Story
from app.services.core import (
    populate_default_core,
    resolve_settings_for_node,
    resolved_settings_dict,
    story_settings_dict,
)


async def _auth(client) -> str:
    resp = await client.post(
        "/auth/signup",
        json={"name": "Writer", "email": "writer@example.com", "password": "pass1234"},
    )
    return resp.json()["access_token"]


async def _create_story(client, token: str) -> str:
    resp = await client.post(
        "/api/stories",
        json={"title": "Test Novel", "genres": ["Literary"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_get_settings_includes_defaults(client):
    token = await _auth(client)
    story_id = await _create_story(client, token)
    resp = await client.get(
        f"/api/stories/{story_id}/core/settings",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    keys = {s["key"] for s in resp.json()}
    assert "Title" in keys
    assert "Genre" in keys
    assert "Draft" in keys


@pytest.mark.asyncio
async def test_get_tree_includes_default_root(client):
    token = await _auth(client)
    story_id = await _create_story(client, token)
    resp = await client.get(
        f"/api/stories/{story_id}/core/tree",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    nodes = resp.json()
    assert len(nodes) >= 1
    assert any(n["kind"] == "story" and n["depth"] == 0 for n in nodes)


@pytest.mark.asyncio
async def test_create_setting(client):
    token = await _auth(client)
    story_id = await _create_story(client, token)
    resp = await client.post(
        f"/api/stories/{story_id}/core/settings",
        json={"key": "POV", "value": "Third-person limited", "source": "user"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["key"] == "POV"
    assert data["value"] == "Third-person limited"
    assert data["source"] == "user"


@pytest.mark.asyncio
async def test_create_setting_duplicate_key_409(client):
    token = await _auth(client)
    story_id = await _create_story(client, token)
    # "Title" is seeded by default
    resp = await client.post(
        f"/api/stories/{story_id}/core/settings",
        json={"key": "Title", "value": "Other"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_update_setting_accepts_ai_suggestion(client):
    token = await _auth(client)
    story_id = await _create_story(client, token)
    await client.post(
        f"/api/stories/{story_id}/core/settings",
        json={"key": "Protagonist", "value": "Iris", "source": "AI", "tag": "inferred"},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await client.put(
        f"/api/stories/{story_id}/core/settings/Protagonist",
        json={"value": "Iris", "source": "user", "tag": None},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "user"
    assert data["tag"] is None


@pytest.mark.asyncio
async def test_update_setting_value_only(client):
    token = await _auth(client)
    story_id = await _create_story(client, token)
    resp = await client.put(
        f"/api/stories/{story_id}/core/settings/Title",
        json={"value": "New Title"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["value"] == "New Title"


@pytest.mark.asyncio
async def test_delete_user_setting(client):
    token = await _auth(client)
    story_id = await _create_story(client, token)
    await client.post(
        f"/api/stories/{story_id}/core/settings",
        json={"key": "Tense", "value": "Past", "source": "user"},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await client.delete(
        f"/api/stories/{story_id}/core/settings/Tense",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 204
    follow = await client.get(
        f"/api/stories/{story_id}/core/settings",
        headers={"Authorization": f"Bearer {token}"},
    )
    keys = {s["key"] for s in follow.json()}
    assert "Tense" not in keys


@pytest.mark.asyncio
async def test_delete_system_setting_409(client):
    token = await _auth(client)
    story_id = await _create_story(client, token)
    # "Draft" is seeded with source=system
    resp = await client.delete(
        f"/api/stories/{story_id}/core/settings/Draft",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_delete_missing_setting_404(client):
    token = await _auth(client)
    story_id = await _create_story(client, token)
    resp = await client.delete(
        f"/api/stories/{story_id}/core/settings/NonExistent",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_core_settings_require_auth(client):
    token = await _auth(client)
    story_id = await _create_story(client, token)
    resp = await client.get(f"/api/stories/{story_id}/core/settings")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_story_settings_dict_empty(db_session):
    missing = uuid.uuid4()
    result = await story_settings_dict(db_session, missing)
    assert result == {}


@pytest.mark.asyncio
async def test_story_settings_dict_after_defaults(db_session):
    from app.models.user import Organization

    org = Organization(id=uuid.uuid4(), name="Test Org", slug="test-org")
    db_session.add(org)
    await db_session.flush()

    story = Story(
        id=uuid.uuid4(),
        org_id=org.id,
        title="Test Novel",
        genres=["Literary"],
        target_words=80000,
        structure_type="3-act",
    )
    db_session.add(story)
    await db_session.flush()

    await populate_default_core(db_session, story)
    await db_session.flush()

    result = await story_settings_dict(db_session, story.id)
    assert result["Title"] == "Test Novel"
    assert result["Genre"] == "Literary"
    assert result["Act structure"] == "3-act"


# ---------------------------------------------------------------------------
# Per-node resolution
# ---------------------------------------------------------------------------


async def _build_story_with_tree(db_session):
    from app.models.user import Organization

    org = Organization(id=uuid.uuid4(), name="Resolve Org", slug=f"org-{uuid.uuid4().hex[:8]}")
    db_session.add(org)
    await db_session.flush()

    story = Story(
        id=uuid.uuid4(),
        org_id=org.id,
        title="Resolve Test",
        genres=["Literary"],
        target_words=80000,
        structure_type="3-act",
    )
    db_session.add(story)
    await db_session.flush()
    await populate_default_core(db_session, story)
    await db_session.flush()

    # Build tree: Story (depth 0) -> Part One (depth 1) -> Ch 2 (depth 2) -> S03 (depth 3)
    root = (
        await db_session.execute(
            CoreConfigNode.__table__.select().where(CoreConfigNode.story_id == story.id)
        )
    ).one()
    root_id = root.id

    part = CoreConfigNode(
        id=uuid.uuid4(), org_id=org.id, story_id=story.id,
        parent_id=root_id, depth=1, label="Part One", kind=CoreKind.part,
        active=False, sort_order=1,
    )
    db_session.add(part)
    await db_session.flush()

    chap = CoreConfigNode(
        id=uuid.uuid4(), org_id=org.id, story_id=story.id,
        parent_id=part.id, depth=2, label="Ch 2 — Wren", kind=CoreKind.chap,
        active=False, sort_order=2,
    )
    db_session.add(chap)
    await db_session.flush()

    scene = CoreConfigNode(
        id=uuid.uuid4(), org_id=org.id, story_id=story.id,
        parent_id=chap.id, depth=3, label="S03 — Wren returns uninvited", kind=CoreKind.scene,
        active=False, sort_order=3,
    )
    db_session.add(scene)
    await db_session.flush()

    return org, story, {"root": root_id, "part": part.id, "chap": chap.id, "scene": scene.id}


@pytest.mark.asyncio
async def test_resolver_inherits_story_root(db_session):
    _, story, nodes = await _build_story_with_tree(db_session)
    resolved = await resolve_settings_for_node(db_session, story.id, nodes["scene"])
    by_key = {r.key: r for r in resolved}
    assert by_key["Title"].value == "Resolve Test"
    assert by_key["Title"].defined_at_node_id is None
    assert by_key["Title"].is_override is False


@pytest.mark.asyncio
async def test_resolver_nearest_ancestor_wins(db_session):
    _, story, nodes = await _build_story_with_tree(db_session)
    # Override Title at chapter level; it should beat the story-root default.
    db_session.add(
        CoreSetting(
            id=uuid.uuid4(), org_id=story.org_id, story_id=story.id,
            config_node_id=nodes["chap"], key="Title", value="Chapter Title",
            source="user", tag=None,
        )
    )
    await db_session.flush()

    resolved = await resolve_settings_for_node(db_session, story.id, nodes["scene"])
    by_key = {r.key: r for r in resolved}
    assert by_key["Title"].value == "Chapter Title"
    assert by_key["Title"].defined_at_node_id == nodes["chap"]
    # On the scene node, the chapter override is inherited (not an override on the scene itself)
    assert by_key["Title"].is_override is False


@pytest.mark.asyncio
async def test_resolver_scene_override_beats_chapter(db_session):
    _, story, nodes = await _build_story_with_tree(db_session)
    db_session.add(
        CoreSetting(
            id=uuid.uuid4(), org_id=story.org_id, story_id=story.id,
            config_node_id=nodes["chap"], key="Title", value="Chapter Title",
            source="user", tag=None,
        )
    )
    db_session.add(
        CoreSetting(
            id=uuid.uuid4(), org_id=story.org_id, story_id=story.id,
            config_node_id=nodes["scene"], key="Title", value="Scene Title",
            source="user", tag=None,
        )
    )
    await db_session.flush()

    resolved = await resolve_settings_for_node(db_session, story.id, nodes["scene"])
    by_key = {r.key: r for r in resolved}
    assert by_key["Title"].value == "Scene Title"
    assert by_key["Title"].defined_at_node_id == nodes["scene"]
    assert by_key["Title"].is_override is True


@pytest.mark.asyncio
async def test_resolver_chain_does_not_leak_into_siblings(db_session):
    _, story, nodes = await _build_story_with_tree(db_session)
    # Add a sibling chapter under the same part; give it its own override.
    sibling_chap = CoreConfigNode(
        id=uuid.uuid4(), org_id=story.org_id, story_id=story.id,
        parent_id=nodes["part"], depth=2, label="Ch 3 — Sibling", kind=CoreKind.chap,
        active=False, sort_order=10,
    )
    db_session.add(sibling_chap)
    await db_session.flush()
    db_session.add(
        CoreSetting(
            id=uuid.uuid4(), org_id=story.org_id, story_id=story.id,
            config_node_id=sibling_chap.id, key="Title", value="Sibling Title",
            source="user", tag=None,
        )
    )
    await db_session.flush()

    # Resolving for the original scene must NOT pick up the sibling chapter's override.
    resolved = await resolve_settings_for_node(db_session, story.id, nodes["scene"])
    by_key = {r.key: r for r in resolved}
    assert by_key["Title"].value == "Resolve Test"
    assert by_key["Title"].defined_at_node_id is None


@pytest.mark.asyncio
async def test_resolver_for_root_returns_story_defaults(db_session):
    _, story, _ = await _build_story_with_tree(db_session)
    resolved = await resolve_settings_for_node(db_session, story.id, None)
    by_key = {r.key: r for r in resolved}
    assert by_key["Title"].value == "Resolve Test"
    assert by_key["Title"].defined_at_node_id is None


@pytest.mark.asyncio
async def test_resolved_settings_dict_flattens(db_session):
    _, story, nodes = await _build_story_with_tree(db_session)
    db_session.add(
        CoreSetting(
            id=uuid.uuid4(), org_id=story.org_id, story_id=story.id,
            config_node_id=nodes["scene"], key="POV", value="First-person",
            source="user", tag=None,
        )
    )
    await db_session.flush()

    flat = await resolved_settings_dict(db_session, story.id, nodes["scene"])
    assert flat["POV"] == "First-person"
    assert flat["Title"] == "Resolve Test"


# ---------------------------------------------------------------------------
# API: per-node create / update / delete / resolution
# ---------------------------------------------------------------------------


async def _first_scene_node_id(client, token: str, story_id: str) -> str:
    """Create a minimal node tree via direct insertion is complex from the API
    alone (the tree endpoints only update existing nodes). Instead, we hit the
    raw settings endpoint to verify node-scoped operations work when a node
    id is supplied by the caller. For end-to-end node-scoped tests we add a
    node by mutating the default tree: the seed creates only the story root,
    so we append a child node via the tree test endpoint."""
    # Fetch the existing tree (just the root after create_story)
    resp = await client.get(
        f"/api/stories/{story_id}/core/tree",
        headers={"Authorization": f"Bearer {token}"},
    )
    nodes = resp.json()
    return nodes[0]["id"]


@pytest.mark.asyncio
async def test_get_settings_with_node_id_unknown_404(client):
    token = await _auth(client)
    story_id = await _create_story(client, token)
    fake_node = str(uuid.uuid4())
    resp = await client.get(
        f"/api/stories/{story_id}/core/settings?node_id={fake_node}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_and_get_resolved_for_root(client):
    token = await _auth(client)
    story_id = await _create_story(client, token)
    root_id = await _first_scene_node_id(client, token, story_id)

    # Requesting resolved settings with node_id=root should still resolve
    # from the story-root NULL bucket (root has no parent and no rows of its own).
    resp = await client.get(
        f"/api/stories/{story_id}/core/settings?node_id={root_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    title = next(r for r in data if r["key"] == "Title")
    assert title["defined_at_node_id"] is None
    assert title["defined_at_label"] == "Story"
    assert title["is_override"] is False


@pytest.mark.asyncio
async def test_node_scoped_create_duplicate_key_409(client, db_session):
    """Two rows for the same key at the same node violate uniqueness."""
    token = await _auth(client)
    story_id = await _create_story(client, token)

    # Add a fresh chapter node directly in DB so we have a node to target.
    from app.models.core import CoreConfigNode as CCNode, CoreKind as CK
    chap = CCNode(
        id=uuid.uuid4(),
        org_id=(await db_session.execute(
            Story.__table__.select().where(Story.id == uuid.UUID(story_id))
        )).one().org_id,
        story_id=uuid.UUID(story_id),
        parent_id=None,
        depth=1, label="Ch 1", kind=CK.chap, active=False, sort_order=50,
    )
    db_session.add(chap)
    await db_session.flush()
    await db_session.commit()

    a = await client.post(
        f"/api/stories/{story_id}/core/settings",
        json={"key": "POV", "value": "First-person", "config_node_id": str(chap.id)},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert a.status_code == 201

    b = await client.post(
        f"/api/stories/{story_id}/core/settings",
        json={"key": "POV", "value": "Third-person", "config_node_id": str(chap.id)},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert b.status_code == 409


@pytest.mark.asyncio
async def test_node_scoped_update_and_delete(client, db_session):
    token = await _auth(client)
    story_id = await _create_story(client, token)

    from app.models.core import CoreConfigNode as CCNode, CoreKind as CK
    chap = CCNode(
        id=uuid.uuid4(),
        org_id=(await db_session.execute(
            Story.__table__.select().where(Story.id == uuid.UUID(story_id))
        )).one().org_id,
        story_id=uuid.UUID(story_id),
        parent_id=None,
        depth=1, label="Ch 9", kind=CK.chap, active=False, sort_order=90,
    )
    db_session.add(chap)
    await db_session.flush()
    await db_session.commit()

    # Create node-scoped override
    await client.post(
        f"/api/stories/{story_id}/core/settings",
        json={"key": "Tense", "value": "Present", "config_node_id": str(chap.id)},
        headers={"Authorization": f"Bearer {token}"},
    )

    # Resolve for the chapter should now pick up the override
    resp = await client.get(
        f"/api/stories/{story_id}/core/settings?node_id={chap.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    tense = next(r for r in resp.json() if r["key"] == "Tense")
    assert tense["value"] == "Present"
    assert tense["is_override"] is True
    assert tense["defined_at_node_id"] == str(chap.id)

    # Update the override
    put = await client.put(
        f"/api/stories/{story_id}/core/settings/Tense?node_id={chap.id}",
        json={"value": "Past"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert put.status_code == 200
    assert put.json()["value"] == "Past"

    # Delete the override — resolver should fall back to inheritance (no Tense
    # anywhere else; key should simply disappear)
    dele = await client.delete(
        f"/api/stories/{story_id}/core/settings/Tense?node_id={chap.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert dele.status_code == 204

    resp2 = await client.get(
        f"/api/stories/{story_id}/core/settings?node_id={chap.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    keys = {r["key"] for r in resp2.json()}
    assert "Tense" not in keys


@pytest.mark.asyncio
async def test_node_scoped_delete_allows_system_rows(client, db_session):
    """System-source rows are only protected at the story-root level;
    node-level copies can be freely removed."""
    token = await _auth(client)
    story_id = await _create_story(client, token)

    from app.models.core import CoreConfigNode as CCNode, CoreKind as CK
    chap = CCNode(
        id=uuid.uuid4(),
        org_id=(await db_session.execute(
            Story.__table__.select().where(Story.id == uuid.UUID(story_id))
        )).one().org_id,
        story_id=uuid.UUID(story_id),
        parent_id=None,
        depth=1, label="Ch 7", kind=CK.chap, active=False, sort_order=70,
    )
    db_session.add(chap)
    await db_session.flush()
    await db_session.commit()

    await client.post(
        f"/api/stories/{story_id}/core/settings",
        json={"key": "Draft", "value": "7", "source": "system", "config_node_id": str(chap.id)},
        headers={"Authorization": f"Bearer {token}"},
    )
    dele = await client.delete(
        f"/api/stories/{story_id}/core/settings/Draft?node_id={chap.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert dele.status_code == 204
