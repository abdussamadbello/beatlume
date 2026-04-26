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
    """Format error info for SSE event to frontend.

    Note: error_info.message contains raw exception text useful for logs but unsafe
    for users. The user-facing string is keyed under "error" and looked up from the
    safe-messages table by category.
    """
    return {
        "category": error_info.category,
        "error": _SAFE_MESSAGES_BY_CATEGORY.get(error_info.category, _GENERIC_FALLBACK),
        "retryable": error_info.retryable,
        "retry_after": error_info.retry_after,
    }


_SAFE_MESSAGES_BY_CATEGORY = {
    ErrorCategory.RATE_LIMIT: "The AI provider is rate-limiting requests. Please wait a moment and try again.",
    ErrorCategory.TIMEOUT: "The AI request timed out. Please try again.",
    ErrorCategory.AUTH_ERROR: "The AI provider rejected our credentials. Please contact support.",
    ErrorCategory.API_ERROR: "The AI provider had a temporary issue. Please try again.",
    ErrorCategory.INVALID_OUTPUT: "The AI returned an unusable response. Please try again.",
    ErrorCategory.UNKNOWN: "Something went wrong. Please try again.",
}

_GENERIC_FALLBACK = _SAFE_MESSAGES_BY_CATEGORY[ErrorCategory.UNKNOWN]
_DATABASE_FALLBACK = "We had trouble reaching the database. Please try again."
_STORAGE_FALLBACK = "File storage is temporarily unavailable. Please try again."
_NETWORK_FALLBACK = "A network problem interrupted the request. Please try again."
_WORKER_FALLBACK = "The background worker had a problem completing this task. Please try again."

# Substrings whose presence means a string is leaking Python internals.
# Any match → drop the message and use the generic fallback.
_PYTHONIC_NEEDLES = (
    "Traceback",
    "object at 0x",
    "psycopg",
    "asyncio",
    "sqlalchemy",
    "AttributeError",
    "KeyError",
    "TypeError",
    "RuntimeError",
    "OperationalError",
    "IntegrityError",
    "/site-packages/",
    "File \"",
    "<class '",
    "litellm.",
)


def _looks_user_facing(msg: str) -> bool:
    """Heuristic: does this string look like an intentional user message?

    Intentional service-level errors (like ValueError("Beat 5 not found")) are
    short, single-line, no file paths, no class reprs. Anything failing these
    checks is treated as accidental Python leakage.
    """
    if not msg:
        return False
    if len(msg) > 200 or "\n" in msg or "\t" in msg:
        return False
    if any(needle in msg for needle in _PYTHONIC_NEEDLES):
        return False
    # SQL fragments
    upper = msg.upper()
    if any(kw in upper for kw in (" INSERT ", " SELECT ", " UPDATE ", " DELETE ", " VALUES ", " WHERE ")):
        return False
    return True


def _classify_non_llm(exc: Exception) -> str | None:
    """Return a safe message for known non-LLM error families, or None if unrecognized."""
    cls_name = exc.__class__.__name__

    # Database errors (SQLAlchemy / DB-API) — import lazily so this module stays cheap to load.
    try:
        from sqlalchemy.exc import SQLAlchemyError
        if isinstance(exc, SQLAlchemyError):
            return _DATABASE_FALLBACK
    except ImportError:
        pass

    # boto / S3 / storage errors. Match by class name to avoid hard dependency.
    if cls_name in {"ClientError", "EndpointConnectionError", "BotoCoreError", "NoCredentialsError", "S3UploadFailedError"}:
        return _STORAGE_FALLBACK

    # Generic network / connection errors at the stdlib level. Check stdlib classes BEFORE the
    # LLM classifier (in safe_error_message) because litellm treats stdlib ConnectionError as
    # an API error — that's correct for litellm calls, wrong for DB/Redis/socket failures.
    if isinstance(exc, (ConnectionError, TimeoutError, OSError)):
        return _NETWORK_FALLBACK

    # Celery-specific worker failures (lazy import; do not require celery to read this module in tests).
    try:
        from celery.exceptions import CeleryError, WorkerLostError, SoftTimeLimitExceeded, TimeLimitExceeded
        if isinstance(exc, (WorkerLostError, SoftTimeLimitExceeded, TimeLimitExceeded)):
            return _WORKER_FALLBACK
        if isinstance(exc, CeleryError):
            return _WORKER_FALLBACK
    except ImportError:
        pass

    # Plain Python error classes whose str() leaks internals (KeyError yields just the quoted
    # key; AttributeError yields "'X' object has no attribute 'y'"). These are accidental, not user-facing.
    if cls_name in {
        "KeyError",
        "AttributeError",
        "TypeError",
        "IndexError",
        "NameError",
        "UnboundLocalError",
        "ZeroDivisionError",
        "RecursionError",
        "AssertionError",
    }:
        return _GENERIC_FALLBACK

    return None


def safe_error_message(exc: Exception) -> str:
    """Return a user-safe error message for any exception.

    Order of resolution:
      1. litellm-specific exception types — handled by classify_error and most specific.
      2. Known non-LLM families (DB, storage, network, worker, plain-Python) — recognized
         by class. Runs BEFORE the broader LLM classifier so stdlib ConnectionError isn't
         misattributed to "AI provider issue."
      3. Remaining LLM category match (covers anything classify_error caught that wasn't
         already handled above).
      4. Heuristic pass-through — short, clean ValueError-style messages from services
         that intentionally raise human-readable text.
      5. Generic fallback — for anything that looks like raw Python.

    The original exception is still available in logs; callers should keep their
    logger.exception() calls. This function only governs what the *user* sees.
    """
    # Step 1: litellm-specific classes (matched by class hierarchy, not stdlib aliases).
    if any(
        isinstance(exc, getattr(litellm, name, type(None)))
        for name in ("RateLimitError", "Timeout", "AuthenticationError", "APIError")
    ):
        info = classify_error(exc)
        if info.category != ErrorCategory.UNKNOWN:
            return _SAFE_MESSAGES_BY_CATEGORY[info.category]

    # Step 2: known non-LLM families.
    non_llm = _classify_non_llm(exc)
    if non_llm is not None:
        return non_llm

    # Step 3: catch-all LLM classifier (e.g. InvalidOutputError, anything stdlib-like that
    # litellm treats as a recognized category).
    info = classify_error(exc)
    if info.category != ErrorCategory.UNKNOWN:
        return _SAFE_MESSAGES_BY_CATEGORY[info.category]

    # Step 4: heuristic pass-through.
    msg = str(exc).strip()
    if _looks_user_facing(msg):
        return msg

    return _GENERIC_FALLBACK
