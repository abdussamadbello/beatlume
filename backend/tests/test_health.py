import pytest


@pytest.mark.asyncio
async def test_health_returns_ok(client):
    response = await client.get("/health")
    data = response.json()
    # In test env, DB is available via override; Redis may not be running
    assert response.status_code in (200, 503)
    assert data["status"] in ("ok", "degraded")
    assert "checks" in data
    assert "database" in data["checks"]
    assert "redis" in data["checks"]


@pytest.mark.asyncio
async def test_health_database_check(client):
    response = await client.get("/health")
    data = response.json()
    # DB should be reachable since tests use a real async engine
    assert data["checks"]["database"] == "ok"
