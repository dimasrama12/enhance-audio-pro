from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from fastapi import FastAPI
    from routers.manipulate import router
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_manipulate_returns_202(client):
    with patch("routers.manipulate._process_manipulate", new_callable=AsyncMock):
        resp = client.post("/manipulate", json={
            "job_id": "abc",
            "operation": "trim",
            "params": {"start_sec": 0, "end_sec": 10},
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.status_code == 202


def test_merge_returns_400_for_single_file(client):
    resp = client.post("/merge", json={
        "job_ids": ["only_one"],
        "crossfade_sec": 0.0,
        "callback_url": "http://127.0.0.1:9999",
    })
    assert resp.status_code == 400


def test_merge_returns_202_for_two_files(client):
    with patch("routers.manipulate._process_merge", new_callable=AsyncMock):
        resp = client.post("/merge", json={
            "job_ids": ["id1", "id2"],
            "crossfade_sec": 0.0,
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.status_code == 202


def test_loop_returns_202(client):
    with patch("routers.manipulate._process_loop", new_callable=AsyncMock):
        resp = client.post("/loop", json={
            "job_id": "abc",
            "target_duration_sec": 3600.0,
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.status_code == 202


def test_eq_returns_400_for_wrong_band_count(client):
    resp = client.post("/eq", json={
        "job_id": "abc",
        "gains": [0, 0, 0],
        "callback_url": "http://127.0.0.1:9999",
    })
    assert resp.status_code == 400


def test_eq_returns_202_for_correct_band_count(client):
    with patch("routers.manipulate._process_eq", new_callable=AsyncMock):
        resp = client.post("/eq", json={
            "job_id": "abc",
            "gains": [0] * 11,
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.status_code == 202
