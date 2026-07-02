from unittest.mock import MagicMock, patch
import pytest


@pytest.fixture(autouse=True)
def reload_module():
    import sys
    sys.modules.pop("processors.extract_audio", None)
    yield
    sys.modules.pop("processors.extract_audio", None)


def _ok():
    m = MagicMock()
    m.returncode = 0
    m.stderr = ""
    return m


def _fail(stderr="Invalid data found when processing input"):
    m = MagicMock()
    m.returncode = 1
    m.stderr = stderr
    return m


def test_progress_cb_called_at_10_and_100(tmp_path):
    with patch("subprocess.run", return_value=_ok()):
        from processors.extract_audio import extract_audio
        calls = []
        extract_audio("/in.mp4", str(tmp_path / "out.mp3"), calls.append)
    assert 10 in calls
    assert calls[-1] == 100


def test_ffmpeg_strips_video_and_maps_audio(tmp_path):
    with patch("subprocess.run", return_value=_ok()) as mock_run:
        from processors.extract_audio import extract_audio
        out = str(tmp_path / "clip.mp3")
        extract_audio("/videos/clip.mkv", out, lambda _: None, fmt="mp3")
    cmd = mock_run.call_args[0][0]
    assert "/videos/clip.mkv" in cmd
    assert out in cmd
    assert "-vn" in cmd                 # video dropped
    assert "0:a:0?" in cmd              # first audio stream, optional
    assert "libmp3lame" in cmd          # default mp3 codec
    assert "-y" in cmd


def test_raises_on_ffmpeg_nonzero_exit(tmp_path):
    with patch("subprocess.run", return_value=_fail()):
        from processors.extract_audio import extract_audio
        with pytest.raises(RuntimeError, match="ffmpeg failed"):
            extract_audio("/in.mp4", str(tmp_path / "out.mp3"), lambda _: None)


def test_no_audio_stream_gives_friendly_error(tmp_path):
    with patch("subprocess.run", return_value=_fail("Output file does not contain any stream")):
        from processors.extract_audio import extract_audio
        with pytest.raises(RuntimeError, match="No audio track"):
            extract_audio("/in.mp4", str(tmp_path / "out.mp3"), lambda _: None)


def test_supported_video_formats_includes_common_types():
    from processors.extract_audio import SUPPORTED_VIDEO_FORMATS
    for fmt in ["mp4", "mov", "mkv"]:
        assert fmt in SUPPORTED_VIDEO_FORMATS
