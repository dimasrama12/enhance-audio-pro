import os
import pathlib
import subprocess
import tempfile
import threading
from typing import Callable, Optional

# Import cancellation events dictionary from enhance_speech to share cancel state
from processors.enhance_speech import cancellation_events

class JobCancelledError(Exception):
    pass

# Formats soundfile can read natively on Windows without extra codecs
_SOUNDFILE_NATIVE = {'.wav', '.flac', '.ogg', '.aiff', '.aif'}

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
    # pyrefly: ignore [missing-import]
    from LavaSR.model import LavaEnhance2
    # pyrefly: ignore [missing-import]
    from huggingface_hub import snapshot_download

    if _model is None:
        model_path = "YatharthS/LavaSR"
        env_models_dir = os.environ.get("MODELS_DIR")
        if env_models_dir:
            cache_dir = os.path.join(env_models_dir, "lavasr")
            os.makedirs(cache_dir, exist_ok=True)
            try:
                model_path = snapshot_download("YatharthS/LavaSR", cache_dir=cache_dir, local_files_only=True)
            except Exception:
                model_path = snapshot_download("YatharthS/LavaSR", cache_dir=cache_dir)
        _model = LavaEnhance2(model_path=model_path, device=_get_device())
        
    return _model

def _to_wav_if_needed(filepath: str, tmp_dir: str) -> tuple[str, bool]:
    ext = pathlib.Path(filepath).suffix.lower()
    if ext in _SOUNDFILE_NATIVE:
        return filepath, False

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
    return tmp_path, True

def enhance_file_lavasr(
    input_path: str,
    output_path: str,
    progress_cb: Callable[[int], None],
    strength: float = 1.0, # Not strictly used by LavaSR out of the box, left for signature compat
    job_id: Optional[str] = None,
) -> None:
    # Signal immediately
    progress_cb(5)

    import torch
    import soundfile as sf
    import numpy as np

    model = _load_model()

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
        
        # Load audio using soundfile
        audio_data, sample_rate = sf.read(process_path)
        
        # Ensure mono or whatever LavaSR expects. LavaSR usually expects shape (C, T) or (1, T) for inference
        if len(audio_data.shape) > 1:
            audio_data = audio_data.mean(axis=1) # mixdown to mono
        
        audio_tensor = torch.from_numpy(audio_data).float()
        if len(audio_tensor.shape) == 1:
            audio_tensor = audio_tensor.unsqueeze(0)
            
        # Move to model device
        audio_tensor = audio_tensor.to(model.device)

        total_samples = audio_tensor.shape[-1]
        
        # Process in chunks of 5 seconds
        chunk_len_sec = 5.0
        chunk_samples = int(chunk_len_sec * sample_rate)
        
        enhanced_chunks = []
        
        for start in range(0, total_samples, chunk_samples):
            if job_id and job_id in cancellation_events and cancellation_events[job_id].is_set():
                raise JobCancelledError(f"Job {job_id} was cancelled by user.")

            end = min(start + chunk_samples, total_samples)
            chunk = audio_tensor[..., start:end]
            
            # Add batch dim if necessary: LavaEnhance2.enhance(audio)
            # Depending on LavaSR signature, it might just take the tensor. 
            # We assume it takes a 1D or 2D tensor and returns the same
            with torch.no_grad():
                processed_chunk = model.enhance(chunk)
                
            enhanced_chunks.append(processed_chunk.cpu())
            
            progress_pct = int(10 + (end / total_samples) * 80)
            progress_cb(progress_pct)
            
        progress_cb(90)
        
        enhanced_audio = torch.cat(enhanced_chunks, dim=-1)
        
        # Save output — soundfile natively supports WAV, FLAC, OGG.
        # For other formats (MP3, AAC, M4A, OPUS, WMA) save to temp WAV first then convert.
        enhanced_np = enhanced_audio.squeeze().numpy()
        output_ext = pathlib.Path(output_path).suffix.lower().lstrip('.')
        _SOUNDFILE_SAVE_NATIVE = {'wav', 'flac', 'ogg', 'aiff', 'aif'}
        if output_ext in _SOUNDFILE_SAVE_NATIVE:
            sf.write(output_path, enhanced_np, sample_rate)
        else:
            wav_tmp = str(pathlib.Path(tmp_dir) / "lavasr_out.wav")
            sf.write(wav_tmp, enhanced_np, sample_rate)
            conv_result = subprocess.run(
                [_ffmpeg_exe(), '-y', '-i', wav_tmp, output_path],
                capture_output=True,
                text=True,
            )
            try:
                os.unlink(wav_tmp)
            except OSError:
                pass
            if conv_result.returncode != 0:
                raise RuntimeError(
                    f"ffmpeg post-conversion failed (exit {conv_result.returncode}): {conv_result.stderr[-400:]}"
                )
        
        progress_cb(100)
    finally:
        if needs_cleanup:
            try:
                os.unlink(process_path)
            except OSError:
                pass
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)
