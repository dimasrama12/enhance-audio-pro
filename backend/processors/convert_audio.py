import subprocess
from typing import Callable

SUPPORTED_FORMATS = [
    "mp3", "wav", "flac", "aac", "ogg", "opus", "m4a", "wma",
    "aiff", "mp4", "mkv", "avi", "mov", "webm", "m4v", "flv",
]


def _ffmpeg_exe() -> str:
    # Use the static ffmpeg binary shipped with imageio-ffmpeg. PyInstaller
    # bundles it via collect_data_files('imageio_ffmpeg') in build.spec, so it
    # is available in the frozen sidecar without a system-wide ffmpeg install.
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def convert_file(
    input_path: str,
    output_path: str,
    progress_cb: Callable[[int], None],
    bitrate: str = "",
    sample_rate: str = "",
) -> None:
    progress_cb(10)
    cmd = [_ffmpeg_exe(), "-y", "-i", input_path, "-vn"]
    if bitrate:
        cmd += ["-b:a", bitrate]
    if sample_rate:
        cmd += ["-ar", sample_rate]
    cmd.append(output_path)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.strip()}")
    progress_cb(100)
