import pathlib
import subprocess
import sys
from typing import Callable


def _ffmpeg_exe() -> str:
    if getattr(sys, "frozen", False):
        bundled = pathlib.Path(sys.executable).parent / "ffmpeg.exe"
        if bundled.exists():
            return str(bundled)
    return "ffmpeg"


def merge_files(
    input_paths: list[str],
    output_path: str,
    crossfade_sec: float,
    progress_cb: Callable[[int], None],
) -> None:
    if len(input_paths) < 2:
        raise ValueError("Need at least 2 files to merge")

    progress_cb(10)
    n = len(input_paths)
    inputs: list[str] = []
    for p in input_paths:
        inputs += ["-i", p]

    if crossfade_sec <= 0:
        filter_complex = "".join(f"[{i}:a]" for i in range(n))
        filter_complex += f"concat=n={n}:v=0:a=1[out]"
        cmd = [_ffmpeg_exe(), "-y"] + inputs + [
            "-filter_complex", filter_complex,
            "-map", "[out]",
            output_path,
        ]
    else:
        parts = []
        prev = "0:a"
        for i in range(1, n):
            out_label = f"cf{i}" if i < n - 1 else "out"
            parts.append(f"[{prev}][{i}:a]acrossfade=d={crossfade_sec}[{out_label}]")
            prev = out_label
        filter_complex = ";".join(parts)
        cmd = [_ffmpeg_exe(), "-y"] + inputs + [
            "-filter_complex", filter_complex,
            "-map", "[out]",
            output_path,
        ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg merge failed: {result.stderr.strip()}")
    progress_cb(100)


def loop_audio(
    input_path: str,
    output_path: str,
    target_duration_sec: float,
    progress_cb: Callable[[int], None],
) -> None:
    progress_cb(10)
    cmd = [
        _ffmpeg_exe(), "-y",
        "-stream_loop", "-1",
        "-i", input_path,
        "-t", str(target_duration_sec),
        "-c", "copy",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg loop failed: {result.stderr.strip()}")
    progress_cb(100)
