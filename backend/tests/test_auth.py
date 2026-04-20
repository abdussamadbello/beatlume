import pytest


@pytest.mark.asyncio
async def test_signup_creates_user(client):
    resp = await client.post("/auth/signup", json={
        "name": "Ada Lovelace",
        "email": "ada@example.com",
        "password": "securepass123",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_signup_duplicate_email(client):
    await client.post("/auth/signup", json={
        "name": "Ada", "email": "dup@example.com", "password": "pass1234",
    })
    resp = await client.post("/auth/signup", json={
        "name": "Ada2", "email": "dup@example.com", "password": "pass4567",
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_login_valid(client):
    await client.post("/auth/signup", json={
        "name": "Ada", "email": "login@example.com", "password": "pass1234",
    })
    resp = await client.post("/auth/login", json={
        "email": "login@example.com", "password": "pass1234",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await client.post("/auth/signup", json={
        "name": "Ada", "email": "wrong@example.com", "password": "pass1234",
    })
    resp = await client.post("/auth/login", json={
        "email": "wrong@example.com", "password": "wrongpass",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_email(client):
    resp = await client.post("/auth/login", json={
        "email": "nobody@example.com", "password": "pass1234",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me_authenticated(client):
    signup = await client.post("/auth/signup", json={
        "name": "Ada", "email": "me@example.com", "password": "pass1234",
    })
    token = signup.json()["access_token"]
    resp = await client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "me@example.com"
    assert data["name"] == "Ada"
    assert data["plan"] == "free"


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client):
    resp = await client.get("/api/users/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_me(client):
    signup = await client.post("/auth/signup", json={
        "name": "Ada", "email": "update@example.com", "password": "pass1234",
    })
    token = signup.json()["access_token"]
    resp = await client.put(
        "/api/users/me",
        json={"name": "Ada Lovelace"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Ada Lovelace"


@pytest.mark.asyncio
async def test_get_my_organizations(client):
    signup = await client.post("/auth/signup", json={
        "name": "Ada", "email": "orgs@example.com", "password": "pass1234",
    })
    token = signup.json()["access_token"]
    resp = await client.get(
        "/api/users/me/organizations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    orgs = resp.json()
    assert len(orgs) == 1
    assert "Ada" in orgs[0]["name"]


@pytest.mark.asyncio
async def test_logout(client):
    resp = await client.post("/auth/logout")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_forgot_password(client):
    resp = await client.post("/auth/forgot-password", json={"email": "any@example.com"})
    assert resp.status_code == 200
    assert "reset link" in resp.json()["message"].lower()
