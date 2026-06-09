import asyncio
import os
import pathlib
import sqlite3
from datetime import date
from typing import List

import httpx
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from processors.convert_audio import convert_file

router = APIRouter()

_convert_lock = asyncio.Lock()


class ConvertRequest(BaseModel):
    job_ids: List[str]
    callback_url: str
    filename_template: str = ""


def apply_filename_template(template: str, stem: str, fmt: str) -> str:
    """Replace {name}, {date}, {format} tokens; falls back to stem_converted."""
    if not template:
        return f"{stem}_converted"
    result = template.replace("{name}", stem)
    result = result.replace("{date}", date.today().isoformat())
    result = result.replace("{format}", fmt)
    return result or f"{stem}_converted"


@router.post("/convert")
async def convert_jobs(req: ConvertRequest, background_tasks: BackgroundTasks) -> JSONResponse:
    if req.job_ids:
        background_tasks.add_task(_process_jobs, req.job_ids, req.callback_url, req.filename_template)
    return JSONResponse(status_code=202, content={"detail": "Processing started."})


async def _process_jobs(job_ids: List[str], callback_url: str, filename_template: str = "") -> None:
    async with _convert_lock:
        loop = asyncio.get_running_loop()
        db_path_env = os.environ.get("DATABASE_PATH")
        if db_path_env:
            db_path = pathlib.Path(db_path_env)
        else:
            appdata = os.environ.get("APPDATA", str(pathlib.Path.home()))
            db_path = pathlib.Path(appdata) / "enhance-audio-pro" / "app.db"

        for job_id in job_ids:
            try:
                # Heartbeat: confirm "processing" before starting work
                try:
                    async with httpx.AsyncClient(timeout=5) as client:
                        await client.post(
                            f"{callback_url}/callback/status",
                            json={"job_id": job_id, "status": "processing"},
                        )
                except Exception:
                    pass

                conn = sqlite3.connect(str(db_path))
                row = conn.execute(
                    "SELECT filepath, destination, filename, output_format, bitrate, sample_rate FROM queue_jobs WHERE id = ?",
                    (job_id,),
                ).fetchone()
                conn.close()

                if row is None:
                    continue

                filepath, destination, filename, output_format, bitrate, sample_rate = row
                output_format = output_format or "wav"
                bitrate = bitrate or ""
                sample_rate = sample_rate or ""
                stem = pathlib.Path(filename).stem
                out_dir = pathlib.Path(destination) if destination else pathlib.Path(filepath).parent
                out_dir.mkdir(parents=True, exist_ok=True)
                out_stem = apply_filename_template(filename_template, stem, output_format)
                out_path = out_dir / f"{out_stem}.{output_format}"

                def _sync_convert(src: str, dst: str, jid: str, br: str, sr: str) -> None:
                    def _cb(pct: int) -> None:
                        httpx.post(
                            f"{callback_url}/callback/progress",
                            json={"job_id": jid, "percent": pct},
                            timeout=5,
                        )
                    convert_file(src, dst, _cb, bitrate=br, sample_rate=sr)

                await loop.run_in_executor(
                    None,
                    lambda fp=filepath, op=str(out_path), jid=job_id, br=bitrate, sr=sample_rate: _sync_convert(fp, op, jid, br, sr),
                )

                async with httpx.AsyncClient(timeout=5) as client:
                    await client.post(
                        f"{callback_url}/callback/status",
                        json={"job_id": job_id, "status": "done", "output_filepath": str(out_path)},
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
