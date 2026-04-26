"""Tests for LLM error classification."""

import litellm
import pytest

from app.ai.errors import (
    ErrorCategory,
    LLMErrorInfo,
    classify_error,
    format_error_for_frontend,
    safe_error_message,
)


class TestClassifyError:
    def test_rate_limit_error_is_retryable(self):
        exc = litellm.RateLimitError(
            message="Rate limit exceeded",
            model="test",
            llm_provider="openrouter",
        )
        info = classify_error(exc)
        assert info.category == ErrorCategory.RATE_LIMIT
        assert info.retryable is True

    def test_timeout_error_is_retryable(self):
        exc = litellm.Timeout(
            message="Request timed out",
            model="test",
            llm_provider="openrouter",
        )
        info = classify_error(exc)
        assert info.category == ErrorCategory.TIMEOUT
        assert info.retryable is True

    def test_api_connection_error_is_retryable(self):
        exc = litellm.APIConnectionError(
            message="Connection refused",
            model="test",
            llm_provider="openrouter",
        )
        info = classify_error(exc)
        assert info.category == ErrorCategory.API_ERROR
        assert info.retryable is True

    def test_api_error_is_retryable(self):
        exc = litellm.APIError(
            status_code=500,
            message="Internal server error",
            model="test",
            llm_provider="openrouter",
        )
        info = classify_error(exc)
        assert info.category == ErrorCategory.API_ERROR
        assert info.retryable is True

    def test_auth_error_is_not_retryable(self):
        exc = litellm.AuthenticationError(
            message="Invalid API key",
            model="test",
            llm_provider="openrouter",
        )
        info = classify_error(exc)
        assert info.category == ErrorCategory.AUTH_ERROR
        assert info.retryable is False

    def test_invalid_output_error_is_not_retryable(self):
        from app.ai.errors import InvalidOutputError
        exc = InvalidOutputError("Empty prose output")
        info = classify_error(exc)
        assert info.category == ErrorCategory.INVALID_OUTPUT
        assert info.retryable is False

    def test_generic_value_error_is_unknown(self):
        """Generic ValueError should not be misclassified as INVALID_OUTPUT."""
        exc = ValueError("Some unrelated error")
        info = classify_error(exc)
        assert info.category == ErrorCategory.UNKNOWN
        assert info.retryable is False

    def test_unknown_error_is_not_retryable(self):
        exc = RuntimeError("Something weird happened")
        info = classify_error(exc)
        assert info.category == ErrorCategory.UNKNOWN
        assert info.retryable is False

    def test_format_error_for_frontend(self):
        exc = litellm.RateLimitError(
            message="Rate limit exceeded",
            model="test",
            llm_provider="openrouter",
        )
        info = classify_error(exc)
        formatted = format_error_for_frontend(info)
        assert formatted["category"] == "rate_limit"
        assert formatted["retryable"] is True
        assert "error" in formatted
        # Must not leak raw exception text (e.g. provider names, original message).
        assert "openrouter" not in formatted["error"].lower()
        assert "rate limit exceeded" not in formatted["error"].lower()


class TestSafeErrorMessage:
    """safe_error_message must never leak raw Python internals to users."""

    def test_short_intentional_value_error_passes_through(self):
        # Service-level validation messages stay readable.
        assert safe_error_message(ValueError("Beat 5 not in scene")) == "Beat 5 not in scene"

    def test_python_class_repr_is_sanitized(self):
        msg = safe_error_message(ValueError("<class 'int'> not iterable"))
        assert "class" not in msg

    def test_keyerror_does_not_leak_key(self):
        msg = safe_error_message(KeyError("user_id"))
        assert "user_id" not in msg
        assert msg == "Something went wrong. Please try again."

    def test_attribute_error_is_sanitized(self):
        msg = safe_error_message(AttributeError("'NoneType' object has no attribute 'foo'"))
        assert "NoneType" not in msg
        assert "foo" not in msg

    def test_type_error_is_sanitized(self):
        msg = safe_error_message(TypeError("unsupported operand type(s) for +"))
        assert "operand" not in msg

    def test_database_errors_get_friendly_message(self):
        from sqlalchemy.exc import OperationalError
        msg = safe_error_message(OperationalError("SELECT 1", {}, Exception("conn refused")))
        assert "database" in msg.lower()
        assert "SELECT" not in msg

    def test_network_errors_get_friendly_message(self):
        msg = safe_error_message(ConnectionRefusedError("Connection refused"))
        assert "network" in msg.lower()

    def test_oserror_gets_friendly_message(self):
        # Python auto-promotes OSError(2, ...) to FileNotFoundError; both should be sanitized.
        msg = safe_error_message(OSError(2, "Permission denied"))
        assert "errno" not in msg.lower()

    def test_litellm_rate_limit_message(self):
        exc = litellm.RateLimitError(
            message="Rate limit exceeded for openai/gpt-5",
            model="gpt-5",
            llm_provider="openai",
        )
        msg = safe_error_message(exc)
        assert "openai" not in msg.lower()
        assert "gpt-5" not in msg
        assert "rate" in msg.lower()

    def test_litellm_auth_error_does_not_leak_key(self):
        exc = litellm.AuthenticationError(
            message="Invalid API key sk-abc123",
            model="gpt-5",
            llm_provider="openai",
        )
        msg = safe_error_message(exc)
        assert "sk-abc123" not in msg
        assert "key" not in msg.lower() or "credentials" in msg.lower()

    def test_traceback_string_is_sanitized(self):
        msg = safe_error_message(RuntimeError('boom\n  File "/app/foo.py", line 5'))
        assert "/app" not in msg
        assert "\n" not in msg

    def test_sql_fragment_is_sanitized(self):
        msg = safe_error_message(RuntimeError("syntax error near INSERT INTO users VALUES"))
        assert "INSERT" not in msg
        assert "VALUES" not in msg

    def test_long_message_is_sanitized(self):
        msg = safe_error_message(ValueError("x" * 250))
        assert len(msg) < 100  # generic fallback is short
