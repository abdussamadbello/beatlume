from typing import TypedDict

from langgraph.graph import StateGraph, END

from app.ai.graph_metrics import instrumented_node
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


@instrumented_node("scaffold", "generate_scaffold")
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
