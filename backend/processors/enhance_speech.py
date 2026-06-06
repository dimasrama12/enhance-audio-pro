import logging
import os
import pathlib
import subprocess
import threading
import tempfile
import time
from typing import Callable, Optional

logger = logging.getLogger(__name__)

cancellation_events: dict[str, threading.Event] = {}

class JobCancelledError(Exception):
    pass

# Formats soundfile can read natively on Windows without extra codecs
_SOUNDFILE_NATIVE = {'.wav', '.flac', '.ogg', '.aiff', '.aif'}

# Module-level model cache — weights loaded once per sidecar lifetime.
# df_state is NOT cached: it holds RNN hidden state that must be fresh per file.
_model = None


def _get_device() -> str:
    # pyrefly: ignore [missing-import]
    import torch
    return "cuda" if torch.cuda.is_available() else "cpu"

def _ffmpeg_exe() -> str:
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()

def _load_model():
    global _model
    
    # Set DF_HOME and DFHOME environment variables so init_df knows where to find the model
    env_dir = os.environ.get("MODELS_DIR")
    if env_dir:
        models_dir = pathlib.Path(env_dir)
    else:
        appdata = os.environ.get("APPDATA", str(pathlib.Path.home()))
        models_dir = pathlib.Path(appdata) / "enhance-audio-pro" / "models" / "deepfilter"
        
    os.environ["DFHOME"] = str(models_dir)
    os.environ["DF_HOME"] = str(models_dir)
    logger.info(f"Using DeepFilterNet model directory: {models_dir}")

    # pyrefly: ignore [missing-import]
    from df.enhance import init_df

    if _model is None:
        logger.info("Loading DeepFilterNet3 model weights (cold start)…")
        t0 = time.perf_counter()
        _model, _, __ = init_df()
        _model = _model.to(_get_device())
        logger.info(f"Model weights loaded in {time.perf_counter() - t0:.2f}s (device={_get_device()})")
    else:
        logger.debug("Model weights already cached — skipping disk load")

    # Always return a fresh df_state so the RNN hidden state doesn't bleed
    # across files when processing a batch sequentially.
    _, df_state, __ = init_df()
    return _model, df_state


def _to_wav_if_needed(filepath: str, tmp_dir: str) -> tuple[str, bool]:
    """Return (path_to_process, needs_cleanup).

    If the file extension is not natively readable by soundfile, use ffmpeg
    to convert to a temporary WAV so DeepFilterNet can process it.
    """
    ext = pathlib.Path(filepath).suffix.lower()
    if ext in _SOUNDFILE_NATIVE:
        return filepath, False

    logger.info(f"Format {ext!r} not supported by soundfile — converting via ffmpeg")
    t0 = time.perf_counter()
    tmp_path = str(pathlib.Path(tmp_dir) / "input_converted.wav")
    result = subprocess.run(
        [_ffmpeg_exe(), '-y', '-i', filepath, tmp_path],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed to convert '{pathlib.Path(filepath).name}' to WAV "
            f"(exit {result.returncode}): {result.stderr[-400:]}"
        )
    logger.info(f"ffmpeg conversion done in {time.perf_counter() - t0:.2f}s")
    return tmp_path, True


def enhance_file(
    input_path: str,
    output_path: str,
    progress_cb: Callable[[int], None],
    strength: float = 1.0,
    job_id: Optional[str] = None,
) -> None:
    """Remove noise from input_path using DeepFilterNet3, write result to output_path.

    strength: 0.0-1.0, maps to atten_lim_db (0=no effect, 1=full suppression ~40dB).
    """
    t_total = time.perf_counter()
    filename = pathlib.Path(input_path).name
    logger.info(f"[{job_id}] enhance_file start: {filename!r} (strength={strength:.2f})")

    # Signal immediately so the UI progress bar shows movement during model load
    progress_cb(5)

    # pyrefly: ignore [missing-import]
    import torch
    # pyrefly: ignore [missing-import]
    from df.enhance import enhance, load_audio, save_audio

    t_model = time.perf_counter()
    model, df_state = _load_model()
    logger.info(f"[{job_id}] Model ready in {time.perf_counter() - t_model:.2f}s")

    # Map 0.0-1.0 to atten_lim_db: strength 1.0 → 40 dB, 0.0 → 0 dB (pass-through)
    atten_lim_db = max(0.0, min(40.0, strength * 40.0))

    pathlib.Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    scratch_disk = os.environ.get("SCRATCH_DISK_DIR", "").strip()
    if scratch_disk:
        tmp_dir = str(pathlib.Path(scratch_disk) / "enhance-audio-pro-cache" / (job_id or "tmp"))
        pathlib.Path(tmp_dir).mkdir(parents=True, exist_ok=True)
    else:
        tmp_dir = tempfile.mkdtemp()
    process_path, needs_cleanup = _to_wav_if_needed(input_path, tmp_dir)
    try:
        progress_cb(10)
        t_load = time.perf_counter()
        audio, _ = load_audio(process_path, sr=df_state.sr())
        logger.info(f"[{job_id}] Audio loaded in {time.perf_counter() - t_load:.2f}s")

        # Process in chunks of 5 seconds to prevent memory overflow and provide progress
        chunk_len_sec = 5.0
        chunk_samples = int(chunk_len_sec * df_state.sr())
        total_samples = audio.shape[-1]
        duration_sec = total_samples / df_state.sr()
        logger.info(f"[{job_id}] Processing {duration_sec:.1f}s of audio in {max(1, (total_samples + chunk_samples - 1) // chunk_samples)} chunk(s)")

        enhanced_chunks = []
        t_proc = time.perf_counter()

        # 10% = load; 10–90% = chunk processing; 90–100% = save
        for start in range(0, total_samples, chunk_samples):
            if job_id and job_id in cancellation_events and cancellation_events[job_id].is_set():
                logger.info(f"[{job_id}] Cancellation detected at sample {start}/{total_samples}")
                raise JobCancelledError(f"Job {job_id} was cancelled by user.")

            end = min(start + chunk_samples, total_samples)
            chunk = audio[..., start:end]
            processed_chunk = enhance(model, df_state, chunk, atten_lim_db=atten_lim_db)
            enhanced_chunks.append(processed_chunk)

            progress_pct = int(10 + (end / total_samples) * 80)
            progress_cb(progress_pct)

        logger.info(f"[{job_id}] Chunk processing done in {time.perf_counter() - t_proc:.2f}s")

        progress_cb(90)
        enhanced_audio = torch.cat(enhanced_chunks, dim=-1)

        t_save = time.perf_counter()
        # DeepFilterNet's save_audio writes via soundfile — natively supports WAV, FLAC, OGG.
        # For other formats (MP3, AAC, M4A, OPUS, WMA) we save to a temp WAV first, then
        # convert via ffmpeg.
        output_ext = pathlib.Path(output_path).suffix.lower().lstrip('.')
        _SOUNDFILE_SAVE_NATIVE = {'wav', 'flac', 'ogg', 'aiff', 'aif'}
        if output_ext in _SOUNDFILE_SAVE_NATIVE:
            save_audio(output_path, enhanced_audio, df_state.sr())
        else:
            # Save intermediate WAV to temp dir then convert
            wav_tmp = str(pathlib.Path(tmp_dir) / "enhanced_out.wav")
            save_audio(wav_tmp, enhanced_audio, df_state.sr())
            logger.info(f"[{job_id}] Converting WAV → {output_ext.upper()} via ffmpeg")
            conv_result = subprocess.run(
                [_ffmpeg_exe(), '-y', '-i', wav_tmp, output_path],
                capture_output=True,
                text=True,
            )
            # Always clean up the intermediate WAV
            try:
                os.unlink(wav_tmp)
            except OSError:
                pass
            if conv_result.returncode != 0:
                raise RuntimeError(
                    f"ffmpeg post-conversion failed (exit {conv_result.returncode}): {conv_result.stderr[-400:]}"
                )
        logger.info(f"[{job_id}] Saved to {output_path!r} in {time.perf_counter() - t_save:.2f}s")

        progress_cb(100)
        logger.info(f"[{job_id}] Total enhance_file time: {time.perf_counter() - t_total:.2f}s")
    finally:
        if needs_cleanup:
            try:
                os.unlink(process_path)
            except OSError:
                pass
        # Only remove the tmp_dir if we created it via tempfile (not scratch disk)
        if not os.environ.get("SCRATCH_DISK_DIR", "").strip():
            try:
                os.rmdir(tmp_dir)
            except OSError:
                pass
