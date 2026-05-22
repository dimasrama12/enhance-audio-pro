import asyncio
import os
import pathlib
import sqlite3
from typing import Any, Dict, List

import httpx
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter()


class ManipulateRequest(BaseModel):
    job_id: str
    operation: str
    params: Dict[str, Any]
    callback_url: str


class MergeRequest(BaseModel):
    job_ids: List[str]
    crossfade_sec: float = 0.0
    callback_url: str


class LoopRequest(BaseModel):
    job_id: str
    target_duration_sec: float
    callback_url: str


class EQRequest(BaseModel):
    job_id: str
    gains: List[float]
    callback_url: str


@router.post("/manipulate")
async def manipulate_audio(req: ManipulateRequest, background_tasks: BackgroundTasks) -> JSONResponse:
    background_tasks.add_task(_process_manipulate, req)
    return JSONResponse(status_code=202, content={"detail": "Processing started."})


@router.post("/merge")
async def merge_audio(req: MergeRequest, background_tasks: BackgroundTasks) -> JSONResponse:
    if len(req.job_ids) < 2:
        return JSONResponse(status_code=400, content={"detail": "Need at least 2 files to merge."})
    background_tasks.add_task(_process_merge, req)
    return JSONResponse(status_code=202, content={"detail": "Processing started."})


@router.post("/loop")
async def loop_audio(req: LoopRequest, background_tasks: BackgroundTasks) -> JSONResponse:
    background_tasks.add_task(_process_loop, req)
    return JSONResponse(status_code=202, content={"detail": "Processing started."})


@router.post("/eq")
async def eq_audio(req: EQRequest, background_tasks: BackgroundTasks) -> JSONResponse:
    if len(req.gains) != 11:
        return JSONResponse(status_code=400, content={"detail": "EQ requires exactly 11 gain values."})
    background_tasks.add_task(_process_eq, req)
    return JSONResponse(status_code=202, content={"detail": "Processing started."})


def _get_job_row(job_id: str) -> tuple | None:
    appdata = os.environ.get("APPDATA", str(pathlib.Path.home()))
    db_path = pathlib.Path(appdata) / "enhance-audio-pro" / "app.db"
    conn = sqlite3.connect(str(db_path))
    row = conn.execute(
        "SELECT filepath, destination, filename, output_format FROM queue_jobs WHERE id = ?",
        (job_id,),
    ).fetchone()
    conn.close()
    return row


async def _process_manipulate(req: ManipulateRequest) -> None:
    from processors.manipulate_audio import trim_audio, speed_audio, pitch_audio, volume_audio, fade_audio

    loop = asyncio.get_running_loop()
    try:
        row = _get_job_row(req.job_id)
        if row is None:
            return

        filepath, destination, filename, output_format = row
        stem = pathlib.Path(filename).stem
        out_dir = pathlib.Path(destination) if destination else pathlib.Path(filepath).parent
        out_dir.mkdir(parents=True, exist_ok=True)
        op = req.operation
        out_path = out_dir / f"{stem}_{op}.{output_format or 'wav'}"

        def _cb(pct: int) -> None:
            httpx.post(
                f"{req.callback_url}/callback/progress",
                json={"job_id": req.job_id, "percent": pct},
                timeout=5,
            )

        def _run() -> None:
            p = req.params
            if op == "trim":
                trim_audio(filepath, str(out_path), float(p["start_sec"]), float(p["end_sec"]), _cb)
            elif op == "speed":
                speed_audio(filepath, str(out_path), float(p["speed_factor"]), _cb)
            elif op == "pitch":
                pitch_audio(filepath, str(out_path), float(p["semitones"]), _cb)
            elif op == "volume":
                volume_audio(filepath, str(out_path), float(p["db_gain"]), _cb)
            elif op == "fade":
                fade_audio(
                    filepath, str(out_path),
                    float(p.get("fade_in_sec", 0)),
                    float(p.get("fade_out_sec", 0)),
                    float(p.get("duration_sec", 60)),
                    _cb,
                )
            else:
                raise ValueError(f"Unknown operation: {op}")

        await loop.run_in_executor(None, _run)

        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                f"{req.callback_url}/callback/status",
                json={"job_id": req.job_id, "status": "done"},
            )
    except Exception as exc:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(
                    f"{req.callback_url}/callback/status",
                    json={"job_id": req.job_id, "status": "error", "error_message": str(exc)},
                )
        except Exception:
            pass


async def _process_merge(req: MergeRequest) -> None:
    from processors.merge_audio import merge_files

    loop = asyncio.get_running_loop()
    first_id = req.job_ids[0]
    try:
        rows = [_get_job_row(jid) for jid in req.job_ids]
        if any(r is None for r in rows):
            return

        input_paths = [r[0] for r in rows]  # type: ignore[index]
        first_row = rows[0]
        destination = first_row[1]  # type: ignore[index]
        filename = first_row[2]     # type: ignore[index]
        output_format = first_row[3] or "wav"  # type: ignore[index]

        stem = pathlib.Path(filename).stem
        out_dir = pathlib.Path(destination) if destination else pathlib.Path(input_paths[0]).parent
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{stem}_merged.{output_format}"

        def _cb(pct: int) -> None:
            httpx.post(
                f"{req.callback_url}/callback/progress",
                json={"job_id": first_id, "percent": pct},
                timeout=5,
            )

        await loop.run_in_executor(
            None,
            lambda paths=input_paths, op=str(out_path), xf=req.crossfade_sec: merge_files(paths, op, xf, _cb),
        )

        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                f"{req.callback_url}/callback/status",
                json={"job_id": first_id, "status": "done"},
            )
    except Exception as exc:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(
                    f"{req.callback_url}/callback/status",
                    json={"job_id": first_id, "status": "error", "error_message": str(exc)},
                )
        except Exception:
            pass


async def _process_loop(req: LoopRequest) -> None:
    from processors.merge_audio import loop_audio

    loop = asyncio.get_running_loop()
    try:
        row = _get_job_row(req.job_id)
        if row is None:
            return

        filepath, destination, filename, output_format = row
        stem = pathlib.Path(filename).stem
        out_dir = pathlib.Path(destination) if destination else pathlib.Path(filepath).parent
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{stem}_looped.{output_format or 'wav'}"

        def _cb(pct: int) -> None:
            httpx.post(
                f"{req.callback_url}/callback/progress",
                json={"job_id": req.job_id, "percent": pct},
                timeout=5,
            )

        await loop.run_in_executor(
            None,
            lambda fp=filepath, op=str(out_path), dur=req.target_duration_sec: loop_audio(fp, op, dur, _cb),
        )

        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                f"{req.callback_url}/callback/status",
                json={"job_id": req.job_id, "status": "done"},
            )
    except Exception as exc:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(
                    f"{req.callback_url}/callback/status",
                    json={"job_id": req.job_id, "status": "error", "error_message": str(exc)},
                )
        except Exception:
            pass


async def _process_eq(req: EQRequest) -> None:
    from processors.equalizer import apply_eq

    loop = asyncio.get_running_loop()
    try:
        row = _get_job_row(req.job_id)
        if row is None:
            return

        filepath, destination, filename, output_format = row
        stem = pathlib.Path(filename).stem
        out_dir = pathlib.Path(destination) if destination else pathlib.Path(filepath).parent
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{stem}_eq.{output_format or 'wav'}"

        def _cb(pct: int) -> None:
            httpx.post(
                f"{req.callback_url}/callback/progress",
                json={"job_id": req.job_id, "percent": pct},
                timeout=5,
            )

        await loop.run_in_executor(
            None,
            lambda fp=filepath, op=str(out_path), g=req.gains: apply_eq(fp, op, g, _cb),
        )

        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                f"{req.callback_url}/callback/status",
                json={"job_id": req.job_id, "status": "done"},
            )
    except Exception as exc:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(
                    f"{req.callback_url}/callback/status",
                    json={"job_id": req.job_id, "status": "error", "error_message": str(exc)},
                )
        except Exception:
            pass
