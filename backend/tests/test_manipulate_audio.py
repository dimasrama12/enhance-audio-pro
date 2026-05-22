from unittest.mock import MagicMock, patch
import pytest


@pytest.fixture(autouse=True)
def reload_module():
    import sys
    sys.modules.pop("processors.manipulate_audio", None)
    yield
    sys.modules.pop("processors.manipulate_audio", None)


def _ok():
    m = MagicMock()
    m.returncode = 0
    m.stderr = ""
    return m


def _fail():
    m = MagicMock()
    m.returncode = 1
    m.stderr = "no such file"
    return m


def test_trim_includes_ss_and_to_flags(tmp_path):
    with patch("subprocess.run", return_value=_ok()) as mock_run:
        from processors.manipulate_audio import trim_audio
        trim_audio("/in.wav", str(tmp_path / "out.wav"), 5.0, 30.0, lambda _: None)
    cmd = mock_run.call_args[0][0]
    assert "-ss" in cmd
    assert "5.0" in cmd
    assert "-to" in cmd
    assert "30.0" in cmd


def test_speed_uses_atempo_filter(tmp_path):
    with patch("subprocess.run", return_value=_ok()) as mock_run:
        from processors.manipulate_audio import speed_audio
        speed_audio("/in.wav", str(tmp_path / "out.wav"), 1.5, lambda _: None)
    cmd = " ".join(mock_run.call_args[0][0])
    assert "atempo=1.5" in cmd


def test_speed_chains_atempo_above_2x(tmp_path):
    with patch("subprocess.run", return_value=_ok()) as mock_run:
        from processors.manipulate_audio import speed_audio
        speed_audio("/in.wav", str(tmp_path / "out.wav"), 3.0, lambda _: None)
    cmd = " ".join(mock_run.call_args[0][0])
    assert cmd.count("atempo=") == 2


def test_pitch_uses_asetrate_and_aresample(tmp_path):
    with patch("subprocess.run", return_value=_ok()) as mock_run:
        from processors.manipulate_audio import pitch_audio
        pitch_audio("/in.wav", str(tmp_path / "out.wav"), 2, lambda _: None)
    cmd = " ".join(mock_run.call_args[0][0])
    assert "asetrate" in cmd
    assert "aresample" in cmd


def test_volume_uses_volume_filter(tmp_path):
    with patch("subprocess.run", return_value=_ok()) as mock_run:
        from processors.manipulate_audio import volume_audio
        volume_audio("/in.wav", str(tmp_path / "out.wav"), 6.0, lambda _: None)
    cmd = " ".join(mock_run.call_args[0][0])
    assert "volume=" in cmd
    assert "6.0dB" in cmd


def test_fade_includes_afade_filter(tmp_path):
    with patch("subprocess.run", return_value=_ok()) as mock_run:
        from processors.manipulate_audio import fade_audio
        fade_audio("/in.wav", str(tmp_path / "out.wav"), 2.0, 3.0, 60.0, lambda _: None)
    cmd = " ".join(mock_run.call_args[0][0])
    assert "afade" in cmd


def test_progress_cb_called_at_start_and_100(tmp_path):
    with patch("subprocess.run", return_value=_ok()):
        from processors.manipulate_audio import trim_audio
        calls = []
        trim_audio("/in.wav", str(tmp_path / "out.wav"), 0, 10, calls.append)
    assert calls[0] == 10
    assert calls[-1] == 100


def test_raises_runtime_error_on_ffmpeg_failure(tmp_path):
    with patch("subprocess.run", return_value=_fail()):
        from processors.manipulate_audio import trim_audio
        with pytest.raises(RuntimeError, match="ffmpeg failed"):
            trim_audio("/in.wav", str(tmp_path / "out.wav"), 0, 10, lambda _: None)
