"""LLM error classification and retry logic."""

from __future__ import annotations

import enum
import logging
from dataclasses import dataclass

import litellm

logger = logging.getLogger(__name__)


class ErrorCategory(enum.StrEnum):
    """Categories of LLM errors, used to decide retry behavior."""
    RATE_LIMIT = "rate_limit"
    TIMEOUT = "timeout"
    API_ERROR = "api_error"
    AUTH_ERROR = "auth_error"
    INVALID_OUTPUT = "invalid_output"
    UNKNOWN = "unknown"


class InvalidOutputError(ValueError):
    """Raised when LLM output fails validation (empty, too short, bad format)."""
    pass


@dataclass
class LLMErrorInfo:
    category: ErrorCategory
    message: str
    retryable: bool
    retry_after: int | None = None  # seconds, if provider tells us


def classify_error(exc: Exception) -> LLMErrorInfo:
    """Classify an LLM exception into a category and decide if it's retryable."""
    # Rate limit errors
    if isinstance(exc, litellm.RateLimitError):
        retry_after = _extract_retry_after(exc)
        return LLMErrorInfo(
            category=ErrorCategory.RATE_LIMIT,
            message=f"Rate limited by provider: {exc}",
            retryable=True,
            retry_after=retry_after,
        )

    # Timeout errors — litellm.Timeout only, not bare TimeoutError
    if isinstance(exc, litellm.Timeout):
        return LLMErrorInfo(
            category=ErrorCategory.TIMEOUT,
            message=f"LLM call timed out: {exc}",
            retryable=True,
            retry_after=5,
        )

    # Mid-stream fallback errors (rate limit during streaming)
    _mid_stream = getattr(litellm, "MidStreamFallbackError", None)
    if _mid_stream is not None and isinstance(exc, _mid_stream):
        return LLMErrorInfo(
            category=ErrorCategory.RATE_LIMIT,
            message=f"Stream interrupted (rate limit): {exc}",
            retryable=True,
            retry_after=10,
        )

    # API connection errors
    if isinstance(exc, (litellm.APIConnectionError, ConnectionError)):
        return LLMErrorInfo(
            category=ErrorCategory.API_ERROR,
            message=f"API connection failed: {exc}",
            retryable=True,
            retry_after=3,
        )

    # API errors (5xx from provider)
    if isinstance(exc, litellm.APIError):
        return LLMErrorInfo(
            category=ErrorCategory.API_ERROR,
            message=f"API error from provider: {exc}",
            retryable=True,
            retry_after=5,
        )

    # Auth errors (not retryable)
    if isinstance(exc, litellm.AuthenticationError):
        return LLMErrorInfo(
            category=ErrorCategory.AUTH_ERROR,
            message=f"Authentication error: {exc}",
            retryable=False,
        )

    # Invalid output from our own validation (not retryable)
    # Only catch our custom InvalidOutputError, not all ValueErrors
    if isinstance(exc, InvalidOutputError):
        return LLMErrorInfo(
            category=ErrorCategory.INVALID_OUTPUT,
            message=f"Invalid LLM output: {exc}",
            retryable=False,
        )

    # Unknown
    return LLMErrorInfo(
        category=ErrorCategory.UNKNOWN,
        message=f"Unknown error: {exc}",
        retryable=False,
    )


def _extract_retry_after(exc: Exception) -> int | None:
    """Extract retry-after seconds from exception if available."""
    retry_after = getattr(exc, "retry_after", None)
    if retry_after is not None:
        try:
            return int(retry_after)
        except (ValueError, TypeError):
            pass
    response = getattr(exc, "response", None)
    if response is not None:
        retry_after = response.headers.get("retry-after")
        if retry_after:
            try:
                return int(retry_after)
            except (ValueError, TypeError):
                pass
    return None


def format_error_for_frontend(error_info: LLMErrorInfo) -> dict:
    """Format error info for SSE event to frontend."""
    return {
        "category": error_info.category,
        "message": error_info.message,
        "retryable": error_info.retryable,
        "retry_after": error_info.retry_after,
    }
