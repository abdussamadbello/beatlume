from typing import TypedDict

from langgraph.graph import StateGraph, END

from app.ai.graph_metrics import instrumented_node
from app.ai.llm import call_llm
from app.ai.prompts import scene_summarization


class SummaryState(TypedDict):
    scene: dict
    prose: str
    pov_character: dict | None
    result: dict | None
    error: str | None


@instrumented_node("summary", "generate_summary")
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
