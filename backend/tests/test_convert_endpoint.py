import pytest
from routers.convert import apply_filename_template


def test_apply_filename_template_default():
    assert apply_filename_template("", "track", "mp3") == "track_converted"


def test_apply_filename_template_name_token():
    assert apply_filename_template("{name}_out", "track", "mp3") == "track_out"


def test_apply_filename_template_format_token():
    result = apply_filename_template("{name}.{format}", "voice", "wav")
    assert result == "voice.wav"


def test_apply_filename_template_date_token():
    from datetime import date
    result = apply_filename_template("{name}_{date}", "clip", "flac")
    assert date.today().isoformat() in result


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


@pytest.mark.anyio
async def test_convert_accepts_filename_template():
    from main import app
    from httpx import AsyncClient, ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/convert", json={
            "job_ids": ["test-job-1"],
            "callback_url": "http://127.0.0.1:9999",
            "filename_template": "{name}_{date}",
        })
    assert resp.status_code == 202
