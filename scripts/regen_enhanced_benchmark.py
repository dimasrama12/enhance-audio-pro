"""
regen_enhanced_benchmark.py

Regenerate the "aplikasi(baru)" benchmark variant by running the CURRENT
enhance pipeline (backend/processors/enhance_speech.py:enhance_file) on every
*_asli.wav sample, so audio_quality_benchmark.py can compare the improved
pipeline against asli / aplikasi(50) / aplikasi(100) / website.

Runs the real DeepFilterNet model outside the frozen exe, so it re-applies the
same torchaudio compat shim the PyInstaller rthook injects.

Usage (system Python 3.11 that has deepfilternet + torch installed):
    py -3.11 scripts/regen_enhanced_benchmark.py

Env overrides:
    EAP_STRENGTH        strength 0.0-1.0 (default 0.5, matches the app default 50)
    EAP_HF_SHELF_DB     high-shelf gain dB (default -6; set 0 to disable stage)
    EAP_HF_SHELF_FREQ   shelf centre Hz (default 3500)
    EAP_ENV_SMOOTH      1 to enable envelope de-pumping (default off)
    EAP_SUFFIX          output variant suffix (default "aplikasi(baru)")
    EAP_SAMPLE_FOLDER   override sample folder
"""
import os
import sys
import glob
import pathlib

# --- torchaudio compat shim (mirror of backend/rthooks/pyi_rth_torchaudio_compat.py) ---
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
import types
from dataclasses import dataclass
import soundfile as sf  # noqa: E402
import torch  # noqa: E402


@dataclass
class AudioMetaData:
    sample_rate: int
    num_frames: int
    num_channels: int
    bits_per_sample: int
    encoding: str


_backend = types.ModuleType("torchaudio.backend")
_common = types.ModuleType("torchaudio.backend.common")
_common.AudioMetaData = AudioMetaData
_backend.common = _common
sys.modules.setdefault("torchaudio.backend", _backend)
sys.modules.setdefault("torchaudio.backend.common", _common)
import torchaudio  # noqa: E402


def _load_shim(file, frame_offset=0, num_frames=-1, normalize=True, channels_first=True, **kwargs):
    frames = num_frames if (num_frames is not None and num_frames >= 0) else -1
    data, sr = sf.read(file, start=frame_offset, frames=frames, dtype="float32")
    tensor = torch.from_numpy(data)
    if tensor.ndim == 1:
        tensor = tensor.unsqueeze(0)
    elif channels_first:
        tensor = tensor.T
    return tensor, sr


def _save_shim(file, src, sample_rate, channels_first=True, **kwargs):
    data = src.cpu().numpy()
    if channels_first:
        data = data.T
    sf.write(file, data, sample_rate)


def _info_shim(file, **kwargs):
    info_sf = sf.info(file)
    return AudioMetaData(
        sample_rate=info_sf.samplerate,
        num_frames=info_sf.frames,
        num_channels=info_sf.channels,
        bits_per_sample=16,
        encoding="PCM_S",
    )


torchaudio.load = _load_shim
torchaudio.save = _save_shim
torchaudio.info = _info_shim
torchaudio.backend = _backend
sys.modules["torchaudio"].backend = _backend

# --- make backend importable ---
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

# Point DeepFilterNet at a writable model dir (downloads the ~50MB model once).
MODELS_DIR = os.environ.get(
    "MODELS_DIR",
    str(pathlib.Path(os.environ.get("APPDATA", str(pathlib.Path.home())))
        / "enhance-audio-pro" / "models" / "deepfilter"),
)
os.environ["MODELS_DIR"] = MODELS_DIR
pathlib.Path(MODELS_DIR).mkdir(parents=True, exist_ok=True)

from processors.enhance_speech import enhance_file  # noqa: E402

SAMPLE_FOLDER = os.environ.get(
    "EAP_SAMPLE_FOLDER",
    r"C:\Users\User\OneDrive\Documents\kp dimas\tes audio video kp\tes audio berdasarkan noise",
)
SUFFIX = os.environ.get("EAP_SUFFIX", "aplikasi(baru)")
STRENGTH = float(os.environ.get("EAP_STRENGTH", "0.5"))


def main() -> None:
    asli_files = sorted(glob.glob(os.path.join(SAMPLE_FOLDER, "*_asli.wav")))
    if not asli_files:
        print(f"[ERROR] No *_asli.wav found in {SAMPLE_FOLDER}")
        sys.exit(1)

    print(f"Strength={STRENGTH}  HF_SHELF_DB={os.environ.get('EAP_HF_SHELF_DB','-6(default)')}  "
          f"ENV_SMOOTH={os.environ.get('EAP_ENV_SMOOTH','off')}  suffix={SUFFIX!r}")
    print(f"Model dir: {MODELS_DIR}")

    for asli in asli_files:
        base = os.path.basename(asli)
        key = base[: -len("_asli.wav")]
        out = os.path.join(SAMPLE_FOLDER, f"{key}_{SUFFIX}.wav")
        print(f"  {base}  ->  {os.path.basename(out)}")

        def _progress(pct: int) -> None:
            pass

        enhance_file(asli, out, _progress, strength=STRENGTH, job_id=f"bench_{key}")

    print("Done. Now run: py -3.11 audio_quality_benchmark.py")


if __name__ == "__main__":
    main()
