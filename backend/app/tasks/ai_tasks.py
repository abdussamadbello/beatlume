import asyncio
import json
import logging
import uuid
from textwrap import dedent

import redis
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.ai.context.assembler import AssembledContext, ContextAssembler
from app.ai.graphs.insight_graph import build_insight_graph
from app.ai.graphs.relationship_graph import build_relationship_graph
from app.ai.graphs.summary_graph import build_summary_graph
from app.ai.llm import call_llm, call_llm_stream
from app.ai.prompts import insight_apply, prose_continuation, story_scaffolding
from app.config import settings as app_settings
from app.models.beat import Beat
from app.models.character import Character
from app.models.draft import DraftContent
from app.models.graph import CharacterEdge, CharacterNode, EdgeKind, EdgeProvenance
from app.models.insight import Insight
from app.models.scene import Scene
from app.models.scene_participant import SceneParticipant
from app.models.story import Story
from app.services import draft as draft_service
from app.services import graph as graph_service
from app.services import insight as insight_service
from app.services import insight_apply as insight_apply_service
from app.services import manuscript_assembly as manuscript_assembly_service
from app.services import story_scaffold as story_scaffold_service
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

redis_client = redis.Redis.from_url(app_settings.redis_url)


def publish_event(story_id: str, event_type: str, data: dict):
    """Publish event to Redis pub/sub for SSE consumption."""
    redis_client.publish(
        f"story:{story_id}:events",
        json.dumps({"type": event_type, "data": data}),
    )


async def _with_session():
    """Create a fresh async engine + session for a single task run.

    Why fresh: Celery workers invoke `asyncio.run()` per task, which creates a
    new event loop each time. A module-level engine's pool would bind to the
    first loop and break on subsequent tasks. Cheap to rebuild; robust.
    """
    engine = create_async_engine(
        app_settings.database_url,
        echo=False,
        pool_pre_ping=True,
        connect_args={"prepared_statement_cache_size": 0},
    )
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return engine, session_maker


async def _set_org_rls(db: AsyncSession, org_id: str):
    await db.execute(
        text("SELECT set_config('app.current_org_id', :org_id, true)"),
        {"org_id": org_id},
    )


async def _prose_continuation_in_session(
    db: AsyncSession,
    task_id: str,
    story_id: str,
    scene_id: str,
    org_id: str,
    *,
    emit_token_chunks: bool = True,
    event_type: str = "prose_continuation",
    min_words: int = 1500,
    max_passes: int = 5,
) -> int:
    """Stream prose for one scene, persist draft. Uses multi-pass beat-by-beat
    expansion to reach min_words. Returns total new word count."""
    scene_r = await db.execute(select(Scene).where(Scene.id == uuid.UUID(scene_id)))
    scene = scene_r.scalar_one_or_none()
    if scene is None:
        raise ValueError(f"Scene {scene_id} not found")

    assembler = ContextAssembler(db, model_tier="standard")
    ctx: AssembledContext = await assembler.assemble_for_prose_continuation(
        uuid.UUID(story_id), uuid.UUID(scene_id), scene.n, scene.pov,
    )

    settings_map = await assembler.retriever.get_resolved_settings_for_scene(
        uuid.UUID(story_id), scene.n,
    )
    story_context = {
        "genre": settings_map.get("genre", "Literary"),
        "tense": settings_map.get("tense", "past"),
        "tone": settings_map.get("tone", "literary"),
    }

    pov_char = await assembler.retriever.get_character_by_name(
        uuid.UUID(story_id), scene.pov,
    )
    pov_dict = None
    if pov_char is not None:
        pov_dict = {
            "name": pov_char.name,
            "role": pov_char.role,
            "desire": pov_char.desire,
            "flaw": pov_char.flaw,
        }

    scene_dict = {
        "n": scene.n,
        "title": scene.title,
        "pov": scene.pov,
        "tension": scene.tension,
        "act": scene.act,
        "location": scene.location,
    }

    existing = await draft_service.get_draft(db, uuid.UUID(story_id), uuid.UUID(scene_id))
    base_content = existing.content if existing and existing.content else ""
    base_words = len(base_content.split()) if base_content else 0

    publish_event(story_id, "ai.progress", {
        "task_id": task_id, "type": event_type, "status": "running",
    })

    total_new_words = 0
    accumulated = base_content

    continuation_instruction = (
        "Continue the scene from exactly where the text ends. "
        "Write 400-600 words of rich, immersive prose. "
        "Include dialogue, sensory details, internal thoughts, and physical action. "
        "Do NOT conclude the scene — leave it open for more. "
        "Output ONLY the prose continuation."
    )

    for pass_num in range(max_passes):
        remaining = max(0, min_words - base_words - total_new_words)
        if remaining <= 100:
            break

        messages = prose_continuation.build_prompt(ctx, scene_dict, story_context, pov_dict)

        if accumulated:
            last_3000 = accumulated[-3000:]
            messages[-1]["content"] = dedent(f"""
                STORY OVERVIEW:
                {ctx.sections.get('story_skeleton', 'Not available')}

                SCENE BEATS:
                {ctx.sections.get('scene_beats', 'No beats available')}

                FULL SCENE PROSE SO FAR:
                {last_3000}

                INSTRUCTION: Continue the scene from the very last word above.
                Write 400-600 words. Add dialogue, sensory detail, character thoughts, and action.
                Do NOT wrap up the scene. Do NOT write "the end" or conclude.
                Output ONLY the prose continuation. No meta-commentary.
            """).strip()
        else:
            messages[-1]["content"] += f"\n\n{continuation_instruction}"

        chunks: list[str] = []
        seq = 0
        stream_failed = False

        try:
            async for chunk in call_llm_stream(
                "prose_continuation", messages, temperature=0.8, max_tokens=4000,
            ):
                chunks.append(chunk)
                if emit_token_chunks and pass_num == 0:
                    publish_event(story_id, "ai.chunk", {
                        "task_id": task_id,
                        "type": event_type,
                        "scene_id": scene_id,
                        "text": chunk,
                        "seq": seq,
                    })
                seq += 1
        except Exception as exc:
            stream_failed = True
            from app.ai.errors import classify_error
            error_info = classify_error(exc)
            logger.warning(
                "Streaming failed mid-pass %d for scene %s [%s]: %s",
                pass_num + 1, scene_id, error_info.category, str(exc)[:200],
            )

        full_text = "".join(chunks)
        if not full_text and not stream_failed:
            raise ValueError("Empty response from model")

        if full_text:
            try:
                validated = prose_continuation.validate_output(full_text)
            except ValueError:
                if stream_failed:
                    validated = full_text
                else:
                    raise

            if accumulated:
                accumulated = accumulated + "\n\n" + validated
            else:
                accumulated = validated

            total_new_words = len(accumulated.split()) - base_words
            new_wc = len(validated.split())
        else:
            if stream_failed and pass_num > 0:
                break
            raise ValueError("No content generated")

        if new_wc < 100:
            break

    await draft_service.upsert_draft(
        db, uuid.UUID(story_id), uuid.UUID(scene_id), uuid.UUID(org_id), accumulated,
    )
    if emit_token_chunks:
        publish_event(story_id, "ai.complete", {
            "task_id": task_id,
            "type": event_type,
            "scene_id": scene_id,
            "status": "completed",
            "word_count": total_new_words,
            "passes": max_passes,
        })
    return total_new_words


async def _run_prose_stream(task_id: str, story_id: str, scene_id: str, org_id: str):
    engine, session_maker = await _with_session()
    try:
        async with session_maker() as db:
            await _set_org_rls(db, org_id)
            await _prose_continuation_in_session(
                db, task_id, story_id, scene_id, org_id,
                emit_token_chunks=True,
                event_type="prose_continuation",
            )
    finally:
        await engine.dispose()


async def _run_scaffold(
    task_id: str,
    story_id: str,
    premise: str,
    structure: str,
    target_words: int,
    genres: list,
    characters: list,
    org_id: str,
    replace_existing: bool,
) -> None:
    engine, session_maker = await _with_session()
    try:
        async with session_maker() as db:
            await _set_org_rls(db, org_id)
            messages = story_scaffolding.build_prompt(
                premise, structure, target_words, genres, characters,
            )
            publish_event(story_id, "ai.progress", {
                "task_id": task_id, "type": "story_scaffolding", "status": "running",
            })
            # Full 3-act JSON can exceed 4k tokens; truncation yields invalid JSON and flaky UI/E2E.
            raw = await call_llm("story_scaffolding", messages, temperature=0.7, max_tokens=12_000)
            if not raw:
                raise ValueError("Empty response from story scaffolding model")
            validated = story_scaffolding.validate_output(raw)
            n = await story_scaffold_service.apply_scaffold_to_story(
                db, uuid.UUID(story_id), uuid.UUID(org_id), validated,
                replace_existing=replace_existing,
            )
            publish_event(story_id, "ai.complete", {
                "task_id": task_id,
                "type": "story_scaffolding",
                "status": "completed",
                "scene_count": n,
            })
    finally:
        await engine.dispose()


async def _run_full_manuscript(
    task_id: str,
    story_id: str,
    org_id: str,
    *,
    skip_non_empty: bool,
    max_scenes: int | None,
    act: int | None,
    min_scene_n: int | None,
) -> None:
    engine, session_maker = await _with_session()
    try:
        async with session_maker() as db:
            await _set_org_rls(db, org_id)
            result = await db.execute(
                select(Scene)
                .where(Scene.story_id == uuid.UUID(story_id))
                .order_by(Scene.n)
            )
            scenes = list(result.scalars().all())
            if act is not None:
                scenes = [s for s in scenes if s.act == act]
            if min_scene_n is not None and min_scene_n > 0:
                scenes = [s for s in scenes if s.n >= min_scene_n]
            if max_scenes is not None and max_scenes > 0:
                scenes = scenes[:max_scenes]
            total = len(scenes)
            if total == 0:
                publish_event(story_id, "ai.error", {
                    "task_id": task_id,
                    "type": "full_manuscript",
                    "error": "No scenes to write for this story.",
                })
                return

            publish_event(story_id, "ai.progress", {
                "task_id": task_id,
                "type": "full_manuscript",
                "status": "running",
                "current": 0,
                "total": total,
            })
            written = 0
            skipped = 0
            for i, scene in enumerate(scenes):
                if skip_non_empty:
                    d = await draft_service.get_draft(db, uuid.UUID(story_id), scene.id)
                    if d and d.content and d.content.strip():
                        skipped += 1
                        publish_event(story_id, "ai.progress", {
                            "task_id": task_id,
                            "type": "full_manuscript",
                            "status": "running",
                            "current": i + 1,
                            "total": total,
                            "scene_n": scene.n,
                            "scene_id": str(scene.id),
                            "skipped": True,
                        })
                        continue
                try:
                    await _prose_continuation_in_session(
                        db, task_id, story_id, str(scene.id), org_id,
                        emit_token_chunks=False,
                        event_type="full_manuscript",
                    )
                    written += 1
                except Exception as exc:
                    from app.ai.errors import classify_error, format_error_for_frontend
                    error_info = classify_error(exc)
                    publish_event(story_id, "ai.error", {
                        "task_id": task_id,
                        "type": "full_manuscript",
                        "scene_n": scene.n,
                        "scene_id": str(scene.id),
                        **format_error_for_frontend(error_info),
                    })
                    logger.warning(
                        "Scene %d failed [%s], skipping: %s",
                        scene.n, error_info.category, error_info.message[:200],
                    )
                publish_event(story_id, "ai.progress", {
                    "task_id": task_id,
                    "type": "full_manuscript",
                    "status": "running",
                    "current": i + 1,
                    "total": total,
                    "scene_n": scene.n,
                    "scene_id": str(scene.id),
                })
            await manuscript_assembly_service.sync_manuscript_chapters_from_drafts(
                db, uuid.UUID(story_id), uuid.UUID(org_id),
            )
            publish_event(story_id, "ai.complete", {
                "task_id": task_id,
                "type": "full_manuscript",
                "status": "completed",
                "scenes_targeted": total,
                "scenes_written": written,
                "scenes_skipped": skipped,
            })
    finally:
        await engine.dispose()


async def _run_generate_insights(task_id: str, story_id: str, org_id: str) -> dict:
    engine, session_maker = await _with_session()
    try:
        async with session_maker() as db:
            await _set_org_rls(db, org_id)
            story = (
                await db.execute(select(Story).where(Story.id == uuid.UUID(story_id)))
            ).scalar_one_or_none()
            if story is None:
                raise ValueError(f"Story {story_id} not found")

            assembler = ContextAssembler(db, model_tier="powerful")
            settings = await assembler.retriever.get_story_settings(uuid.UUID(story_id))
            story_context = {
                "title": story.title,
                "genre": settings.get("genre", "Literary"),
            }

            scenes = list(
                (
                    await db.execute(
                        select(Scene).where(Scene.story_id == uuid.UUID(story_id))
                    )
                ).scalars().all()
            )
            acts = sorted({s.act for s in scenes if s.act and s.act > 0})
            if not acts:
                acts = [1]

            act_contexts: dict[str, dict[str, str]] = {}
            for act in acts:
                ctx = await assembler.assemble_for_insight_analysis(
                    uuid.UUID(story_id), act
                )
                act_contexts[str(act)] = ctx.sections

            publish_event(
                story_id,
                "ai.progress",
                {
                    "task_id": task_id,
                    "type": "insight_generation",
                    "status": "running",
                },
            )

            graph = build_insight_graph()
            state = {
                "story_id": story_id,
                "story_context": story_context,
                "act_contexts": act_contexts,
                "chunk_findings": [],
                "final_insights": None,
                "error": None,
            }
            result = await graph.ainvoke(state)
            if result.get("error"):
                raise ValueError(result["error"])
            insights = result.get("final_insights") or []

            # Replace prior generated insights to keep the list current.
            await db.execute(delete(Insight).where(Insight.story_id == uuid.UUID(story_id)))
            for item in insights:
                db.add(
                    Insight(
                        story_id=uuid.UUID(story_id),
                        org_id=uuid.UUID(org_id),
                        severity=item["severity"],
                        category=item["category"],
                        title=item["title"],
                        body=item["body"],
                        refs=item.get("refs", []),
                        dismissed=False,
                    )
                )
            await db.commit()

            publish_event(
                story_id,
                "ai.complete",
                {
                    "task_id": task_id,
                    "type": "insight_generation",
                    "status": "completed",
                    "insight_count": len(insights),
                },
            )
            return {"insight_count": len(insights), "acts_analyzed": len(acts)}
    finally:
        await engine.dispose()


async def _run_apply_insight(
    task_id: str, story_id: str, org_id: str, insight_id: str
) -> dict:
    engine, session_maker = await _with_session()
    try:
        async with session_maker() as db:
            await _set_org_rls(db, org_id)
            in_id = uuid.UUID(insight_id)
            insight_row = await insight_service.get_insight(
                db, uuid.UUID(story_id), in_id
            )
            if insight_row is None:
                raise ValueError("Insight not found")

            allowed_list = insight_apply.collect_scene_numbers(
                list(insight_row.refs or []), insight_row.body
            )
            if not allowed_list:
                raise ValueError(
                    "This insight has no scene references (e.g. S12). Add refs or fix it manually."
                )
            allowed_set = set(allowed_list)

            scene_blocks: list[dict] = []
            for n in allowed_list:
                sc_r = await db.execute(
                    select(Scene).where(
                        Scene.story_id == uuid.UUID(story_id), Scene.n == n
                    )
                )
                sc = sc_r.scalar_one_or_none()
                if sc is None:
                    continue
                d = await draft_service.get_draft(db, uuid.UUID(story_id), sc.id)
                excerpt = (d.content if d else "") or ""
                scene_blocks.append(
                    {
                        "n": n,
                        "title": sc.title,
                        "act": sc.act,
                        "tension": sc.tension,
                        "summary": sc.summary,
                        "draft_excerpt": excerpt,
                    }
                )
            if not scene_blocks:
                raise ValueError(
                    "No matching scenes for this insight’s scene numbers."
                )

            publish_event(
                story_id,
                "ai.progress",
                {
                    "task_id": task_id,
                    "type": "insight_apply",
                    "status": "running",
                },
            )

            insight_dict = {
                "severity": insight_row.severity.value
                if hasattr(insight_row.severity, "value")
                else str(insight_row.severity),
                "category": insight_row.category,
                "title": insight_row.title,
                "body": insight_row.body,
                "refs": list(insight_row.refs or []),
            }
            messages = insight_apply.build_prompt(insight_dict, scene_blocks)
            result = await call_llm(
                "insight_apply", messages, temperature=0.35, max_tokens=4000
            )
            if not result:
                raise ValueError("Empty model response")
            operations = insight_apply.validate_output(result)
            if not operations:
                raise ValueError("Model returned no operations")

            counts = await insight_apply_service.apply_insight_operations(
                db,
                uuid.UUID(story_id),
                uuid.UUID(org_id),
                allowed_set,
                operations,
            )
            total_applied = sum(counts.values())
            if total_applied < 1:
                raise ValueError(
                    "No changes could be applied. Check scene numbers or try again."
                )

            ok = await insight_service.dismiss_insight(
                db, uuid.UUID(story_id), in_id
            )
            if not ok:
                raise ValueError("Could not mark insight as handled")

            publish_event(
                story_id,
                "ai.complete",
                {
                    "task_id": task_id,
                    "type": "insight_apply",
                    "status": "completed",
                    "insight_id": insight_id,
                    "operations_applied": total_applied,
                    "by_kind": counts,
                },
            )
            return {"operations_applied": total_applied, "by_kind": counts}
    finally:
        await engine.dispose()


async def _run_infer_relationships(task_id: str, story_id: str, org_id: str) -> dict:
    engine, session_maker = await _with_session()
    try:
        async with session_maker() as db:
            await _set_org_rls(db, org_id)

            publish_event(
                story_id,
                "ai.progress",
                {
                    "task_id": task_id,
                    "type": "relationship_inference",
                    "status": "running",
                },
            )

            await graph_service.ensure_nodes_for_characters(db, uuid.UUID(story_id))
            chars = list(
                (
                    await db.execute(
                        select(Character)
                        .where(Character.story_id == uuid.UUID(story_id))
                        .order_by(Character.scene_count.desc(), Character.name)
                    )
                ).scalars().all()
            )
            if len(chars) < 2:
                publish_event(
                    story_id,
                    "ai.complete",
                    {
                        "task_id": task_id,
                        "type": "relationship_inference",
                        "status": "completed",
                        "pairs_analyzed": 0,
                        "edges_upserted": 0,
                    },
                )
                return {"pairs_analyzed": 0, "edges_upserted": 0}

            participants = list(
                (
                    await db.execute(
                        select(SceneParticipant).where(
                            SceneParticipant.org_id == uuid.UUID(org_id),
                            SceneParticipant.scene_id.in_(
                                select(Scene.id).where(Scene.story_id == uuid.UUID(story_id))
                            ),
                        )
                    )
                ).scalars().all()
            )
            scene_ids_by_character: dict[uuid.UUID, set[uuid.UUID]] = {}
            for p in participants:
                scene_ids_by_character.setdefault(p.character_id, set()).add(p.scene_id)

            scenes = list(
                (
                    await db.execute(
                        select(Scene).where(Scene.story_id == uuid.UUID(story_id))
                    )
                ).scalars().all()
            )
            scene_by_id = {s.id: s for s in scenes}
            drafts = list(
                (
                    await db.execute(
                        select(DraftContent).where(
                            DraftContent.story_id == uuid.UUID(story_id)
                        )
                    )
                ).scalars().all()
            )
            prose_by_scene = {d.scene_id: d.content for d in drafts if d.content}

            nodes = list(
                (
                    await db.execute(
                        select(CharacterNode).where(
                            CharacterNode.story_id == uuid.UUID(story_id)
                        )
                    )
                ).scalars().all()
            )
            node_by_char = {n.character_id: n for n in nodes}
            edges = list(
                (
                    await db.execute(
                        select(CharacterEdge).where(
                            CharacterEdge.story_id == uuid.UUID(story_id)
                        )
                    )
                ).scalars().all()
            )
            edge_by_pair: dict[tuple[uuid.UUID, uuid.UUID], CharacterEdge] = {}
            for edge in edges:
                edge_by_pair[(edge.source_node_id, edge.target_node_id)] = edge

            pairs: list[dict] = []
            for i, a in enumerate(chars):
                for b in chars[i + 1 :]:
                    shared = sorted(
                        scene_ids_by_character.get(a.id, set())
                        & scene_ids_by_character.get(b.id, set()),
                        key=lambda sid: scene_by_id.get(sid).n if sid in scene_by_id else 9999,
                    )
                    if not shared:
                        continue
                    shared_scenes = [
                        {
                            "n": scene_by_id[sid].n,
                            "title": scene_by_id[sid].title,
                            "act": scene_by_id[sid].act,
                        }
                        for sid in shared
                        if sid in scene_by_id
                    ]
                    excerpts = [
                        prose_by_scene[sid][:1600]
                        for sid in shared
                        if sid in prose_by_scene and prose_by_scene[sid].strip()
                    ]
                    existing_edge = None
                    node_a = node_by_char.get(a.id)
                    node_b = node_by_char.get(b.id)
                    if node_a and node_b:
                        found = edge_by_pair.get((node_a.id, node_b.id)) or edge_by_pair.get(
                            (node_b.id, node_a.id)
                        )
                        if found:
                            existing_edge = {"kind": found.kind, "weight": found.weight}
                    pairs.append(
                        {
                            "char_a": {
                                "id": str(a.id),
                                "name": a.name,
                                "role": a.role,
                                "desire": a.desire,
                                "flaw": a.flaw,
                            },
                            "char_b": {
                                "id": str(b.id),
                                "name": b.name,
                                "role": b.role,
                                "desire": b.desire,
                                "flaw": b.flaw,
                            },
                            "shared_scenes": shared_scenes,
                            "prose_excerpts": excerpts,
                            "existing_edge": existing_edge,
                        }
                    )

            if not pairs:
                publish_event(
                    story_id,
                    "ai.complete",
                    {
                        "task_id": task_id,
                        "type": "relationship_inference",
                        "status": "completed",
                        "pairs_analyzed": 0,
                        "edges_upserted": 0,
                    },
                )
                return {"pairs_analyzed": 0, "edges_upserted": 0}

            graph = build_relationship_graph()
            graph_result = await graph.ainvoke({"pairs": pairs, "results": [], "error": None})
            results = graph_result.get("results", [])

            edges_upserted = 0
            for pair_input, item in zip(pairs, results):
                kind = item.get("kind")
                if not kind:
                    continue
                char_a_id = uuid.UUID(pair_input["char_a"]["id"])
                char_b_id = uuid.UUID(pair_input["char_b"]["id"])
                node_a = node_by_char.get(char_a_id)
                node_b = node_by_char.get(char_b_id)
                if not node_a or not node_b:
                    continue

                direction = item.get("direction")
                if direction == "b_to_a":
                    source_node_id, target_node_id = node_b.id, node_a.id
                elif direction == "mutual":
                    source_node_id, target_node_id = sorted([node_a.id, node_b.id], key=str)
                else:
                    source_node_id, target_node_id = node_a.id, node_b.id

                existing = (
                    edge_by_pair.get((source_node_id, target_node_id))
                    or edge_by_pair.get((target_node_id, source_node_id))
                )
                shared_refs = [s.get("n") for s in pair_input["shared_scenes"] if s.get("n") is not None]
                evidence = [{
                    "reasoning": item.get("reasoning", ""),
                    "shared_scene_numbers": shared_refs,
                }]
                if existing:
                    existing.source_node_id = source_node_id
                    existing.target_node_id = target_node_id
                    existing.kind = EdgeKind(kind)
                    existing.weight = max(0.1, min(1.0, float(item.get("weight", 0.5))))
                    existing.provenance = EdgeProvenance.ai_pending
                    existing.evidence = evidence
                    if shared_refs:
                        existing.first_evidenced_scene = min(shared_refs)
                else:
                    edge = CharacterEdge(
                        story_id=uuid.UUID(story_id),
                        org_id=uuid.UUID(org_id),
                        source_node_id=source_node_id,
                        target_node_id=target_node_id,
                        kind=EdgeKind(kind),
                        weight=max(0.1, min(1.0, float(item.get("weight", 0.5)))),
                        provenance=EdgeProvenance.ai_pending,
                        evidence=evidence,
                        first_evidenced_scene=min(shared_refs) if shared_refs else 1,
                    )
                    db.add(edge)
                    edge_by_pair[(source_node_id, target_node_id)] = edge
                edges_upserted += 1

            await db.commit()

            publish_event(
                story_id,
                "ai.complete",
                {
                    "task_id": task_id,
                    "type": "relationship_inference",
                    "status": "completed",
                    "pairs_analyzed": len(pairs),
                    "edges_upserted": edges_upserted,
                },
            )
            return {"pairs_analyzed": len(pairs), "edges_upserted": edges_upserted}
    finally:
        await engine.dispose()


async def _run_summarize_scene(
    task_id: str,
    story_id: str,
    scene_id: str,
    org_id: str,
) -> dict:
    engine, session_maker = await _with_session()
    try:
        async with session_maker() as db:
            await _set_org_rls(db, org_id)

            publish_event(
                story_id,
                "ai.progress",
                {
                    "task_id": task_id,
                    "type": "scene_summarization",
                    "status": "running",
                    "scene_id": scene_id,
                },
            )

            scene = (
                await db.execute(select(Scene).where(Scene.id == uuid.UUID(scene_id)))
            ).scalar_one_or_none()
            if scene is None:
                raise ValueError(f"Scene {scene_id} not found")
            draft = (
                await db.execute(
                    select(DraftContent).where(DraftContent.scene_id == uuid.UUID(scene_id))
                )
            ).scalar_one_or_none()
            if draft is None or not draft.content or not draft.content.strip():
                raise ValueError("Scene has no prose yet; generate prose before summarizing.")

            assembler = ContextAssembler(db, model_tier="fast")
            pov = await assembler.retriever.get_character_by_name(
                uuid.UUID(story_id), scene.pov
            )
            pov_character = None
            if pov is not None:
                pov_character = {"name": pov.name, "role": pov.role}

            graph = build_summary_graph()
            state = {
                "scene": {
                    "n": scene.n,
                    "title": scene.title,
                    "pov": scene.pov,
                    "tension": scene.tension,
                    "act": scene.act,
                    "location": scene.location,
                },
                "prose": draft.content,
                "pov_character": pov_character,
                "result": None,
                "error": None,
            }
            result = await graph.ainvoke(state)
            if result.get("error"):
                raise ValueError(result["error"])
            payload = result.get("result")
            if not payload:
                raise ValueError("Scene summarization returned no result")
            new_summary = (payload.get("summary") or "").strip()
            if not new_summary:
                raise ValueError("Scene summarization returned empty summary")
            scene.summary = new_summary
            await db.execute(delete(Beat).where(Beat.scene_id == uuid.UUID(scene_id)))
            for i, beat_text in enumerate(payload.get("beats", []), start=1):
                db.add(
                    Beat(
                        scene_id=uuid.UUID(scene_id),
                        org_id=uuid.UUID(org_id),
                        n=i,
                        title=(beat_text or "").strip()[:500],
                        kind="action",
                        summary=(beat_text or "").strip()[:1000] or None,
                    )
                )
            await db.commit()

            publish_event(
                story_id,
                "ai.complete",
                {
                    "task_id": task_id,
                    "type": "scene_summarization",
                    "status": "completed",
                    "scene_id": scene_id,
                    "beats_count": len(payload.get("beats", [])),
                },
            )
            return {"scene_id": scene_id, "beats_count": len(payload.get("beats", []))}
    finally:
        await engine.dispose()


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def continue_prose(self, story_id: str, scene_id: str, org_id: str):
    """Prose continuation task. Assembles context, streams LLM tokens to SSE,
    then saves the final prose to DraftContent."""
    task_id = self.request.id
    try:
        asyncio.run(_run_prose_stream(task_id, story_id, scene_id, org_id))
    except Exception as exc:
        publish_event(story_id, "ai.error", {
            "task_id": task_id,
            "type": "prose_continuation",
            "scene_id": scene_id,
            "error": str(exc),
        })
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def generate_insights(self, story_id: str, org_id: str):
    """Full story insight analysis."""
    try:
        return asyncio.run(_run_generate_insights(self.request.id, story_id, org_id))
    except Exception as exc:
        publish_event(story_id, "ai.error", {
            "task_id": self.request.id,
            "type": "insight_generation",
            "error": str(exc),
        })
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=2, retry_backoff=True)
def apply_insight(self, story_id: str, org_id: str, insight_id: str):
    """LLM-proposed edits for one insight; persists draft/summary/tension and dismisses on success."""
    try:
        return asyncio.run(
            _run_apply_insight(self.request.id, story_id, org_id, insight_id)
        )
    except Exception as exc:
        publish_event(
            story_id,
            "ai.error",
            {
                "task_id": self.request.id,
                "type": "insight_apply",
                "insight_id": insight_id,
                "error": str(exc),
            },
        )
        raise self.retry(exc=exc) from exc


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def infer_relationships(self, story_id: str, org_id: str):
    """AI relationship inference across character pairs."""
    try:
        return asyncio.run(_run_infer_relationships(self.request.id, story_id, org_id))
    except Exception as exc:
        publish_event(story_id, "ai.error", {
            "task_id": self.request.id,
            "type": "relationship_inference",
            "error": str(exc),
        })
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def summarize_scene(self, story_id: str, scene_id: str, org_id: str):
    """Generate summary + beats for a single scene."""
    try:
        return asyncio.run(_run_summarize_scene(self.request.id, story_id, scene_id, org_id))
    except Exception as exc:
        publish_event(story_id, "ai.error", {
            "task_id": self.request.id,
            "type": "scene_summarization",
            "scene_id": scene_id,
            "error": str(exc),
        })
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, retry_backoff=True)
def scaffold_story(
    self,
    story_id: str,
    premise: str,
    structure: str,
    target_words: int,
    genres: list,
    characters: list,
    org_id: str,
    replace_existing: bool = False,
):
    """Generate full story structure from premise and persist scenes."""
    task_id = self.request.id
    try:
        asyncio.run(
            _run_scaffold(
                task_id,
                story_id,
                premise,
                structure,
                target_words,
                genres,
                characters,
                org_id,
                replace_existing,
            )
        )
    except story_scaffold_service.ScaffoldConflictError as exc:
        publish_event(story_id, "ai.error", {
            "task_id": task_id,
            "type": "story_scaffolding",
            "error": str(exc),
        })
    except Exception as exc:
        publish_event(story_id, "ai.error", {
            "task_id": task_id,
            "type": "story_scaffolding",
            "error": str(exc),
        })
        raise self.retry(exc=exc) from exc


@celery_app.task(
    bind=True,
    max_retries=2,
    retry_backoff=True,
    # Long books: many scenes × slow model can exceed 1h; 4h cap (see spec — prefer chord later).
    time_limit=4 * 3600,
    soft_time_limit=4 * 3600 - 300,
    name="app.tasks.ai_tasks.generate_full_manuscript",
)
def generate_full_manuscript(
    self,
    story_id: str,
    org_id: str,
    skip_non_empty: bool = True,
    max_scenes: int | None = None,
    act: int | None = None,
    min_scene_n: int | None = None,
):
    """Write prose for each scene in order; longer runs allowed via task time limit."""
    task_id = self.request.id
    try:
        asyncio.run(
            _run_full_manuscript(
                task_id,
                story_id,
                org_id,
                skip_non_empty=skip_non_empty,
                max_scenes=max_scenes,
                act=act,
                min_scene_n=min_scene_n,
            )
        )
    except Exception as exc:
        publish_event(story_id, "ai.error", {
            "task_id": task_id,
            "type": "full_manuscript",
            "error": str(exc),
        })
        raise self.retry(exc=exc) from exc
