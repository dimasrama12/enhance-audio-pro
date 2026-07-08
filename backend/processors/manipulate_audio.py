import subprocess
from typing import Callable


def _ffmpeg_exe() -> str:
    # Use the static ffmpeg binary shipped with imageio-ffmpeg. PyInstaller
    # bundles it via collect_data_files('imageio_ffmpeg') in build.spec, so it
    # is available in the frozen sidecar without a system-wide ffmpeg install.
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def volume_audio(
    input_path: str,
    output_path: str,
    db_gain: float,
    progress_cb: Callable[[int], None],
) -> None:
    """Apply a decibel gain to an audio file and write the result.

    Retained for the WaveformPlayer "download volume-adjusted audio" export
    (POST /export_volume). All other manipulation operations (trim/speed/pitch/
    fade/merge/loop/EQ) were removed as out-of-scope.
    """
    progress_cb(10)
    cmd = [
        _ffmpeg_exe(), "-y", "-loglevel", "error", "-nostdin",
        "-i", input_path,
        "-af", f"volume={db_gain}dB",
        output_path,
    ]
    result = subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg volume failed: {result.stderr.strip()}")
    progress_cb(100)
