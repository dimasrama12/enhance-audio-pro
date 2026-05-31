import asyncio
import os
import pathlib
import sqlite3
from typing import List

import httpx
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from processors.separate_stems import separate_file

router = APIRouter()


class SeparateRequest(BaseModel):
    job_ids: List[str]
    callback_url: str


@router.post("/separate")
async def separate_jobs(
    req: SeparateRequest, background_tasks: BackgroundTasks
) -> JSONResponse:
    if req.job_ids:
        background_tasks.add_task(_process_jobs, req.job_ids, req.callback_url)
    return JSONResponse(status_code=202, content={"detail": "Processing started."})


async def _process_jobs(job_ids: List[str], callback_url: str) -> None:
    loop = asyncio.get_event_loop()

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
            stem_name = pathlib.Path(filename).stem
            out_dir = (
                pathlib.Path(destination)
                if destination
                else pathlib.Path(filepath).parent / f"{stem_name}_stems"
            )

            def _sync_separate(out: str) -> None:
                def _progress(pct: int) -> None:
                    httpx.post(
                        f"{callback_url}/callback/progress",
                        json={"job_id": job_id, "percent": pct},
                        timeout=5,
                    )
                separate_file(filepath, out, _progress)

            await loop.run_in_executor(None, lambda: _sync_separate(str(out_dir)))

            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(
                    f"{callback_url}/callback/status",
                    json={"job_id": job_id, "status": "done", "output_filepath": str(out_dir)},
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
