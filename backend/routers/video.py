import asyncio
import hashlib
import os
import pathlib
import tempfile

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from processors.extract_audio import extract_audio

router = APIRouter()

# Serialise extractions so concurrent multi-file video drops don't spawn many
# parallel ffmpeg processes at once (mirrors the convert/enhance lock pattern).
_extract_lock = asyncio.Lock()


class ExtractRequest(BaseModel):
    input_path: str
    fmt: str = "mp3"


def _cache_dir() -> pathlib.Path:
    """Scratch/cache dir for extracted audio — wiped by the Rust app on close."""
    scratch_disk = os.environ.get("SCRATCH_DISK_DIR", "").strip()
    base = pathlib.Path(scratch_disk) if scratch_disk else pathlib.Path(tempfile.gettempdir())
    return base / "enhance-audio-pro-cache" / "extracted"


@router.post("/extract_audio")
async def extract_audio_endpoint(req: ExtractRequest) -> JSONResponse:
    src = pathlib.Path(req.input_path)
    base_name = src.stem  # preserve the original video's base filename
    fmt = (req.fmt or "mp3").lower()

    out_dir = _cache_dir()
    try:
        out_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

    # Suffix an 8-char hash of the source path so two different videos that share
    # a base name (clip.mov / clip.mkv) don't collide on disk. The displayed
    # filename stays "<base>.<fmt>" — the frontend derives that from base_name.
    path_hash = hashlib.sha1(str(src).encode("utf-8")).hexdigest()[:8]
    out_path = out_dir / f"{base_name}.{path_hash}.{fmt}"

    def _run() -> None:
        def _cb(_pct: int) -> None:
            pass
        extract_audio(str(src), str(out_path), _cb, fmt=fmt)

    async with _extract_lock:
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, _run)
        except Exception as e:
            return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

    return JSONResponse(
        status_code=200,
        content={
            "success": True,
            "audio_path": str(out_path),
            "base_name": f"{base_name}.{fmt}",
        },
    )
