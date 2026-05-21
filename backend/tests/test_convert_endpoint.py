import pytest


@pytest.mark.anyio
async def test_convert_returns_202():
    from main import app
    from httpx import AsyncClient, ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/convert", json={
            "job_ids": ["test-job-1"],
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.status_code == 202


@pytest.mark.anyio
async def test_convert_returns_processing_started_detail():
    from main import app
    from httpx import AsyncClient, ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/convert", json={
            "job_ids": ["test-job-1"],
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.json()["detail"] == "Processing started."


@pytest.mark.anyio
async def test_convert_with_empty_job_ids_returns_202():
    from main import app
    from httpx import AsyncClient, ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/convert", json={
            "job_ids": [],
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.status_code == 202
