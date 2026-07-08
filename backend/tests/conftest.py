"""
Session-wide mocks for torch, torchaudio, and deepfilternet.
These packages are large and not installed in the dev/CI test environment.
Individual tests can override specific mock behaviour via patch.dict(sys.modules, ...).
"""
import platform
import sys
from unittest.mock import MagicMock

# Several processor tests patch `subprocess.run` globally to assert the ffmpeg
# command line. The processors now resolve ffmpeg via
# imageio_ffmpeg.get_ffmpeg_exe(), whose platform detection (platform.machine())
# shells out through subprocess the first time it runs. Warming Python's uname
# cache here — before any test installs a subprocess mock — lets imageio_ffmpeg
# resolve the bundled binary without hitting the mocked subprocess.
platform.uname()

# --- DeepFilterNet mocks ---
_mock_df_state = MagicMock()
_mock_df_state.sr.return_value = 48000

_mock_df_model = MagicMock()
_mock_df_model.to.return_value = _mock_df_model

_mock_df_enhance = MagicMock()
_mock_df_enhance.init_df.return_value = (_mock_df_model, _mock_df_state, None)
_mock_audio = MagicMock()
_mock_audio.shape = (1, 480000)
_mock_df_enhance.load_audio.return_value = (_mock_audio, 48000)
_mock_df_enhance.enhance.return_value = MagicMock()
_mock_df_enhance.save_audio = MagicMock()

_mock_torch = MagicMock()
_mock_torch.cuda.is_available.return_value = False

# torchaudio.load must return a 2-tuple (wav_tensor, sample_rate)
_mock_torchaudio = MagicMock()
_mock_torchaudio.load.return_value = (MagicMock(), 44100)

for _mod, _mock in [
    ("torch", _mock_torch),
    ("torchaudio", _mock_torchaudio),
    ("df", MagicMock(enhance=_mock_df_enhance)),
    ("df.enhance", _mock_df_enhance),
]:
    sys.modules.setdefault(_mod, _mock)
