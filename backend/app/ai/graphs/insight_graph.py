from typing import TypedDict

from langgraph.graph import StateGraph, END

from app.ai.graph_metrics import instrumented_node
from app.ai.llm import call_llm
from app.ai.prompts import insight_analysis, insight_synthesis


class InsightState(TypedDict):
    story_id: str
    story_context: dict
    act_contexts: dict  # {act_number: context_sections}
    chunk_findings: list  # findings per act
    final_insights: list | None
    error: str | None


@instrumented_node("insight", "analyze_acts")
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


@instrumented_node("insight", "synthesize")
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
