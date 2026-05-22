from unittest.mock import MagicMock, patch
import pytest


@pytest.fixture(autouse=True)
def reload_module():
    import sys
    sys.modules.pop("processors.equalizer", None)
    yield
    sys.modules.pop("processors.equalizer", None)


def _ok():
    m = MagicMock()
    m.returncode = 0
    m.stderr = ""
    return m


def _fail():
    m = MagicMock()
    m.returncode = 1
    m.stderr = "error"
    return m


def test_apply_eq_raises_on_wrong_band_count(tmp_path):
    from processors.equalizer import apply_eq
    with pytest.raises(ValueError, match="11 gain values"):
        apply_eq("/in.wav", str(tmp_path / "out.wav"), [0] * 5, lambda _: None)


def test_apply_eq_calls_ffmpeg_with_equalizer_filter(tmp_path):
    with patch("subprocess.run", return_value=_ok()) as mock_run:
        from processors.equalizer import apply_eq
        gains = [0, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        apply_eq("/in.wav", str(tmp_path / "out.wav"), gains, lambda _: None)
    cmd = " ".join(mock_run.call_args[0][0])
    assert "equalizer" in cmd


def test_apply_eq_preamp_uses_volume_filter(tmp_path):
    with patch("subprocess.run", return_value=_ok()) as mock_run:
        from processors.equalizer import apply_eq
        gains = [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        apply_eq("/in.wav", str(tmp_path / "out.wav"), gains, lambda _: None)
    cmd = " ".join(mock_run.call_args[0][0])
    assert "volume=" in cmd


def test_apply_eq_all_zeros_uses_anull(tmp_path):
    with patch("subprocess.run", return_value=_ok()) as mock_run:
        from processors.equalizer import apply_eq
        apply_eq("/in.wav", str(tmp_path / "out.wav"), [0] * 11, lambda _: None)
    cmd = " ".join(mock_run.call_args[0][0])
    assert "anull" in cmd


def test_presets_dict_contains_required_presets():
    from processors.equalizer import PRESETS
    required = ["Default", "Classic", "Rock", "Dance", "Pop", "Live", "Full Bass"]
    for name in required:
        assert name in PRESETS
        assert len(PRESETS[name]) == 11


def test_apply_eq_raises_on_ffmpeg_failure(tmp_path):
    with patch("subprocess.run", return_value=_fail()):
        from processors.equalizer import apply_eq
        with pytest.raises(RuntimeError, match="ffmpeg EQ failed"):
            apply_eq("/in.wav", str(tmp_path / "out.wav"), [0] * 11, lambda _: None)
