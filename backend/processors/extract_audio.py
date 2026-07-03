import re
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


def _probe_duration_seconds(ffmpeg: str, input_path: str) -> float:
    """Best-effort total media duration (seconds).

    imageio-ffmpeg ships ffmpeg (not ffprobe), so we read the ``Duration:`` line
    that ffmpeg prints to stderr when invoked with no output file. Returns 0.0 if
    it can't be determined — in that case the caller falls back to an
    indeterminate progress bar instead of a real percentage.
    """
    try:
        proc = subprocess.run(
            [ffmpeg, "-hide_banner", "-i", input_path],
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
        )
        # ffmpeg exits non-zero here (no output specified) but still prints the
        # duration banner to stderr, e.g. "Duration: 00:23:41.52, start: ...".
        m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", proc.stderr or "")
        if m:
            hours, minutes, seconds = int(m.group(1)), int(m.group(2)), float(m.group(3))
            return hours * 3600 + minutes * 60 + seconds
    except Exception:
        pass
    return 0.0


def extract_audio(
    input_path: str,
    output_path: str,
    progress_cb: Callable[[int], None],
    fmt: str = "mp3",
) -> None:
    """Demux/transcode the first audio stream of a video into ``output_path``.

    Streams real progress to ``progress_cb`` (0-100) by parsing ffmpeg's
    ``-progress pipe:1`` output against the probed total duration.

    - ``-vn`` drops the video stream.
    - ``-map 0:a:0?`` takes the first audio stream; the trailing ``?`` makes the
      mapping optional so ffmpeg does not hard-fail when the stream index shifts,
      letting us surface a clean "no audio" error instead of a cryptic exit code.
    - No size or duration probing/guards — video drops bypass all such limits.
    """
    ffmpeg = _ffmpeg_exe()
    progress_cb(1)

    total = _probe_duration_seconds(ffmpeg, input_path)

    cmd = [
        ffmpeg, "-y", "-loglevel", "error", "-nostdin", "-nostats",
        "-progress", "pipe:1",
        "-i", input_path,
        "-vn", "-map", "0:a:0?",
    ]
    if fmt == "mp3":
        cmd += ["-c:a", "libmp3lame", "-q:a", "2"]
    # For any other requested container we let ffmpeg pick a sane default codec.
    cmd.append(output_path)

    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    last_pct = 1
    try:
        if proc.stdout is not None:
            for raw_line in proc.stdout:
                line = raw_line.strip()
                # ffmpeg emits key=value lines; out_time_us is the microseconds
                # of media processed so far. Guard on total>0 (known duration).
                if line.startswith("out_time_us=") and total > 0:
                    value = line.split("=", 1)[1].strip()
                    if not value.lstrip("-").isdigit():
                        continue
                    current_s = int(value) / 1_000_000.0
                    pct = int(min(99, max(1, current_s / total * 100)))
                    if pct > last_pct:
                        last_pct = pct
                        progress_cb(pct)
                elif line == "progress=end":
                    break
    finally:
        stderr_output = proc.stderr.read() if proc.stderr is not None else ""
        proc.wait()

    if proc.returncode != 0:
        stderr = (stderr_output or "").strip()
        # A missing/empty audio stream typically yields "does not contain any stream"
        # or an output with no audio — normalise to a user-friendly message.
        if "does not contain any stream" in stderr or "Output file does not contain" in stderr:
            raise RuntimeError("No audio track found in the video.")
        raise RuntimeError(f"ffmpeg failed: {stderr}")

    progress_cb(100)
