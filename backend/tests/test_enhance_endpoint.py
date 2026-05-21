import pytest
from httpx import AsyncClient, ASGITransport


async def test_enhance_returns_202():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/enhance", json={
            "job_ids": ["test-job-1"],
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.status_code == 202


async def test_enhance_returns_processing_started_detail():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/enhance", json={
            "job_ids": ["test-job-1"],
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.json()["detail"] == "Processing started."


async def test_enhance_with_empty_job_ids_returns_202():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/enhance", json={
            "job_ids": [],
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.status_code == 202
