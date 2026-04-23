"""LLM call layer with retry and error handling."""

from __future__ import annotations

import asyncio
import json
import logging
import re

import litellm

from app.ai.errors import classify_error
from app.config import settings

logger = logging.getLogger(__name__)

TASK_MODEL_MAP = {
    "prose_continuation": {
        "fast": settings.ai_model_fast,
        "standard": settings.ai_model_standard,
        "powerful": settings.ai_model_powerful,
    },
    "story_scaffolding": {
        "fast": settings.ai_model_fast,
        "standard": settings.ai_model_standard,
        "powerful": settings.ai_model_powerful,
        "scaffold": settings.ai_model_scaffold,
    },
    "insight_analysis": {
        "fast": settings.ai_model_fast,
        "standard": settings.ai_model_standard,
        "powerful": settings.ai_model_powerful,
    },
    "insight_synthesis": {
        "fast": settings.ai_model_fast,
        "standard": settings.ai_model_standard,
        "powerful": settings.ai_model_powerful,
    },
    "insight_apply": {
        "fast": settings.ai_model_fast,
        "standard": settings.ai_model_standard,
        "powerful": settings.ai_model_powerful,
    },
    "insight_generation": {
        "fast": settings.ai_model_fast,
        "standard": settings.ai_model_standard,
        "powerful": settings.ai_model_powerful,
    },
    "relationship_inference": {
        "fast": settings.ai_model_fast,
        "standard": settings.ai_model_standard,
        "powerful": settings.ai_model_powerful,
    },
    "scene_summarization": {
        "fast": settings.ai_model_fast,
        "standard": settings.ai_model_standard,
        "powerful": settings.ai_model_powerful,
    },
}

TASK_TIER_MAP = {
    "prose_continuation": "standard",
    "story_scaffolding": "scaffold",
    "insight_analysis": "standard",
    "insight_synthesis": "powerful",
    "insight_apply": "standard",
    "insight_generation": "powerful",
    "relationship_inference": "standard",
    "scene_summarization": "fast",
}

# Retry configuration
MAX_RETRIES = 3
BASE_RETRY_DELAY = 2  # seconds


async def call_llm(
    task_type: str,
    messages: list[dict],
    *,
    temperature: float = 0.7,
    max_tokens: int = 4000,
    model_tier: str | None = None,
) -> str:
    """Call LLM with retry logic. Raises on non-retryable errors."""
    tier = model_tier or TASK_TIER_MAP.get(task_type, "standard")
    model = TASK_MODEL_MAP.get(task_type, {}).get(tier, settings.ai_model_standard)

    last_error: LLMErrorInfo | None = None

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await litellm.acompletion(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=120,  # 2 minute timeout
            )
            content = response.choices[0].message.content
            if content is None:
                raise ValueError("Empty response from model")
            return content.strip()

        except Exception as exc:
            error_info = classify_error(exc)
            last_error = error_info

            if not error_info.retryable:
                logger.error(
                    "Non-retryable LLM error [%s]: %s",
                    error_info.category,
                    error_info.message[:200],
                )
                raise

            if attempt < MAX_RETRIES:
                delay = error_info.retry_after or (BASE_RETRY_DELAY * (2 ** attempt))
                logger.warning(
                    "Retryable LLM error [%s] attempt %d/%d, retrying in %ds: %s",
                    error_info.category,
                    attempt + 1,
                    MAX_RETRIES,
                    delay,
                    error_info.message[:200],
                )
                await asyncio.sleep(delay)
            else:
                logger.error(
                    "LLM call failed after %d retries [%s]: %s",
                    MAX_RETRIES,
                    error_info.category,
                    error_info.message[:200],
                )

    assert last_error is not None
    raise RuntimeError(f"LLM call failed: {last_error.message}")


async def call_llm_stream(
    task_type: str,
    messages: list[dict],
    *,
    temperature: float = 0.7,
    max_tokens: int = 4000,
    model_tier: str | None = None,
):
    """Stream LLM response. Yields chunks.

    Retries the initial connection on transient errors.
    If streaming fails mid-stream, raises the classified error.
    Caller is responsible for accumulating chunks before the failure.
    """
    tier = model_tier or TASK_TIER_MAP.get(task_type, "standard")
    model = TASK_MODEL_MAP.get(task_type, {}).get(tier, settings.ai_model_standard)

    last_error = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await litellm.acompletion(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
                timeout=120,
            )
            break
        except Exception as exc:
            error_info = classify_error(exc)
            last_error = error_info
            if not error_info.retryable:
                raise
            if attempt < MAX_RETRIES:
                delay = error_info.retry_after or (BASE_RETRY_DELAY * (2 ** attempt))
                await asyncio.sleep(delay)
            else:
                raise
    else:
        raise RuntimeError(f"Stream connection failed: {last_error.message}")

    try:
        async for chunk in response:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content
    except Exception as exc:
        error_info = classify_error(exc)
        logger.error(
            "Stream error [%s]: %s",
            error_info.category,
            error_info.message[:200],
        )
        raise


_MARKDOWN_CODE_RE = re.compile(r"^```(?:\w+)?\s*\n?(.*?)\n?\s*```$", re.DOTALL)


def parse_json_response(raw: str) -> dict:
    """Parse JSON from LLM response, handling markdown code blocks."""
    text = raw.strip()
    match = _MARKDOWN_CODE_RE.match(text)
    if match:
        text = match.group(1).strip()
    return json.loads(text)
