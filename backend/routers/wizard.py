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

# DeepFilterNet3 total model size (~220 MB); used to scale 20-90% progress band
_EXPECTED_MODEL_BYTES = 220 * 1024 * 1024


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
    appdata = os.environ.get("APPDATA", str(pathlib.Path.home()))
    models_dir = pathlib.Path(appdata) / "enhance-audio-pro" / "models" / "deepfilter"
    models_dir.mkdir(parents=True, exist_ok=True)

    # Set both env var names used across DeepFilterNet versions
    os.environ["DFHOME"] = str(models_dir)
    os.environ["DF_HOME"] = str(models_dir)

    _report(callback_url, {"type": "progress", "percent": 5, "message": "Preparing model directory..."})
    _report(callback_url, {"type": "progress", "percent": 10, "message": "Initialising DeepFilterNet..."})

    from df.enhance import init_df  # noqa: PLC0415

    _report(callback_url, {"type": "progress", "percent": 20, "message": "Downloading AI model..."})

    # Monitor file growth inside models_dir while init_df() downloads the weights.
    # This provides smooth 20-90% progress rather than a frozen bar.
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
    """Poll models_dir every second; emit progress in the 20-90% band."""
    while not stop_event.wait(1.0):
        try:
            total = sum(f.stat().st_size for f in models_dir.rglob("*") if f.is_file())
            if total > 0:
                fraction = min(total / _EXPECTED_MODEL_BYTES, 1.0)
                pct = int(20 + fraction * 70)  # maps 0→1 onto 20→90
                mb = total // (1024 * 1024)
                _report(callback_url, {
                    "type": "progress",
                    "percent": pct,
                    "message": f"Downloading model... {mb} MB",
                })
        except Exception:
            pass


def _report(callback_url: str, payload: dict) -> None:
    """POST a progress payload using stdlib urllib — no httpx dependency."""
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
