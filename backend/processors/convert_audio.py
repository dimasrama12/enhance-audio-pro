import pathlib
import subprocess
import sys
from typing import Callable

SUPPORTED_FORMATS = [
    "mp3", "wav", "flac", "aac", "ogg", "opus", "m4a", "wma",
    "aiff", "mp4", "mkv", "avi", "mov", "webm", "m4v", "flv",
]


def _ffmpeg_exe() -> str:
    if getattr(sys, "frozen", False):
        bundled = pathlib.Path(sys.executable).parent / "ffmpeg.exe"
        if bundled.exists():
            return str(bundled)
    return "ffmpeg"


def convert_file(
    input_path: str,
    output_path: str,
    progress_cb: Callable[[int], None],
    bitrate: str = "",
) -> None:
    progress_cb(10)
    cmd = [_ffmpeg_exe(), "-y", "-i", input_path, "-vn"]
    if bitrate:
        cmd += ["-b:a", bitrate]
    cmd.append(output_path)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.strip()}")
    progress_cb(100)
