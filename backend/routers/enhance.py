import asyncio
import logging
import os
import pathlib
import sqlite3
import time
from typing import List

import httpx
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import threading
from processors.enhance_speech import enhance_file, cancellation_events, JobCancelledError

router = APIRouter()
logger = logging.getLogger(__name__)


class EnhanceRequest(BaseModel):
    job_ids: List[str]
    callback_url: str
    strength: float = 1.0
    model_type: str = "deepfilternet"

class CancelRequest(BaseModel):
    job_ids: List[str]


@router.post("/enhance")
async def enhance_jobs(
    req: EnhanceRequest, background_tasks: BackgroundTasks
) -> JSONResponse:
    if req.job_ids:
        for j_id in req.job_ids:
            cancellation_events[j_id] = threading.Event()
        logger.info(f"Queuing {len(req.job_ids)} job(s) for enhancement (model={req.model_type})")
        background_tasks.add_task(_process_jobs, req.job_ids, req.callback_url, req.strength, req.model_type)
    return JSONResponse(status_code=202, content={"detail": "Processing started."})

@router.post("/cancel")
async def cancel_jobs(req: CancelRequest) -> JSONResponse:
    cancelled = []
    for j_id in req.job_ids:
        if j_id in cancellation_events:
            cancellation_events[j_id].set()
            cancelled.append(j_id)
    logger.info(f"Cancel signal sent for {len(cancelled)} job(s): {cancelled}")
    return JSONResponse(status_code=200, content={"detail": "Cancellation signals sent."})


async def _process_jobs(job_ids: List[str], callback_url: str, strength: float = 1.0, model_type: str = "deepfilternet") -> None:
    loop = asyncio.get_running_loop()

    db_path_env = os.environ.get("DATABASE_PATH")
    if db_path_env:
        db_path = pathlib.Path(db_path_env)
    else:
        appdata = os.environ.get("APPDATA", str(pathlib.Path.home()))
        db_path = pathlib.Path(appdata) / "enhance-audio-pro" / "app.db"

    for job_id in job_ids:
        t_job_start = time.perf_counter()
        try:
            conn = sqlite3.connect(str(db_path))
            row = conn.execute(
                "SELECT filepath, destination, filename FROM queue_jobs WHERE id = ?",
                (job_id,),
            ).fetchone()
            conn.close()

            if row is None:
                logger.warning(f"[{job_id}] Not found in DB — skipping")
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

            logger.info(f"[{job_id}] Starting: {filename!r} → {output_path!r} (model={model_type}, strength={strength:.2f})")

            _cb_url = callback_url
            _job_id = job_id
            _strength = strength
            _model_type = model_type

            def _sync_enhance(out: str) -> None:
                def _progress(pct: int) -> None:
                    try:
                        httpx.post(
                            f"{_cb_url}/callback/progress",
                            json={"job_id": _job_id, "percent": pct},
                            timeout=5,
                        )
                    except Exception as cb_err:
                        logger.warning(f"[{_job_id}] Progress callback failed at {pct}%: {cb_err}")

                if _model_type == "lavasr":
                    from processors.enhance_lavasr import enhance_file_lavasr
                    enhance_file_lavasr(filepath, out, _progress, strength=_strength, job_id=_job_id)
                else:
                    enhance_file(filepath, out, _progress, strength=_strength, job_id=_job_id)

            await loop.run_in_executor(None, lambda: _sync_enhance(output_path))

            elapsed = time.perf_counter() - t_job_start
            logger.info(f"[{job_id}] Completed in {elapsed:.2f}s → {output_path!r}")

            t_cb = time.perf_counter()
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(
                    f"{callback_url}/callback/status",
                    json={"job_id": job_id, "status": "done", "output_filepath": output_path},
                )
            logger.debug(f"[{job_id}] Status callback sent in {time.perf_counter() - t_cb:.3f}s")

        except JobCancelledError:
            elapsed = time.perf_counter() - t_job_start
            logger.info(f"[{job_id}] Cancelled after {elapsed:.2f}s")
            try:
                async with httpx.AsyncClient(timeout=5) as client:
                    await client.post(
                        f"{callback_url}/callback/status",
                        json={"job_id": job_id, "status": "pending"},
                    )
            except Exception as cb_err:
                logger.warning(f"[{job_id}] Cancel callback failed: {cb_err}")
        except Exception as exc:
            elapsed = time.perf_counter() - t_job_start
            logger.error(f"[{job_id}] Failed after {elapsed:.2f}s: {exc}", exc_info=True)
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
            except Exception as cb_err:
                logger.warning(f"[{job_id}] Error callback failed: {cb_err}")
        finally:
            if job_id in cancellation_events:
                del cancellation_events[job_id]
