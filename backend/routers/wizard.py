import asyncio
import json
import os
import pathlib
import threading
import urllib.request

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter()

_EXPECTED_MODEL_BYTES = 220 * 1024 * 1024


def _models_dir() -> pathlib.Path:
    """Return the model storage directory, preferring D: drive via MODELS_DIR env var."""
    env_dir = os.environ.get("MODELS_DIR")
    if env_dir:
        return pathlib.Path(env_dir)
    appdata = os.environ.get("APPDATA", str(pathlib.Path.home()))
    return pathlib.Path(appdata) / "enhance-audio-pro" / "models" / "deepfilter"


@router.get("/wizard/status")
async def model_status() -> JSONResponse:
    d = _models_dir()
    installed = d.exists() and any(d.rglob("*.ckpt")) or any(d.rglob("*.pt")) if d.exists() else False
    # Also accept any file > 10 MB as a signal the model was downloaded
    if d.exists() and not installed:
        total = sum(f.stat().st_size for f in d.rglob("*") if f.is_file())
        installed = total > 10 * 1024 * 1024
    return JSONResponse({"installed": installed, "path": str(d)})


class DownloadRequest(BaseModel):
    callback_url: str


@router.post("/wizard/download")
async def start_download(req: DownloadRequest, background_tasks: BackgroundTasks) -> JSONResponse:
    background_tasks.add_task(_run_download, req.callback_url)
    return JSONResponse(status_code=202, content={"detail": "Download started."})


async def _run_download(callback_url: str) -> None:
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, lambda: _sync_download(callback_url))
    except Exception as exc:
        _report(callback_url, {"type": "error", "message": str(exc)})


def _sync_download(callback_url: str) -> None:
    models_dir = _models_dir()
    models_dir.mkdir(parents=True, exist_ok=True)

    os.environ["DFHOME"] = str(models_dir)
    os.environ["DF_HOME"] = str(models_dir)

    _report(callback_url, {"type": "progress", "percent": 5, "message": "Preparing model directory..."})
    _report(callback_url, {"type": "progress", "percent": 10, "message": f"Model path: {models_dir}"})
    _report(callback_url, {"type": "progress", "percent": 15, "message": "Initialising DeepFilterNet..."})

    from df.enhance import init_df  # noqa: PLC0415

    _report(callback_url, {"type": "progress", "percent": 20, "message": "Downloading AI model..."})

    stop_event = threading.Event()
    monitor = threading.Thread(
        target=_monitor_download,
        args=(models_dir, callback_url, stop_event),
        daemon=True,
    )
    monitor.start()

    try:
        init_df()
    finally:
        stop_event.set()
        monitor.join(timeout=3)

    _report(callback_url, {"type": "progress", "percent": 95, "message": "Finalising..."})
    _report(callback_url, {"type": "complete", "message": "Model ready."})


def _monitor_download(
    models_dir: pathlib.Path,
    callback_url: str,
    stop_event: threading.Event,
) -> None:
    while not stop_event.wait(1.0):
        try:
            total = sum(f.stat().st_size for f in models_dir.rglob("*") if f.is_file())
            if total > 0:
                fraction = min(total / _EXPECTED_MODEL_BYTES, 1.0)
                pct = int(20 + fraction * 70)
                mb = total // (1024 * 1024)
                _report(callback_url, {
                    "type": "progress",
                    "percent": pct,
                    "message": f"Downloading model... {mb} MB",
                })
        except Exception:
            pass


def _report(callback_url: str, payload: dict) -> None:
    try:
        data = json.dumps(payload).encode()
        req = urllib.request.Request(
            f"{callback_url}/callback/wizard",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5):
            pass
    except Exception:
        pass
