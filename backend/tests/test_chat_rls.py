"""RLS isolation test for chat_threads.

IMPORTANT: The beatlume DB role is a SUPERUSER with BYPASSRLS=true.
Even with FORCE ROW LEVEL SECURITY on the tables, RLS is bypassed for
this role because PostgreSQL's BYPASSRLS attribute supersedes FORCE RLS.

To test actual policy enforcement we use SET LOCAL ROLE to switch to the
'beatlume_rls_tester' role (NOSUPERUSER, NOBYPASSRLS) for the isolation
query.  This role is created by the db_engine fixture in conftest.py after
each alembic upgrade.

Production concern: if the app connects as a BYPASSRLS superuser, RLS
policies on ALL tables (not just chat tables) are silently bypassed.  This
should be fixed by creating a non-superuser application role for production.
"""
import pytest
from sqlalchemy import text

from app.models.chat_thread import ChatThread
from tests.conftest import RLS_TEST_ROLE


@pytest.fixture
async def second_org(db_session):
    """A second Organization for cross-org isolation tests."""
    from app.models.user import Organization
    org = Organization(name="Second Org", slug="second-org")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)
    return org


@pytest.mark.asyncio
async def test_chat_threads_rls_isolates_by_org(db_session, sample_org, second_org, sample_story):
    """Verify cross-org isolation on chat_threads.

    Uses SET LOCAL ROLE to switch to a non-bypassrls role for the isolation
    query.  Without this workaround the beatlume superuser bypasses RLS policies
    even with FORCE ROW LEVEL SECURITY enabled.
    """
    sample_org_id = str(sample_org.id)
    second_org_id = str(second_org.id)

    # Insert a thread under sample_org.  The beatlume superuser bypasses RLS on
    # the INSERT check (FORCE RLS does not override BYPASSRLS) so no SET LOCAL needed.
    thread = ChatThread(org_id=sample_org.id, story_id=sample_story.id)
    db_session.add(thread)
    await db_session.commit()

    # Switch to the non-privileged test role so RLS is enforced for subsequent queries.
    # SET LOCAL ROLE and SET LOCAL app.current_org_id are both transaction-scoped.
    await db_session.execute(text(f"SET LOCAL ROLE {RLS_TEST_ROLE}"))

    # Query as second_org — the thread from sample_org must be invisible.
    await db_session.execute(text(f"SET LOCAL app.current_org_id = '{second_org_id}'"))
    rows = (await db_session.execute(text("SELECT id FROM chat_threads"))).all()
    assert all(r[0] != thread.id for r in rows), (
        "RLS isolation failed: chat_thread from sample_org is visible when querying as second_org. "
        f"Ensure FORCE ROW LEVEL SECURITY is enabled and {RLS_TEST_ROLE} does not have BYPASSRLS."
    )

    # Query as sample_org — the thread must now be visible.
    await db_session.execute(text(f"SET LOCAL app.current_org_id = '{sample_org_id}'"))
    rows = (await db_session.execute(text("SELECT id FROM chat_threads"))).all()
    assert any(r[0] == thread.id for r in rows), (
        "RLS isolation failed: chat_thread from sample_org is NOT visible when querying as sample_org."
    )
