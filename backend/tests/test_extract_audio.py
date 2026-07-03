import io
from unittest.mock import MagicMock, patch
import pytest


@pytest.fixture(autouse=True)
def reload_module():
    import sys
    sys.modules.pop("processors.extract_audio", None)
    yield
    sys.modules.pop("processors.extract_audio", None)


@pytest.fixture(autouse=True)
def stub_ffmpeg_exe():
    # get_ffmpeg_exe() shells out to `ffmpeg -version` via subprocess; the tests
    # patch subprocess.Popen, so resolve the binary path to a fixed stub instead.
    with patch("imageio_ffmpeg.get_ffmpeg_exe", return_value="ffmpeg"):
        yield


class FakePopen:
    """Stand-in for subprocess.Popen used by the streaming extraction path."""

    def __init__(self, returncode=0, stdout_lines=None, stderr=""):
        self.returncode = returncode
        self.stdout = iter(stdout_lines if stdout_lines is not None else ["progress=end\n"])
        self.stderr = io.StringIO(stderr)

    def wait(self):
        return self.returncode


def _probe(stderr=""):
    """Stand-in for the subprocess.run duration probe (always exits non-zero)."""
    m = MagicMock()
    m.returncode = 1
    m.stderr = stderr
    return m


def test_progress_cb_streams_percentage(tmp_path):
    # 10s total; ffmpeg reports 5s processed → 50%, then end → 100%.
    popen = FakePopen(stdout_lines=["out_time_us=5000000\n", "progress=end\n"])
    with patch("subprocess.run", return_value=_probe("Duration: 00:00:10.00, start: 0.0")), \
         patch("subprocess.Popen", return_value=popen):
        from processors.extract_audio import extract_audio
        calls = []
        extract_audio("/in.mp4", str(tmp_path / "out.mp3"), calls.append)
    assert 50 in calls
    assert calls[-1] == 100


def test_ffmpeg_strips_video_and_maps_audio(tmp_path):
    popen = FakePopen()
    with patch("subprocess.run", return_value=_probe()), \
         patch("subprocess.Popen", return_value=popen) as mock_popen:
        from processors.extract_audio import extract_audio
        out = str(tmp_path / "clip.mp3")
        extract_audio("/videos/clip.mkv", out, lambda _: None, fmt="mp3")
    cmd = mock_popen.call_args[0][0]
    assert "/videos/clip.mkv" in cmd
    assert out in cmd
    assert "-vn" in cmd                 # video dropped
    assert "0:a:0?" in cmd              # first audio stream, optional
    assert "libmp3lame" in cmd          # default mp3 codec
    assert "-y" in cmd
    assert "-progress" in cmd           # live progress streaming enabled


def test_raises_on_ffmpeg_nonzero_exit(tmp_path):
    popen = FakePopen(returncode=1, stderr="Invalid data found when processing input")
    with patch("subprocess.run", return_value=_probe()), \
         patch("subprocess.Popen", return_value=popen):
        from processors.extract_audio import extract_audio
        with pytest.raises(RuntimeError, match="ffmpeg failed"):
            extract_audio("/in.mp4", str(tmp_path / "out.mp3"), lambda _: None)


def test_no_audio_stream_gives_friendly_error(tmp_path):
    popen = FakePopen(returncode=1, stderr="Output file does not contain any stream")
    with patch("subprocess.run", return_value=_probe()), \
         patch("subprocess.Popen", return_value=popen):
        from processors.extract_audio import extract_audio
        with pytest.raises(RuntimeError, match="No audio track"):
            extract_audio("/in.mp4", str(tmp_path / "out.mp3"), lambda _: None)


def test_supported_video_formats_includes_common_types():
    from processors.extract_audio import SUPPORTED_VIDEO_FORMATS
    for fmt in ["mp4", "mov", "mkv"]:
        assert fmt in SUPPORTED_VIDEO_FORMATS
