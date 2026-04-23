"""Tests for LLM error classification."""

import litellm
import pytest

from app.ai.errors import ErrorCategory, LLMErrorInfo, classify_error, format_error_for_frontend


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
        assert "message" in formatted
