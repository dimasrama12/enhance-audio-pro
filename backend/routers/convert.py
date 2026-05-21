import asyncio
import os
import pathlib
import sqlite3
from typing import List

import httpx
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from processors.convert_audio import convert_file

router = APIRouter()


class ConvertRequest(BaseModel):
    job_ids: List[str]
    callback_url: str


@router.post("/convert")
async def convert_jobs(req: ConvertRequest, background_tasks: BackgroundTasks) -> JSONResponse:
    if req.job_ids:
        background_tasks.add_task(_process_jobs, req.job_ids, req.callback_url)
    return JSONResponse(status_code=202, content={"detail": "Processing started."})


async def _process_jobs(job_ids: List[str], callback_url: str) -> None:
    loop = asyncio.get_event_loop()
    appdata = os.environ.get("APPDATA", str(pathlib.Path.home()))
    db_path = pathlib.Path(appdata) / "enhance-audio-pro" / "app.db"

    for job_id in job_ids:
        try:
            conn = sqlite3.connect(str(db_path))
            row = conn.execute(
                "SELECT filepath, destination, filename, output_format FROM queue_jobs WHERE id = ?",
                (job_id,),
            ).fetchone()
            conn.close()

            if row is None:
                continue

            filepath, destination, filename, output_format = row
            output_format = output_format or "wav"
            stem = pathlib.Path(filename).stem
            out_dir = pathlib.Path(destination) if destination else pathlib.Path(filepath).parent
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"{stem}_converted.{output_format}"

            def _sync_convert(src: str, dst: str, jid: str) -> None:
                def _cb(pct: int) -> None:
                    httpx.post(
                        f"{callback_url}/callback/progress",
                        json={"job_id": jid, "percent": pct},
                        timeout=5,
                    )
                convert_file(src, dst, _cb)

            await loop.run_in_executor(
                None, lambda: _sync_convert(filepath, str(out_path), job_id)
            )

            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(
                    f"{callback_url}/callback/status",
                    json={"job_id": job_id, "status": "done"},
                )

        except Exception as exc:
            try:
                async with httpx.AsyncClient(timeout=5) as client:
                    await client.post(
                        f"{callback_url}/callback/status",
                        json={"job_id": job_id, "status": "error", "error_message": str(exc)},
                    )
            except Exception:
                pass
