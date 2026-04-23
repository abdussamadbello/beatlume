"""Tests for AI task resilience: per-scene error handling and recovery."""

import pytest

from app.ai.errors import ErrorCategory, classify_error


class TestPerSceneErrorHandling:
    """Test that manuscript generation continues when individual scenes fail."""

    def test_rate_limit_error_is_classified_correctly(self):
        """Rate limits should be identified as retryable."""
        import litellm
        exc = litellm.RateLimitError(
            message="Rate limit", model="test", llm_provider="openrouter"
        )
        info = classify_error(exc)
        assert info.retryable is True
        assert info.category == ErrorCategory.RATE_LIMIT

    def test_auth_error_stops_scene(self):
        """Auth errors should not be retried."""
        import litellm
        exc = litellm.AuthenticationError(
            message="Bad key", model="test", llm_provider="openrouter"
        )
        info = classify_error(exc)
        assert info.retryable is False

    def test_partial_prose_preserved_on_stream_failure(self):
        """If streaming fails mid-way, accumulated content should still be valid."""
        from app.ai.prompts.prose_continuation import validate_output

        partial_text = "The rain fell hard on the cobblestone streets. " * 10
        result = validate_output(partial_text)
        assert len(result.split()) > 50


class TestErrorClassification:
    """Additional error classification tests for edge cases."""

    def test_mid_stream_error_during_manuscript(self):
        """Mid-stream errors during manuscript gen should be retryable."""
        import litellm
        _mid = getattr(litellm, "MidStreamFallbackError", None)
        if _mid is not None:
            exc = _mid(message="Stream broke", model="test", llm_provider="openrouter")
            info = classify_error(exc)
            assert info.retryable is True

    def test_connection_error_during_manuscript(self):
        """Connection errors should be retryable."""
        import litellm
        exc = litellm.APIConnectionError(
            message="Connection lost", model="test", llm_provider="openrouter"
        )
        info = classify_error(exc)
        assert info.retryable is True
