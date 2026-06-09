import asyncio
import logging
import os
import pathlib
import sqlite3
import tempfile
import threading
import time
from typing import List

import httpx
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from processors.enhance_speech import enhance_file, cancellation_events, JobCancelledError

router = APIRouter()
logger = logging.getLogger(__name__)

# Serialises all enhance runs — prevents concurrent model access which causes
# CUDA OOM errors or silent hangs when multiple /enhance requests arrive simultaneously.
_enhance_lock = asyncio.Lock()

# Per-job hard timeout (seconds). When exceeded the cancellation event is set so
# the enhance thread exits cleanly rather than hanging indefinitely.
_JOB_TIMEOUT_SECONDS = 1800  # 30 minutes


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

    # Acquire the global lock so only one enhance batch runs at a time.
    # If another batch is already running, this task waits here until it finishes.
    async with _enhance_lock:
        for job_id in job_ids:
            t_job_start = time.perf_counter()
            output_path: str | None = None
            timeout_state = {"fired": False}

            try:
                conn = sqlite3.connect(str(db_path))
                row = conn.execute(
                    "SELECT filepath, destination, filename, output_format FROM queue_jobs WHERE id = ?",
                    (job_id,),
                ).fetchone()
                conn.close()

                if row is None:
                    logger.warning(f"[{job_id}] Not found in DB — skipping")
                    continue

                # Skip if the job was cancelled while waiting for the lock
                if job_id in cancellation_events and cancellation_events[job_id].is_set():
                    logger.info(f"[{job_id}] Cancelled before processing started — skipping")
                    try:
                        async with httpx.AsyncClient(timeout=5) as client:
                            await client.post(
                                f"{callback_url}/callback/status",
                                json={"job_id": job_id, "status": "pending"},
                            )
                    except Exception:
                        pass
                    continue

                filepath, destination, filename, output_format = row
                output_format = (output_format or pathlib.Path(filename).suffix.lstrip('.')).lower()
                stem = pathlib.Path(filename).stem
                
                # Redirect output directory to scratch cache directory
                scratch_disk = os.environ.get("SCRATCH_DISK_DIR", "").strip()
                if scratch_disk:
                    out_dir = pathlib.Path(scratch_disk) / "enhance-audio-pro-cache" / "enhanced_temp"
                else:
                    out_dir = pathlib.Path(tempfile.gettempdir()) / "enhance-audio-pro-cache" / "enhanced_temp"
                
                out_dir.mkdir(parents=True, exist_ok=True)
                
                base_name = f"{stem}_enhanced"
                candidate_path = out_dir / f"{base_name}.{output_format}"
                if candidate_path.exists():
                    counter = 1
                    while True:
                        candidate_path = out_dir / f"{base_name}_{counter:02d}.{output_format}"
                        if not candidate_path.exists():
                            break
                        counter += 1
                output_path = str(candidate_path)

                logger.info(f"[{job_id}] Starting: {filename!r} → {output_path!r} (model={model_type}, strength={strength:.2f})")

                # Heartbeat: re-emit "processing" now that the lock is acquired and this
                # job is actually starting (important when it was waiting behind another task).
                try:
                    async with httpx.AsyncClient(timeout=3) as hb_client:
                        await hb_client.post(
                            f"{callback_url}/callback/status",
                            json={"job_id": job_id, "status": "processing"},
                        )
                except Exception:
                    pass  # Non-fatal; UI already shows processing from Rust's initial emit

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

                # Per-job hard timeout: trigger cancellation event after _JOB_TIMEOUT_SECONDS
                # so the enhance thread exits cleanly instead of hanging forever.
                def _on_timeout() -> None:
                    timeout_state["fired"] = True
                    logger.warning(f"[{job_id}] Hard timeout after {_JOB_TIMEOUT_SECONDS}s — signalling cancellation")
                    if job_id in cancellation_events:
                        cancellation_events[job_id].set()

                timeout_timer = threading.Timer(_JOB_TIMEOUT_SECONDS, _on_timeout)
                timeout_timer.daemon = True
                timeout_timer.start()
                try:
                    await loop.run_in_executor(None, lambda: _sync_enhance(output_path))
                finally:
                    timeout_timer.cancel()

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
                if timeout_state["fired"]:
                    logger.error(f"[{job_id}] Timed out after {_JOB_TIMEOUT_SECONDS}s")
                    error_msg = f"Job timed out after {_JOB_TIMEOUT_SECONDS // 60} minutes"
                    try:
                        async with httpx.AsyncClient(timeout=5) as client:
                            await client.post(
                                f"{callback_url}/callback/status",
                                json={"job_id": job_id, "status": "error", "error_message": error_msg},
                            )
                    except Exception as cb_err:
                        logger.warning(f"[{job_id}] Timeout error callback failed: {cb_err}")
                else:
                    logger.info(f"[{job_id}] Cancelled after {elapsed:.2f}s")
                    if output_path:
                        out_p = pathlib.Path(output_path)
                        if out_p.exists():
                            try:
                                out_p.unlink()
                                logger.info(f"[{job_id}] Deleted partial output: {output_path!r}")
                            except OSError as del_err:
                                logger.warning(f"[{job_id}] Could not delete partial output: {del_err}")
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
