import asyncio
import os
import pathlib
import sqlite3
from typing import List

import httpx
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from processors.enhance_speech import enhance_file

router = APIRouter()


class EnhanceRequest(BaseModel):
    job_ids: List[str]
    callback_url: str
    strength: float = 1.0


@router.post("/enhance")
async def enhance_jobs(
    req: EnhanceRequest, background_tasks: BackgroundTasks
) -> JSONResponse:
    if req.job_ids:
        background_tasks.add_task(_process_jobs, req.job_ids, req.callback_url, req.strength)
    return JSONResponse(status_code=202, content={"detail": "Processing started."})


async def _process_jobs(job_ids: List[str], callback_url: str, strength: float = 1.0) -> None:
    loop = asyncio.get_running_loop()

    db_path_env = os.environ.get("DATABASE_PATH")
    if db_path_env:
        db_path = pathlib.Path(db_path_env)
    else:
        appdata = os.environ.get("APPDATA", str(pathlib.Path.home()))
        db_path = pathlib.Path(appdata) / "enhance-audio-pro" / "app.db"

    for job_id in job_ids:
        try:
            conn = sqlite3.connect(str(db_path))
            row = conn.execute(
                "SELECT filepath, destination, filename FROM queue_jobs WHERE id = ?",
                (job_id,),
            ).fetchone()
            conn.close()

            if row is None:
                continue

            filepath, destination, filename = row
            stem = pathlib.Path(filename).stem
            suffix = pathlib.Path(filename).suffix
            out_dir = (
                pathlib.Path(destination)
                if destination
                else pathlib.Path(filepath).parent
            )
            out_dir.mkdir(parents=True, exist_ok=True)
            output_path = str(out_dir / f"{stem}_enhanced{suffix}")

            _cb_url = callback_url
            _job_id = job_id

            _strength = strength

            def _sync_enhance(out: str) -> None:
                def _progress(pct: int) -> None:
                    httpx.post(
                        f"{_cb_url}/callback/progress",
                        json={"job_id": _job_id, "percent": pct},
                        timeout=5,
                    )

                enhance_file(filepath, out, _progress, strength=_strength)

            await loop.run_in_executor(None, lambda: _sync_enhance(output_path))

            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(
                    f"{callback_url}/callback/status",
                    json={"job_id": job_id, "status": "done", "output_filepath": output_path},
                )

        except Exception as exc:
            try:
                async with httpx.AsyncClient(timeout=5) as client:
                    await client.post(
                        f"{callback_url}/callback/status",
                        json={
                            "job_id": job_id,
                            "status": "error",
                            "error_message": str(exc),
                        },
                    )
            except Exception:
                pass
