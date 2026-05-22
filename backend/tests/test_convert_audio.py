from unittest.mock import MagicMock, patch
import pytest


@pytest.fixture(autouse=True)
def reload_module():
    import sys
    sys.modules.pop("processors.convert_audio", None)
    yield
    sys.modules.pop("processors.convert_audio", None)


def _ok():
    m = MagicMock()
    m.returncode = 0
    m.stderr = ""
    return m


def _fail():
    m = MagicMock()
    m.returncode = 1
    m.stderr = "No such file or directory"
    return m


def test_progress_cb_called_at_10_and_100(tmp_path):
    with patch("subprocess.run", return_value=_ok()):
        from processors.convert_audio import convert_file
        calls = []
        convert_file("/in.mp3", str(tmp_path / "out.wav"), calls.append)
    assert 10 in calls
    assert 100 in calls
    assert calls[-1] == 100


def test_raises_on_ffmpeg_nonzero_exit(tmp_path):
    with patch("subprocess.run", return_value=_fail()):
        from processors.convert_audio import convert_file
        with pytest.raises(RuntimeError, match="ffmpeg failed"):
            convert_file("/in.mp3", str(tmp_path / "out.wav"), lambda _: None)


def test_ffmpeg_called_with_input_and_output(tmp_path):
    with patch("subprocess.run", return_value=_ok()) as mock_run:
        from processors.convert_audio import convert_file
        out = str(tmp_path / "out.mp3")
        convert_file("/audio/song.wav", out, lambda _: None)
    cmd = mock_run.call_args[0][0]
    assert "/audio/song.wav" in cmd
    assert out in cmd
    assert "-y" in cmd


def test_supported_formats_includes_common_types():
    from processors.convert_audio import SUPPORTED_FORMATS
    for fmt in ["mp3", "wav", "flac", "aac", "ogg", "mp4"]:
        assert fmt in SUPPORTED_FORMATS


def test_bitrate_passed_to_ffmpeg_when_specified(tmp_path):
    with patch("subprocess.run", return_value=_ok()) as mock_run:
        from processors.convert_audio import convert_file
        out = str(tmp_path / "out.mp3")
        convert_file("/audio/song.wav", out, lambda _: None, bitrate="192k")
    cmd = mock_run.call_args[0][0]
    assert "-b:a" in cmd
    assert "192k" in cmd


def test_no_bitrate_flag_when_bitrate_empty(tmp_path):
    with patch("subprocess.run", return_value=_ok()) as mock_run:
        from processors.convert_audio import convert_file
        out = str(tmp_path / "out.wav")
        convert_file("/audio/song.wav", out, lambda _: None, bitrate="")
    cmd = mock_run.call_args[0][0]
    assert "-b:a" not in cmd
