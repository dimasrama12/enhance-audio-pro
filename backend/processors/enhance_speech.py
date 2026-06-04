import os
import pathlib
import subprocess
import tempfile
from typing import Callable

# Formats soundfile can read natively on Windows without extra codecs
_SOUNDFILE_NATIVE = {'.wav', '.flac', '.ogg', '.aiff', '.aif'}

# Module-level model cache — weights loaded once per sidecar lifetime.
# df_state is NOT cached: it holds RNN hidden state that must be fresh per file.
_model = None


def _get_device() -> str:
    # pyrefly: ignore [missing-import]
    import torch
    return "cuda" if torch.cuda.is_available() else "cpu"


def _load_model():
    global _model
    # pyrefly: ignore [missing-import]
    from df.enhance import init_df

    if _model is None:
        _model, _, __ = init_df()
        _model = _model.to(_get_device())

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

    tmp_path = str(pathlib.Path(tmp_dir) / "input_converted.wav")
    result = subprocess.run(
        ['ffmpeg', '-y', '-i', filepath, tmp_path],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed to convert '{pathlib.Path(filepath).name}' to WAV "
            f"(exit {result.returncode}): {result.stderr[-400:]}"
        )
    return tmp_path, True


def enhance_file(
    input_path: str,
    output_path: str,
    progress_cb: Callable[[int], None],
    strength: float = 1.0,
) -> None:
    """Remove noise from input_path using DeepFilterNet3, write result to output_path.

    strength: 0.0-1.0, maps to atten_lim_db (0=no effect, 1=full suppression ~40dB).
    """
    # Signal immediately so the UI progress bar shows movement during model load
    progress_cb(5)

    # pyrefly: ignore [missing-import]
    import torch
    # pyrefly: ignore [missing-import]
    from df.enhance import enhance, load_audio, save_audio

    model, df_state = _load_model()

    # Map 0.0-1.0 to atten_lim_db: strength 1.0 → 40 dB, 0.0 → 0 dB (pass-through)
    atten_lim_db = max(0.0, min(40.0, strength * 40.0))

    pathlib.Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    tmp_dir = tempfile.mkdtemp()
    process_path, needs_cleanup = _to_wav_if_needed(input_path, tmp_dir)
    try:
        progress_cb(10)
        audio, _ = load_audio(process_path, sr=df_state.sr())

        # Process in chunks of 5 seconds to prevent memory overflow and provide progress
        chunk_len_sec = 5.0
        chunk_samples = int(chunk_len_sec * df_state.sr())
        total_samples = audio.shape[-1]

        enhanced_chunks = []

        # 10% = load; 10–90% = chunk processing; 90–100% = save
        for start in range(0, total_samples, chunk_samples):
            end = min(start + chunk_samples, total_samples)
            chunk = audio[..., start:end]
            processed_chunk = enhance(model, df_state, chunk, atten_lim_db=atten_lim_db)
            enhanced_chunks.append(processed_chunk)

            progress_pct = int(10 + (end / total_samples) * 80)
            progress_cb(progress_pct)

        progress_cb(90)
        enhanced_audio = torch.cat(enhanced_chunks, dim=-1)
        save_audio(output_path, enhanced_audio, df_state.sr())

        progress_cb(100)
    finally:
        if needs_cleanup:
            try:
                os.unlink(process_path)
            except OSError:
                pass
        try:
            os.rmdir(tmp_dir)
        except OSError:
            pass
