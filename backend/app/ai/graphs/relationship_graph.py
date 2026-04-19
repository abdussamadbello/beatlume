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
