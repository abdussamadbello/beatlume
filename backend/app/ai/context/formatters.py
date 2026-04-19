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
    return f"{edge.source} \u2194 {edge.target} \u2014 {edge.kind} (weight: {edge.weight})"


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
