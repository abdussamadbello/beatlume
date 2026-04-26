"""Tests for refresh-token jti revocation logic.

Uses a fake in-memory Redis-shaped object so tests don't depend on a running
Redis server. We swap the module-level _redis_client for the duration.
"""

from __future__ import annotations

import time
import uuid

import pytest

from app.services import auth as auth_service


class FakeRedis:
    """Minimal Redis stand-in: keys with optional TTL."""

    def __init__(self) -> None:
        self.store: dict[str, tuple[str, float | None]] = {}
        self.fail_mode: str | None = None  # "all" | None

    def set(self, key: str, value: str, ex: int | None = None) -> None:
        if self.fail_mode == "all":
            raise ConnectionError("simulated outage")
        expire_at = time.time() + ex if ex else None
        self.store[key] = (value, expire_at)

    def exists(self, key: str) -> int:
        if self.fail_mode == "all":
            raise ConnectionError("simulated outage")
        rec = self.store.get(key)
        if rec is None:
            return 0
        _, expire_at = rec
        if expire_at and time.time() > expire_at:
            del self.store[key]
            return 0
        return 1


@pytest.fixture
def fake_redis(monkeypatch):
    """Replace the module's redis client with a fake; restore after test."""
    fake = FakeRedis()
    monkeypatch.setattr(auth_service, "_redis_client", fake)
    return fake


def test_revoke_jti_marks_as_revoked(fake_redis):
    jti = "test-jti-123"
    auth_service.revoke_jti(jti, ttl_seconds=60)
    assert auth_service.is_jti_revoked(jti) is True


def test_unknown_jti_is_not_revoked(fake_redis):
    assert auth_service.is_jti_revoked("never-seen") is False


def test_revoke_jti_ignored_when_already_expired_ttl(fake_redis):
    """ttl_seconds <= 0 means the token is already past exp — no need to track."""
    auth_service.revoke_jti("some-jti", ttl_seconds=0)
    assert auth_service.is_jti_revoked("some-jti") is False
    auth_service.revoke_jti("another-jti", ttl_seconds=-5)
    assert auth_service.is_jti_revoked("another-jti") is False


def test_revoke_jti_survives_redis_outage(fake_redis, caplog):
    """If Redis is down, revoke_jti must not raise — logout/refresh keep working."""
    fake_redis.fail_mode = "all"
    # Should not raise
    auth_service.revoke_jti("jti-during-outage", ttl_seconds=60)


def test_is_jti_revoked_fails_open_on_outage(fake_redis):
    """If Redis is unreachable when checking, allow the token through. The JWT
    expiry remains the second line of defense; better than locking everyone out."""
    fake_redis.fail_mode = "all"
    assert auth_service.is_jti_revoked("any-jti") is False


def test_revoked_jti_expires_with_ttl(fake_redis, monkeypatch):
    """Revocation entries clean themselves up via TTL — set bounded automatically."""
    auth_service.revoke_jti("short-lived", ttl_seconds=1)
    assert auth_service.is_jti_revoked("short-lived") is True
    # Fast-forward time beyond TTL
    monkeypatch.setattr(time, "time", lambda: time.time() + 5)
    assert auth_service.is_jti_revoked("short-lived") is False


def test_create_refresh_token_includes_jti():
    """Every refresh token must carry a jti — that's what revocation keys off."""
    token = auth_service.create_refresh_token(uuid.uuid4(), uuid.uuid4())
    payload = auth_service.decode_token(token)
    assert "jti" in payload
    assert isinstance(payload["jti"], str)
    assert len(payload["jti"]) > 0


def test_create_refresh_token_jti_is_unique():
    """Two refreshes should never share a jti — replay detection depends on this."""
    user_id = uuid.uuid4()
    org_id = uuid.uuid4()
    t1 = auth_service.create_refresh_token(user_id, org_id)
    t2 = auth_service.create_refresh_token(user_id, org_id)
    p1 = auth_service.decode_token(t1)
    p2 = auth_service.decode_token(t2)
    assert p1["jti"] != p2["jti"]
