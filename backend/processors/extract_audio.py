import subprocess
from typing import Callable

# Video containers we accept for audio extraction. The frontend also guards
# on these, but keep a backend-side allowlist so the endpoint is self-contained.
SUPPORTED_VIDEO_FORMATS = [
    "mp4", "mov", "mkv", "avi", "webm", "m4v", "flv", "wmv", "ts", "mts", "m2ts",
]


def _ffmpeg_exe() -> str:
    # Use the static ffmpeg binary shipped with imageio-ffmpeg. PyInstaller
    # bundles it via collect_data_files('imageio_ffmpeg') in build.spec, so it
    # is available in the frozen sidecar without a system-wide ffmpeg install.
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def extract_audio(
    input_path: str,
    output_path: str,
    progress_cb: Callable[[int], None],
    fmt: str = "mp3",
) -> None:
    """Demux/transcode the first audio stream of a video into ``output_path``.

    - ``-vn`` drops the video stream.
    - ``-map 0:a:0?`` takes the first audio stream; the trailing ``?`` makes the
      mapping optional so ffmpeg does not hard-fail when the stream index shifts,
      letting us surface a clean "no audio" error instead of a cryptic exit code.
    - No size or duration probing/guards — video drops bypass all such limits.
    """
    progress_cb(10)

    cmd = [
        _ffmpeg_exe(), "-y", "-loglevel", "error", "-nostdin",
        "-i", input_path,
        "-vn", "-map", "0:a:0?",
    ]
    if fmt == "mp3":
        cmd += ["-c:a", "libmp3lame", "-q:a", "2"]
    # For any other requested container we let ffmpeg pick a sane default codec.
    cmd.append(output_path)

    result = subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, text=True)
    if result.returncode != 0:
        stderr = result.stderr.strip()
        # A missing/empty audio stream typically yields "does not contain any stream"
        # or an output with no audio — normalise to a user-friendly message.
        if "does not contain any stream" in stderr or "Output file does not contain" in stderr:
            raise RuntimeError("No audio track found in the video.")
        raise RuntimeError(f"ffmpeg failed: {stderr}")

    progress_cb(100)
