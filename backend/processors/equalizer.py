import pathlib
import subprocess
import sys
from typing import Callable

EQ_FREQUENCIES = [0, 60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000]

PRESETS: dict[str, list[float]] = {
    "Default":              [0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    "Classic":              [0,  0,  0,  0,  0,  0, -8, -8, -8, -8, -8],
    "Dance":                [0, -8,  7,  7,  0,  0, -6, -8, -8,  0,  0],
    "Club":                 [0,  0,  0,  8,  6,  2,  0,  0,  0,  0,  0],
    "Full Bass":            [0, -8,  9,  9,  5,  1, -4, -8, -8, -8, -8],
    "Full Bass & Treble":   [0,  7,  5,  0, -7, -5,  2,  8,  8,  8,  9],
    "Full Treble":          [0, -9, -9, -9, -4,  3,  9,  9,  9,  9,  9],
    "Laptop Speakers":      [0, -3,  2,  4, 12, 10,  7,  2,  1, -2, -5],
    "Large Hall":           [0,  6,  6,  3,  3,  0, -2, -2, -2,  0,  0],
    "Live":                 [0, -5,  0,  4,  5,  5,  5,  4,  2,  2,  2],
    "Party":                [0,  7,  7,  0,  0,  0,  0,  0,  0,  7,  7],
    "Pop":                  [0, -2,  4,  7,  8,  5,  0, -2, -2, -2, -2],
    "Reggae":               [0,  0,  0,  0, -5,  0,  6,  6,  0,  0,  0],
    "Rock":                 [0,  8,  5, -5, -8, -3,  4,  8,  8,  8,  8],
    "Ska":                  [0, -2, -5, -4,  0,  4,  5,  8,  9,  9,  9],
    "Soft":                 [0,  5,  2,  0, -2,  0,  4,  6,  7,  8,  9],
    "Soft Rock":            [0,  4,  4,  2,  0, -4, -6, -3,  0,  2,  8],
    "Techno Rock":          [0,  8,  5,  0, -5, -4,  0,  8,  9,  9,  8],
}


def _ffmpeg_exe() -> str:
    if getattr(sys, "frozen", False):
        bundled = pathlib.Path(sys.executable).parent / "ffmpeg.exe"
        if bundled.exists():
            return str(bundled)
    return "ffmpeg"


def apply_eq(
    input_path: str,
    output_path: str,
    gains: list[float],
    progress_cb: Callable[[int], None],
) -> None:
    if len(gains) != len(EQ_FREQUENCIES):
        raise ValueError(f"Expected {len(EQ_FREQUENCIES)} gain values, got {len(gains)}")

    filters: list[str] = []

    if gains[0] != 0:
        filters.append(f"volume={gains[0]}dB")

    for i, freq in enumerate(EQ_FREQUENCIES[1:], start=1):
        if gains[i] != 0:
            filters.append(f"equalizer=f={freq}:t=o:w=1:g={gains[i]:.1f}")

    if not filters:
        filters = ["anull"]

    af = ",".join(filters)
    progress_cb(10)
    result = subprocess.run(
        [_ffmpeg_exe(), "-y", "-i", input_path, "-filter:a", af, output_path],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg EQ failed: {result.stderr.strip()}")
    progress_cb(100)
