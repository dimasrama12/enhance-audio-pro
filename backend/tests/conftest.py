"""
Session-wide mocks for torch, torchaudio, deepfilternet, and demucs.
These packages are large and not installed in the dev/CI test environment.
Individual tests can override specific mock behaviour via patch.dict(sys.modules, ...).
"""
import sys
from unittest.mock import MagicMock

# --- DeepFilterNet mocks ---
_mock_df_state = MagicMock()
_mock_df_state.sr.return_value = 48000

_mock_df_model = MagicMock()
_mock_df_model.to.return_value = _mock_df_model

_mock_df_enhance = MagicMock()
_mock_df_enhance.init_df.return_value = (_mock_df_model, _mock_df_state, None)
_mock_df_enhance.load_audio.return_value = (MagicMock(), 48000)
_mock_df_enhance.enhance.return_value = MagicMock()
_mock_df_enhance.save_audio = MagicMock()

_mock_torch = MagicMock()
_mock_torch.cuda.is_available.return_value = False

# torchaudio.load must return a 2-tuple (wav_tensor, sample_rate)
_mock_torchaudio = MagicMock()
_mock_torchaudio.load.return_value = (MagicMock(), 44100)

# --- Demucs mocks ---
_mock_demucs_stem = MagicMock()
_mock_demucs_stem.cpu.return_value = _mock_demucs_stem

_mock_demucs_sources = MagicMock()
_mock_demucs_sources.__getitem__ = lambda self, i: _mock_demucs_stem

_mock_demucs_model = MagicMock()
_mock_demucs_model.sources = ["vocals", "drums", "bass", "other"]
_mock_demucs_model.samplerate = 44100
_mock_demucs_model.audio_channels = 2
_mock_demucs_model.to.return_value = _mock_demucs_model

_mock_demucs_pretrained = MagicMock()
_mock_demucs_pretrained.get_model.return_value = _mock_demucs_model

_mock_demucs_apply = MagicMock()
_mock_demucs_apply.apply_model.return_value = [_mock_demucs_sources]

_mock_demucs_audio = MagicMock()
_mock_demucs_audio.convert_audio.return_value = MagicMock()

for _mod, _mock in [
    ("torch", _mock_torch),
    ("torchaudio", _mock_torchaudio),
    ("df", MagicMock(enhance=_mock_df_enhance)),
    ("df.enhance", _mock_df_enhance),
    ("demucs", MagicMock()),
    ("demucs.pretrained", _mock_demucs_pretrained),
    ("demucs.apply", _mock_demucs_apply),
    ("demucs.audio", _mock_demucs_audio),
]:
    sys.modules.setdefault(_mod, _mock)
