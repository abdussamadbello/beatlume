import asyncio

import pytest
from alembic.config import Config
from alembic import command
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import text

from app.config import settings
from app.deps import get_db
from app.main import create_app
from app.models.user import Organization
from app.models.story import Story

# Non-superuser, non-bypassrls role used for RLS isolation tests.
# The beatlume role is a superuser (rolbypassrls=t) and bypasses all RLS
# policies.  Tests that need real policy enforcement switch to this role
# via SET LOCAL ROLE.
RLS_TEST_ROLE = "beatlume_rls_tester"


def _alembic_upgrade() -> None:
    """Run all migrations against the configured database (sync, via Alembic)."""
    cfg = Config("alembic.ini")
    command.upgrade(cfg, "head")


def _ensure_rls_test_role() -> None:
    """Create a non-privileged Postgres role for RLS policy testing.

    This role has NOSUPERUSER and NOBYPASSRLS so RLS policies are enforced
    when queries run under it.  Tables are granted each time because the
    schema is dropped and recreated per test run.
    """
    import psycopg2

    sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    conn = psycopg2.connect(sync_url)
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(
            f"DO $$ BEGIN "
            f"  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='{RLS_TEST_ROLE}') THEN "
            f"    CREATE ROLE {RLS_TEST_ROLE} NOSUPERUSER NOBYPASSRLS NOINHERIT LOGIN PASSWORD 'rls_test_only'; "
            f"  END IF; "
            f"END $$"
        )
        cur.execute(f"GRANT ALL ON SCHEMA public TO {RLS_TEST_ROLE}")
        cur.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {RLS_TEST_ROLE}")
        cur.execute(f"GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO {RLS_TEST_ROLE}")
    conn.close()


def _alembic_drop_schema() -> None:
    """Tear down by dropping and recreating the public schema.

    Using DROP SCHEMA ... CASCADE is more reliable than 'alembic downgrade base'
    because the initial migration's downgrade does not drop enum types, which
    causes DuplicateObject errors on the next upgrade run.
    """
    import psycopg2

    sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    conn = psycopg2.connect(sync_url)
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("DROP SCHEMA public CASCADE")
        cur.execute("CREATE SCHEMA public")
        cur.execute("GRANT ALL ON SCHEMA public TO PUBLIC")
    conn.close()


@pytest.fixture
async def db_engine():
    # Run migrations (sync) from an async fixture via asyncio.to_thread.
    await asyncio.to_thread(_alembic_upgrade)
    # Ensure the non-privileged RLS test role exists and has table access.
    await asyncio.to_thread(_ensure_rls_test_role)
    engine = create_async_engine(settings.database_url, echo=False)
    yield engine
    await engine.dispose()
    await asyncio.to_thread(_alembic_drop_schema)


@pytest.fixture
async def db_session(db_engine):
    session_factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session


@pytest.fixture
async def sample_org(db_session):
    org = Organization(name="Test Org", slug="test-org")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)
    return org


@pytest.fixture
async def sample_story(db_session, sample_org):
    story = Story(org_id=sample_org.id, title="Test Story")
    db_session.add(story)
    await db_session.commit()
    await db_session.refresh(story)
    return story


@pytest.fixture
def app(db_session):
    application = create_app()

    async def override_get_db():
        yield db_session

    application.dependency_overrides[get_db] = override_get_db

    # Disable rate limiting in tests
    from app.api.auth import limiter as auth_limiter
    auth_limiter.enabled = False
    application.state.limiter.enabled = False

    return application


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


import uuid as _uuid


@pytest.fixture
async def auth_token(client):
    suffix = _uuid.uuid4().hex[:8]
    resp = await client.post("/auth/signup", json={
        "name": "Test User",
        "email": f"test-{suffix}@example.com",
        "password": "pass1234",
    })
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["access_token"]


@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
async def second_org_auth_token(client):
    suffix = _uuid.uuid4().hex[:8]
    resp = await client.post("/auth/signup", json={
        "name": "Second User",
        "email": f"second-{suffix}@example.com",
        "password": "pass1234",
    })
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["access_token"]


@pytest.fixture
def second_org_auth_headers(second_org_auth_token):
    return {"Authorization": f"Bearer {second_org_auth_token}"}
