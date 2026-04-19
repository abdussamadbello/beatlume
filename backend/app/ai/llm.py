import json
from enum import Enum

import litellm
from litellm import completion, acompletion

from app.config import settings

# Suppress litellm logs in non-debug mode
litellm.suppress_debug_info = True


class ModelTier(str, Enum):
    FAST = "fast"
    STANDARD = "standard"
    POWERFUL = "powerful"
    SCAFFOLD = "scaffold"


TASK_MODEL_MAP: dict[str, ModelTier] = {
    "scene_summarization": ModelTier.FAST,
    "prose_continuation": ModelTier.STANDARD,
    "relationship_inference": ModelTier.STANDARD,
    "insight_generation": ModelTier.POWERFUL,
    "insight_synthesis": ModelTier.POWERFUL,
    "story_scaffolding": ModelTier.SCAFFOLD,
}


def get_model(task_type: str) -> str:
    """Get the configured model name for a given task type."""
    tier = TASK_MODEL_MAP.get(task_type, ModelTier.STANDARD)
    model_map = {
        ModelTier.FAST: settings.ai_model_fast,
        ModelTier.STANDARD: settings.ai_model_standard,
        ModelTier.POWERFUL: settings.ai_model_powerful,
        ModelTier.SCAFFOLD: settings.ai_model_scaffold,
    }
    return model_map[tier]


async def call_llm(
    task_type: str,
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: int = 2000,
    stream: bool = False,
) -> str | None:
    """
    Call an LLM via LiteLLM.

    Args:
        task_type: Maps to a model tier via TASK_MODEL_MAP
        messages: OpenAI-format messages
        temperature: Sampling temperature
        max_tokens: Max output tokens
        stream: If True, returns an async generator of chunks

    Returns:
        The response content string, or None if streaming (use call_llm_stream instead)
    """
    model = get_model(task_type)
    response = await acompletion(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=stream,
    )
    if stream:
        return response  # Returns async generator
    return response.choices[0].message.content


async def call_llm_stream(
    task_type: str,
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: int = 2000,
):
    """
    Stream LLM response chunks via LiteLLM.

    Yields:
        Content string chunks as they arrive.
    """
    model = get_model(task_type)
    response = await acompletion(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
    )
    async for chunk in response:
        delta = chunk.choices[0].delta
        if delta and delta.content:
            yield delta.content


def parse_json_response(raw: str) -> dict | list:
    """Parse JSON from LLM response, handling markdown code blocks."""
    text = raw.strip()
    # Strip markdown code blocks if present
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first and last lines (```json and ```)
        lines = [l for l in lines[1:] if not l.strip().startswith("```")]
        text = "\n".join(lines)
    return json.loads(text)
