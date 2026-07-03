import asyncio
import hashlib
import logging
import os
import pathlib
import tempfile
from typing import Optional

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from processors.extract_audio import extract_audio

router = APIRouter()
logger = logging.getLogger(__name__)

# Serialise extractions so concurrent multi-file video drops don't spawn many
# parallel ffmpeg processes at once (mirrors the convert/enhance lock pattern).
_extract_lock = asyncio.Lock()


class ExtractRequest(BaseModel):
    input_path: str
    fmt: str = "mp3"
    # Optional real-time progress plumbing. When both are supplied the extraction
    # thread streams percent updates to the Rust callback server, which re-emits
    # them to the frontend as `queue://progress` keyed by this job_id (the
    # placeholder row's id). Omitted for callers that don't need live feedback.
    job_id: Optional[str] = None
    callback_url: Optional[str] = None


def _normalize_input_path(raw: str) -> str:
    r"""Clean up a path that may arrive from an OS drag-and-drop event.

    Windows drag-drop (via wry) can deliver extended-length "verbatim" paths
    prefixed with ``\\?\`` (or ``\\?\UNC\`` for network shares). ffmpeg rejects
    those with "Invalid argument", which is why drag-dropped videos failed while
    the file-browser dialog (which returns plain paths) worked. Strip the prefix
    and any stray surrounding whitespace so ffmpeg gets a normal path.
    """
    p = raw.strip().strip('"')
    if p.startswith("\\\\?\\UNC\\"):
        p = "\\\\" + p[len("\\\\?\\UNC\\"):]
    elif p.startswith("\\\\?\\"):
        p = p[len("\\\\?\\"):]
    return p


def _cache_dir() -> pathlib.Path:
    """Scratch/cache dir for extracted audio — wiped by the Rust app on close."""
    scratch_disk = os.environ.get("SCRATCH_DISK_DIR", "").strip()
    base = pathlib.Path(scratch_disk) if scratch_disk else pathlib.Path(tempfile.gettempdir())
    return base / "enhance-audio-pro-cache" / "extracted"


@router.post("/extract_audio")
async def extract_audio_endpoint(req: ExtractRequest) -> JSONResponse:
    input_path = _normalize_input_path(req.input_path)
    src = pathlib.Path(input_path)
    base_name = src.stem  # preserve the original video's base filename
    fmt = (req.fmt or "mp3").lower()

    logger.info("extract_audio request: raw=%r normalized=%r", req.input_path, input_path)

    if not src.is_file():
        logger.error("extract_audio: source not found: %r", input_path)
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": f"Video file not found: {input_path}"},
        )

    # Suffix an 8-char hash of the source path onto the *directory* (not the file
    # name) so two different videos that share a base name (clip.mov / clip.mkv)
    # don't collide on disk, while the extracted file keeps EXACTLY the original
    # base name — e.g. "[Kusonime] ... [1080p].mp3", no random suffix.
    path_hash = hashlib.sha1(str(src).encode("utf-8")).hexdigest()[:8]
    out_dir = _cache_dir() / path_hash
    try:
        out_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

    out_path = out_dir / f"{base_name}.{fmt}"

    job_id = req.job_id
    callback_url = (req.callback_url or "").rstrip("/")

    def _run() -> None:
        def _cb(pct: int) -> None:
            # Stream real extraction progress back to the UI (best-effort; a
            # failed callback must never abort the extraction itself).
            if not job_id or not callback_url:
                return
            try:
                httpx.post(
                    f"{callback_url}/callback/progress",
                    json={"job_id": job_id, "percent": pct},
                    timeout=3,
                )
            except Exception as cb_err:
                logger.debug("extract progress callback failed at %d%%: %s", pct, cb_err)

        extract_audio(str(src), str(out_path), _cb, fmt=fmt)

    async with _extract_lock:
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, _run)
        except Exception as e:
            logger.error("extract_audio failed for %r: %s", input_path, e)
            return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

    logger.info("extract_audio done: %r -> %r", input_path, str(out_path))
    return JSONResponse(
        status_code=200,
        content={
            "success": True,
            "audio_path": str(out_path),
            "base_name": f"{base_name}.{fmt}",
        },
    )
