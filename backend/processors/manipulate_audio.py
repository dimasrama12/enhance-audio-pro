import subprocess
from typing import Callable


def _ffmpeg_exe() -> str:
    # Use the static ffmpeg binary shipped with imageio-ffmpeg. PyInstaller
    # bundles it via collect_data_files('imageio_ffmpeg') in build.spec, so it
    # is available in the frozen sidecar without a system-wide ffmpeg install.
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def _run(cmd: list[str], progress_cb: Callable[[int], None]) -> None:
    progress_cb(10)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.strip()}")
    progress_cb(100)


def trim_audio(
    input_path: str,
    output_path: str,
    start_sec: float,
    end_sec: float,
    progress_cb: Callable[[int], None],
) -> None:
    _run(
        [_ffmpeg_exe(), "-y", "-ss", str(start_sec), "-to", str(end_sec),
         "-i", input_path, "-c", "copy", output_path],
        progress_cb,
    )


def speed_audio(
    input_path: str,
    output_path: str,
    speed_factor: float,
    progress_cb: Callable[[int], None],
) -> None:
    factor = max(0.25, min(4.0, speed_factor))
    if factor <= 2.0:
        af = f"atempo={factor}"
    else:
        af = f"atempo=2.0,atempo={factor / 2.0}"
    _run([_ffmpeg_exe(), "-y", "-i", input_path, "-filter:a", af, output_path], progress_cb)


def pitch_audio(
    input_path: str,
    output_path: str,
    semitones: float,
    progress_cb: Callable[[int], None],
) -> None:
    ratio = 2 ** (semitones / 12.0)
    new_rate = int(44100 * ratio)
    af = f"asetrate={new_rate},aresample=44100"
    _run([_ffmpeg_exe(), "-y", "-i", input_path, "-filter:a", af, output_path], progress_cb)


def volume_audio(
    input_path: str,
    output_path: str,
    db_gain: float,
    progress_cb: Callable[[int], None],
) -> None:
    af = f"volume={db_gain}dB"
    _run([_ffmpeg_exe(), "-y", "-i", input_path, "-filter:a", af, output_path], progress_cb)


def fade_audio(
    input_path: str,
    output_path: str,
    fade_in_sec: float,
    fade_out_sec: float,
    duration_sec: float,
    progress_cb: Callable[[int], None],
) -> None:
    filters = []
    if fade_in_sec > 0:
        filters.append(f"afade=t=in:st=0:d={fade_in_sec}")
    if fade_out_sec > 0:
        out_start = max(0.0, duration_sec - fade_out_sec)
        filters.append(f"afade=t=out:st={out_start}:d={fade_out_sec}")
    af = ",".join(filters) if filters else "anull"
    _run([_ffmpeg_exe(), "-y", "-i", input_path, "-filter:a", af, output_path], progress_cb)
