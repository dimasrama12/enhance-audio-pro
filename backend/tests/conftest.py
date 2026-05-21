"""
Session-wide mocks for torch, torchaudio, and deepfilternet.
These packages are large and not installed in the dev/CI test environment.
Individual tests can override specific mock behaviour via patch.dict(sys.modules, ...).
"""
import sys
from unittest.mock import MagicMock

_mock_df_state = MagicMock()
_mock_df_state.sr.return_value = 48000

_mock_model = MagicMock()
_mock_model.to.return_value = _mock_model

_mock_df_enhance = MagicMock()
_mock_df_enhance.init_df.return_value = (_mock_model, _mock_df_state, None)
_mock_df_enhance.load_audio.return_value = (MagicMock(), 48000)
_mock_df_enhance.enhance.return_value = MagicMock()
_mock_df_enhance.save_audio = MagicMock()

_mock_torch = MagicMock()
_mock_torch.cuda.is_available.return_value = False

for _mod, _mock in [
    ("torch", _mock_torch),
    ("torchaudio", MagicMock()),
    ("df", MagicMock(enhance=_mock_df_enhance)),
    ("df.enhance", _mock_df_enhance),
]:
    sys.modules.setdefault(_mod, _mock)
