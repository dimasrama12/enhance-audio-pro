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


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        logger.warning(f"Invalid float for {name}={raw!r}; using default {default}")
        return default


def _env_flag(name: str, default: bool) -> bool:
    raw = os.environ.get(name, "").strip().lower()
    if not raw:
        return default
    return raw not in ("0", "false", "off", "no")


# ---------------------------------------------------------------------------
# Post-DeepFilterNet DSP (see PLAN.md). DeepFilterNet itself does NOT attenuate
# high-frequency hiss and introduces frame-to-frame musical noise (pumping).
# These stages run AFTER the model output and BEFORE saving. Each is
# independently togg/tunable via env vars so its impact can be measured alone.
# ---------------------------------------------------------------------------

def _apply_hf_shelf(audio, sr: int, gain_db_override: Optional[float] = None):
    """Module 1 — light high-shelf to attenuate residual HF hiss (~3-8 kHz).

    Mimics the HF energy cut Adobe Podcast performs (~-56% band energy) which
    DeepFilterNet does not. gain_db < 0 cuts HF; gain_db >= 0 disables the stage.
    Default -4 dB @ 3500 Hz validated on the 5-sample benchmark: Δ HF-energy ≈ -40%
    (vs -0.8% before; target -30..-45%), STOI preserved (0.847). See PLAN.md.
    gain_db_override: if provided (from per-request setting), takes precedence over env var.
    Env: EAP_HF_SHELF_DB (default -4), EAP_HF_SHELF_FREQ (3500), EAP_HF_SHELF_Q (0.707).
    """
    gain_db = gain_db_override if gain_db_override is not None else _env_float("EAP_HF_SHELF_DB", -4.0)
    if gain_db >= 0.0:
        return audio
    freq = _env_float("EAP_HF_SHELF_FREQ", 3500.0)
    q = _env_float("EAP_HF_SHELF_Q", 0.707)
    # pyrefly: ignore [missing-import]
    import torchaudio
    logger.info(f"HF shelf: gain={gain_db:.1f}dB freq={freq:.0f}Hz Q={q:.3f}")
    return torchaudio.functional.treble_biquad(audio, sr, gain=gain_db, central_freq=freq, Q=q)


def _apply_envelope_smoothing(audio, sr: int):
    """Module 2b — de-pumping envelope follower to reduce musical noise / jitter.

    Computes a short-time RMS envelope, smooths it with an asymmetric
    attack/release one-pole, and applies a bounded (±max_db) corrective gain so
    rapid amplitude excursions (pumping) are tamed without flattening real
    speech dynamics. Enabled by default; set EAP_ENV_SMOOTH=0 to disable.
    Default attack 5 / release 50 / ±3 dB validated on the benchmark: Δ jitter
    +55% → +16.6% (below Adobe's +19.5%), STOI 0.847, envelope corr 0.814. See PLAN.md.
    Env: EAP_ENV_SMOOTH (on), EAP_ENV_ATTACK_MS (5), EAP_ENV_RELEASE_MS (50),
         EAP_ENV_MAX_DB (3).
    """
    if not _env_flag("EAP_ENV_SMOOTH", True):
        return audio
    # pyrefly: ignore [missing-import]
    import torch
    # pyrefly: ignore [missing-import]
    import numpy as np

    attack_ms = _env_float("EAP_ENV_ATTACK_MS", 5.0)
    release_ms = _env_float("EAP_ENV_RELEASE_MS", 50.0)
    max_db = _env_float("EAP_ENV_MAX_DB", 3.0)

    hop = max(1, int(sr * 0.010))          # 10 ms hop (matches DFN frame rate)
    frame = max(hop, int(sr * 0.020))      # 20 ms window
    x = audio.detach().to(torch.float32)
    mono = x.mean(dim=0) if x.dim() > 1 else x
    n = mono.shape[-1]

    # Frame RMS envelope
    n_frames = max(1, (n - frame) // hop + 1)
    idx = torch.arange(n_frames) * hop
    env = torch.empty(n_frames, dtype=torch.float32)
    for i in range(n_frames):
        s = int(idx[i].item())
        seg = mono[s:s + frame]
        env[i] = torch.sqrt(torch.clamp((seg * seg).mean(), min=1e-12))

    # Asymmetric one-pole smoothing (attack fast, release slow)
    a_att = float(torch.exp(torch.tensor(-1.0 / max(1.0, (attack_ms / 1000.0) * (sr / hop)))))
    a_rel = float(torch.exp(torch.tensor(-1.0 / max(1.0, (release_ms / 1000.0) * (sr / hop)))))
    sm = torch.empty_like(env)
    prev = env[0]
    for i in range(n_frames):
        cur = env[i]
        coeff = a_att if cur > prev else a_rel
        prev = coeff * prev + (1.0 - coeff) * cur
        sm[i] = prev

    # Bounded corrective gain (dB), then upsample to per-sample and apply
    lim = 10.0 ** (max_db / 20.0)
    gain_frames = torch.clamp(sm / torch.clamp(env, min=1e-12), 1.0 / lim, lim)
    # Linear interpolation of frame gains to sample resolution
    centers = idx.to(torch.float32) + frame / 2.0
    samp = torch.arange(n, dtype=torch.float32)
    gain_samp = torch.from_numpy(
        np.interp(samp.numpy(), centers.numpy(), gain_frames.numpy())
    ).to(torch.float32)
    logger.info(f"Envelope smoothing: attack={attack_ms}ms release={release_ms}ms max={max_db}dB")
    return audio * gain_samp.unsqueeze(0) if audio.dim() > 1 else audio * gain_samp


def _post_process(audio, sr: int, hf_shelf_db: Optional[float] = None):
    """Run all enabled post-DFN DSP stages in order (HF shelf → env smoothing)."""
    audio = _apply_hf_shelf(audio, sr, gain_db_override=hf_shelf_db)
    audio = _apply_envelope_smoothing(audio, sr)
    return audio

def build_suffixed_path(output_path: str, strength: float, hf_shelf_db: float) -> str:
    """Return output_path with strength/HF params encoded in the stem.

    strength 0.0–1.0 is displayed as integer percent (0.8 → str80).
    hf_shelf_db uses :g format (-4.0 → hf-4, -4.5 → hf-4.5).
    """
    p = pathlib.Path(output_path)
    str_val = int(round(strength * 100))
    hf_str = f"{hf_shelf_db:g}"
    return str(p.parent / f"{p.stem}_str{str_val}_hf{hf_str}{p.suffix}")


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
    hf_shelf_db: Optional[float] = None,
) -> None:
    """Remove noise from input_path using DeepFilterNet3, write result to output_path.

    strength: 0.0-1.0, maps to DeepFilterNet's atten_lim_db (attenuation limit).
        Higher = more aggressive noise suppression (less original noisy signal mixed back):
        1.0 → 40 dB (~1% dry, most aggressive), 0.5 → 20 dB (~10% dry).
        NOTE: In DeepFilterNet, atten_lim_db == 0 is treated as "no limit" = FULL
        suppression (not pass-through). We therefore clamp strength>0 to a small
        positive dB and reserve the true pass-through only for strength == 0.
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

    # Map 0.0-1.0 to atten_lim_db: strength 1.0 → 40 dB (aggressive), 0.5 → 20 dB.
    # Guard the DeepFilterNet quirk where atten_lim_db == 0 means "no limit" (full
    # suppression): any strength > 0 gets at least 1 dB so the slider stays monotonic;
    # only strength == 0 yields 0 (which the enhance() call skips entirely below).
    atten_lim_db = max(0.0, min(40.0, strength * 40.0))
    if strength > 0.0:
        atten_lim_db = max(1.0, atten_lim_db)

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

        # Post-DFN DSP: HF de-hiss shelf + optional envelope de-pumping (PLAN.md).
        t_post = time.perf_counter()
        enhanced_audio = _post_process(enhanced_audio, df_state.sr(), hf_shelf_db=hf_shelf_db)
        logger.info(f"[{job_id}] Post-processing done in {time.perf_counter() - t_post:.2f}s")

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
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)
