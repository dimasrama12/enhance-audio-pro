"""
Runtime hook: compatibility shim for torchaudio.backend.common.AudioMetaData.
torchaudio 2.x removed torchaudio.backend; deepfilternet (df) still imports from it.
Injected before any app code runs so the import succeeds.
"""
import sys
import types
from dataclasses import dataclass


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
if "torchaudio" in sys.modules:
    sys.modules["torchaudio"].backend = _backend
