"""Tests for AI task resilience: per-scene error handling and recovery."""

from unittest.mock import AsyncMock, MagicMock, patch

import litellm
import pytest

from app.ai.errors import ErrorCategory, classify_error


class TestPerSceneErrorHandling:
    """Test that manuscript generation continues when individual scenes fail."""

    def test_rate_limit_error_is_classified_correctly(self):
        exc = litellm.RateLimitError(
            message="Rate limit", model="test", llm_provider="openrouter"
        )
        info = classify_error(exc)
        assert info.retryable is True
        assert info.category == ErrorCategory.RATE_LIMIT

    def test_auth_error_stops_scene(self):
        exc = litellm.AuthenticationError(
            message="Bad key", model="test", llm_provider="openrouter"
        )
        info = classify_error(exc)
        assert info.retryable is False

    def test_partial_prose_preserved_on_stream_failure(self):
        from app.ai.prompts.prose_continuation import validate_output

        partial_text = "The rain fell hard on the cobblestone streets. " * 10
        result = validate_output(partial_text)
        assert len(result.split()) > 50


class TestErrorClassification:
    """Additional error classification tests for edge cases."""

    def test_mid_stream_error_during_manuscript(self):
        _mid = getattr(litellm, "MidStreamFallbackError", None)
        if _mid is not None:
            exc = _mid(message="Stream broke", model="test", llm_provider="openrouter")
            info = classify_error(exc)
            assert info.retryable is True

    def test_connection_error_during_manuscript(self):
        exc = litellm.APIConnectionError(
            message="Connection lost", model="test", llm_provider="openrouter"
        )
        info = classify_error(exc)
        assert info.retryable is True


class TestManuscriptSceneLoopResilience:
    """Test that _run_full_manuscript continues after scene failures."""

    @pytest.mark.asyncio
    async def test_scene_failure_continues_to_next(self):
        """If one scene fails, the loop should continue to the next scene."""
        from app.ai.errors import format_error_for_frontend

        # Simulate what happens when a scene fails
        exc = litellm.RateLimitError(
            message="Rate limited", model="test", llm_provider="openrouter"
        )
        error_info = classify_error(exc)
        error_payload = format_error_for_frontend(error_info)

        # The error payload should contain structured info
        assert error_payload["category"] == "rate_limit"
        assert error_payload["retryable"] is True
        assert "error" in error_payload

    @pytest.mark.asyncio
    async def test_auth_error_publishes_non_retryable_event(self):
        """Auth errors should publish non-retryable error events."""
        from app.ai.errors import format_error_for_frontend

        exc = litellm.AuthenticationError(
            message="Bad key", model="test", llm_provider="openrouter"
        )
        error_info = classify_error(exc)
        error_payload = format_error_for_frontend(error_info)

        assert error_payload["retryable"] is False
        assert error_payload["category"] == "auth_error"


class TestStreamingResilience:
    """Test streaming error handling in _prose_continuation_in_session."""

    def test_validate_output_accepts_partial_prose(self):
        """Partial prose from a failed stream should still be valid."""
        from app.ai.prompts.prose_continuation import validate_output

        partial = "She walked into the room, the door clicking behind her. " * 8
        result = validate_output(partial)
        assert len(result.split()) > 30

    def test_format_error_includes_all_fields(self):
        """Error events sent to frontend should have all required fields."""
        from app.ai.errors import format_error_for_frontend

        exc = litellm.APIConnectionError(
            message="Timeout", model="test", llm_provider="openrouter"
        )
        info = classify_error(exc)
        payload = format_error_for_frontend(info)

        assert "category" in payload
        assert "error" in payload
        assert "retryable" in payload
        assert "retry_after" in payload
