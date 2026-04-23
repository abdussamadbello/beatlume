"""Integration test: export flow simulation."""
import pytest


@pytest.mark.asyncio
async def test_export_flow(client, auth_headers):
    """Complete export flow through all formats."""
    story_resp = await client.post("/api/stories", json={
        "title": "Export Test",
        "genres": ["Literary"],
    }, headers=auth_headers)
    assert story_resp.status_code == 201
    story_id = story_resp.json()["id"]

    settings = [
        {"key": "Title", "value": "Export Test"},
        {"key": "Author", "value": "Test Author"},
        {"key": "Genre", "value": "Literary"},
    ]
    for s in settings:
        await client.post(
            f"/api/stories/{story_id}/core-settings",
            json=s,
            headers=auth_headers,
        )

    pdf_resp = await client.post(
        f"/api/stories/{story_id}/export",
        json={"format": "pdf"},
        headers=auth_headers,
    )
    assert pdf_resp.status_code == 202
    pdf_job_id = pdf_resp.json()["job_id"]
    assert pdf_job_id

    docx_resp = await client.post(
        f"/api/stories/{story_id}/export",
        json={"format": "docx"},
        headers=auth_headers,
    )
    assert docx_resp.status_code == 202
    assert docx_resp.json()["job_id"]

    epub_resp = await client.post(
        f"/api/stories/{story_id}/export",
        json={"format": "epub"},
        headers=auth_headers,
    )
    assert epub_resp.status_code == 202
    assert epub_resp.json()["job_id"]

    txt_resp = await client.post(
        f"/api/stories/{story_id}/export",
        json={"format": "plaintext"},
        headers=auth_headers,
    )
    assert txt_resp.status_code == 202
    assert txt_resp.json()["job_id"]


@pytest.mark.asyncio
async def test_export_invalid_format_returns_400(client, auth_headers):
    """Export with invalid format returns 400."""
    story_resp = await client.post("/api/stories", json={"title": "Test"}, headers=auth_headers)
    story_id = story_resp.json()["id"]

    resp = await client.post(
        f"/api/stories/{story_id}/export",
        json={"format": "html"},
        headers=auth_headers,
    )
    assert resp.status_code == 400
