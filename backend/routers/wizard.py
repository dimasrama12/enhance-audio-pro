import asyncio
import os
import pathlib

import httpx
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter()


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
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    f"{callback_url}/callback/wizard",
                    json={"event": "error", "message": str(exc)},
                )
        except Exception:
            pass


def _sync_download(callback_url: str) -> None:
    appdata = os.environ.get("APPDATA", str(pathlib.Path.home()))
    models_dir = (
        pathlib.Path(appdata) / "enhance-audio-pro" / "models" / "deepfilter"
    )
    models_dir.mkdir(parents=True, exist_ok=True)

    _report(callback_url, {"event": "progress", "percent": 5, "message": "Starting model download..."})

    os.environ.setdefault("DFHOME", str(models_dir))

    _report(callback_url, {"event": "progress", "percent": 20, "message": "Initialising DeepFilterNet..."})

    from df.enhance import init_df

    _report(callback_url, {"event": "progress", "percent": 50, "message": "Loading model weights..."})

    init_df()

    _report(callback_url, {"event": "progress", "percent": 95, "message": "Finalising..."})
    _report(callback_url, {"event": "complete", "message": "Model ready."})


def _report(callback_url: str, payload: dict) -> None:
    try:
        httpx.post(f"{callback_url}/callback/wizard", json=payload, timeout=5)
    except Exception:
        pass
