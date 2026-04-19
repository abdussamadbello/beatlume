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
