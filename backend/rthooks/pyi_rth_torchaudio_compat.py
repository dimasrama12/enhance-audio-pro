"""
Runtime hook: compatibility shim for torchaudio.backend.common.AudioMetaData.
torchaudio 2.x removed torchaudio.backend; deepfilternet (df) still imports from it.
Also shims torchaudio.load, save, and info using soundfile to avoid torchcodec dependencies.
Injected before any app code runs so the imports and loads succeed.
"""
import sys

# Do not apply compat shims during pytest runs to avoid breaking session-wide MagicMocks
if "pytest" not in sys.modules and not any("pytest" in arg for arg in sys.argv):
    import types
    from dataclasses import dataclass
    import soundfile as sf
    import torch

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

    # Back-patch torchaudio if already loaded
    import torchaudio

    def load_shim(file, frame_offset=0, num_frames=-1, normalize=True, channels_first=True, **kwargs):
        frames = num_frames if (num_frames is not None and num_frames >= 0) else -1
        data, sr = sf.read(file, start=frame_offset, frames=frames, dtype='float32')
        tensor = torch.from_numpy(data)
        if tensor.ndim == 1:
            tensor = tensor.unsqueeze(0)  # [1, T]
        elif channels_first:
            tensor = tensor.T  # [C, T]
        return tensor, sr

    def save_shim(file, src, sample_rate, channels_first=True, **kwargs):
        data = src.cpu().numpy()
        if channels_first:
            data = data.T
        sf.write(file, data, sample_rate)

    def info_shim(file, **kwargs):
        info_sf = sf.info(file)
        return AudioMetaData(
            sample_rate=info_sf.samplerate,
            num_frames=info_sf.frames,
            num_channels=info_sf.channels,
            bits_per_sample=16,
            encoding="PCM_S"
        )

    torchaudio.load = load_shim
    torchaudio.save = save_shim
    torchaudio.info = info_shim
    torchaudio.backend = _backend
    if "torchaudio" in sys.modules:
        sys.modules["torchaudio"].backend = _backend
