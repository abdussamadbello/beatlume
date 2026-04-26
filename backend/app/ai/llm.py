"""LLM call layer with retry and error handling."""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time

import litellm
from opentelemetry import metrics as otel_metrics

from app.ai.errors import classify_error
from app.config import settings

logger = logging.getLogger(__name__)

_meter = otel_metrics.get_meter("app.ai.llm")
_llm_calls = _meter.create_counter(
    "llm.calls",
    unit="1",
    description="LLM calls grouped by task type, tier, model, outcome, and error category",
)
_llm_duration = _meter.create_histogram(
    "llm.duration",
    unit="s",
    description="LLM call wall-clock duration including retries and fallbacks",
)
_llm_tokens = _meter.create_counter(
    "llm.tokens",
    unit="1",
    description="LLM tokens consumed, split by direction (prompt vs completion)",
)
_llm_cost = _meter.create_counter(
    "llm.cost_usd",
    unit="USD",
    description="LLM cost in USD, computed via litellm.completion_cost() when pricing is known",
)


def _record_llm_call(
    *,
    task_type: str,
    tier: str,
    model: str | None,
    outcome: str,
    duration: float,
    response=None,
    usage=None,
    error_category: str | None = None,
) -> None:
    attrs = {"task_type": task_type, "tier": tier, "outcome": outcome}
    if model:
        attrs["model"] = model
    if error_category:
        attrs["error_category"] = error_category
    _llm_calls.add(1, attrs)
    _llm_duration.record(duration, {"task_type": task_type, "tier": tier, **({"model": model} if model else {})})

    effective_usage = usage if usage is not None else (getattr(response, "usage", None) if response is not None else None)
    prompt_t = getattr(effective_usage, "prompt_tokens", 0) or 0 if effective_usage else 0
    completion_t = getattr(effective_usage, "completion_tokens", 0) or 0 if effective_usage else 0

    if effective_usage:
        token_attrs = {"task_type": task_type, "tier": tier, "model": model or "unknown"}
        if prompt_t:
            _llm_tokens.add(prompt_t, {**token_attrs, "direction": "prompt"})
        if completion_t:
            _llm_tokens.add(completion_t, {**token_attrs, "direction": "completion"})

    # Cost is only meaningful on success + known model + non-zero usage.
    # litellm.completion_cost() silently returns 0.0 when the model isn't in its pricing table;
    # we gate on >0 so phantom $0.0 samples don't pollute the metric.
    if outcome == "success" and model:
        try:
            cost_usd: float = 0.0
            if response is not None:
                cost_usd = float(litellm.completion_cost(completion_response=response) or 0.0)
            elif prompt_t or completion_t:
                cost_usd = float(
                    litellm.completion_cost(
                        model=model,
                        prompt_tokens=prompt_t,
                        completion_tokens=completion_t,
                    )
                    or 0.0
                )
            if cost_usd > 0:
                _llm_cost.add(cost_usd, {"task_type": task_type, "tier": tier, "model": model})
        except Exception:
            logger.debug("litellm cost calculation failed (pricing table miss)", exc_info=True)

# Global semaphore to limit concurrent LLM calls (prevent rate limit spikes)
_LLM_SEMAPHORE: asyncio.Semaphore | None = None


def _get_semaphore() -> asyncio.Semaphore:
    """Get or create the LLM semaphore (lazy initialization for asyncio loop safety)."""
    global _LLM_SEMAPHORE
    if _LLM_SEMAPHORE is None:
        _LLM_SEMAPHORE = asyncio.Semaphore(settings.ai_max_concurrent_calls)
    return _LLM_SEMAPHORE


def _get_fallback_models() -> list[str]:
    """Get fallback models from settings."""
    if settings.ai_model_fallbacks:
        return [m.strip() for m in settings.ai_model_fallbacks.split(",") if m.strip()]
    return [
        "openrouter/openai/gpt-4o-mini",
        "openrouter/meta-llama/llama-3.1-8b-instruct",
    ]


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
    """Call LLM with retry logic, semaphore, and fallbacks. Raises on non-retryable errors."""
    tier = model_tier or TASK_TIER_MAP.get(task_type, "standard")
    primary_model = TASK_MODEL_MAP.get(task_type, {}).get(tier, settings.ai_model_standard)

    # Try primary model first, then fallbacks on rate limit
    fallback_models = _get_fallback_models()
    models_to_try = [primary_model] + [m for m in fallback_models if m != primary_model]

    last_error = None
    model_index = 0
    semaphore = _get_semaphore()
    start_time = time.monotonic()

    for model in models_to_try:
        model_index += 1
        if model_index > 1:
            logger.info("Falling back to model %s (attempt %d)", model, model_index)

        for attempt in range(MAX_RETRIES + 1):
            try:
                # Use semaphore to limit concurrent calls
                async with semaphore:
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
                _record_llm_call(
                    task_type=task_type,
                    tier=tier,
                    model=model,
                    outcome="success",
                    duration=time.monotonic() - start_time,
                    response=response,
                )
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
                    _record_llm_call(
                        task_type=task_type,
                        tier=tier,
                        model=model,
                        outcome="error",
                        duration=time.monotonic() - start_time,
                        error_category=error_info.category,
                    )
                    raise

                # On rate limit, try fallback model instead of retrying same model
                if error_info.category == "rate_limit" and model_index < len(models_to_try):
                    logger.warning(
                        "Rate limit on %s, switching to fallback model",
                        model,
                    )
                    break  # Exit retry loop, continue to next model

                if attempt < MAX_RETRIES:
                    delay = error_info.retry_after or (BASE_RETRY_DELAY * (2**attempt))
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
                        "LLM call failed after %d retries [%s] on model %s: %s",
                        MAX_RETRIES,
                        error_info.category,
                        model,
                        error_info.message[:200],
                    )

    _record_llm_call(
        task_type=task_type,
        tier=tier,
        model=None,
        outcome="error",
        duration=time.monotonic() - start_time,
        error_category=last_error.category if last_error else "unknown",
    )
    raise RuntimeError(f"LLM call failed after all models: {last_error.message}")


async def call_llm_stream(
    task_type: str,
    messages: list[dict],
    *,
    temperature: float = 0.7,
    max_tokens: int = 4000,
    model_tier: str | None = None,
):
    """Stream LLM response. Yields chunks.

    Uses semaphore to limit concurrent calls.
    Retries the initial connection on transient errors with fallbacks.
    If streaming fails mid-stream, raises the classified error.
    Caller is responsible for accumulating chunks before the failure.
    """
    tier = model_tier or TASK_TIER_MAP.get(task_type, "standard")
    primary_model = TASK_MODEL_MAP.get(task_type, {}).get(tier, settings.ai_model_standard)

    # Try primary model first, then fallbacks on rate limit
    fallback_models = _get_fallback_models()
    models_to_try = [primary_model] + [m for m in fallback_models if m != primary_model]
    semaphore = _get_semaphore()

    # Metric state — finally-block records exactly once when the generator finishes, whether
    # by successful return, consumer close, or raised exception.
    start_time = time.monotonic()
    stream_outcome = "error"
    stream_error_category: str | None = None
    streamed_model: str | None = None
    stream_usage = None
    last_error = None

    try:
        for model_index, model in enumerate(models_to_try):
            if model_index > 0:
                logger.info("Falling back to model %s for streaming", model)

            for attempt in range(MAX_RETRIES + 1):
                try:
                    # Use semaphore to limit concurrent calls
                    async with semaphore:
                        response = await litellm.acompletion(
                            model=model,
                            messages=messages,
                            temperature=temperature,
                            max_tokens=max_tokens,
                            stream=True,
                            # Ask providers to emit a final usage chunk; LiteLLM passes it through
                            # for OpenAI-compatible providers (ignored where unsupported).
                            stream_options={"include_usage": True},
                            timeout=120,
                        )
                    break
                except Exception as exc:
                    error_info = classify_error(exc)
                    last_error = error_info
                    stream_error_category = error_info.category
                    if not error_info.retryable:
                        raise

                    # On rate limit, try fallback model instead of retrying same model
                    if error_info.category == "rate_limit" and model_index < len(models_to_try) - 1:
                        logger.warning("Rate limit on %s stream, switching to fallback", model)
                        break  # Exit retry loop, continue to next model

                    if attempt < MAX_RETRIES:
                        delay = error_info.retry_after or (BASE_RETRY_DELAY * (2**attempt))
                        await asyncio.sleep(delay)
                    else:
                        raise
            else:
                continue  # Try next model

            # Successfully connected, now stream
            streamed_model = model
            try:
                async for chunk in response:
                    # Usage chunks arrive with empty choices — guard both access paths.
                    if chunk.choices:
                        delta = chunk.choices[0].delta
                        if delta.content:
                            yield delta.content
                    if getattr(chunk, "usage", None):
                        stream_usage = chunk.usage
                stream_outcome = "success"
                return  # Successfully completed streaming
            except Exception as exc:
                error_info = classify_error(exc)
                stream_error_category = error_info.category
                logger.error(
                    "Stream error [%s]: %s",
                    error_info.category,
                    error_info.message[:200],
                )
                # Mid-stream errors don't fallback - caller must handle
                raise

        # All models failed to connect
        raise RuntimeError(f"Stream connection failed after all models: {last_error.message}")
    finally:
        _record_llm_call(
            task_type=task_type,
            tier=tier,
            model=streamed_model,
            outcome=stream_outcome,
            duration=time.monotonic() - start_time,
            usage=stream_usage,
            error_category=stream_error_category,
        )


_MARKDOWN_CODE_RE = re.compile(r"^```(?:\w+)?\s*\n?(.*?)\n?\s*```$", re.DOTALL)


def parse_json_response(raw: str) -> dict:
    """Parse JSON from LLM response, handling markdown code blocks."""
    text = raw.strip()
    match = _MARKDOWN_CODE_RE.match(text)
    if match:
        text = match.group(1).strip()
    return json.loads(text)
