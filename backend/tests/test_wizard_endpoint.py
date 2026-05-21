import pytest
from httpx import AsyncClient, ASGITransport


async def test_wizard_download_returns_202():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/wizard/download", json={"callback_url": "http://127.0.0.1:9999"}
        )
    assert resp.status_code == 202


async def test_wizard_download_returns_download_started_detail():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/wizard/download", json={"callback_url": "http://127.0.0.1:9999"}
        )
    assert resp.json()["detail"] == "Download started."
