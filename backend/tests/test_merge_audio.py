from unittest.mock import MagicMock, patch
import pytest


@pytest.fixture(autouse=True)
def reload_module():
    import sys
    sys.modules.pop("processors.merge_audio", None)
    yield
    sys.modules.pop("processors.merge_audio", None)


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


def test_merge_requires_at_least_two_files(tmp_path):
    from processors.merge_audio import merge_files
    with pytest.raises(ValueError, match="at least 2"):
        merge_files(["/only_one.wav"], str(tmp_path / "out.wav"), 0.0, lambda _: None)


def test_merge_concat_calls_ffmpeg(tmp_path):
    with patch("subprocess.run", return_value=_ok()) as mock_run:
        from processors.merge_audio import merge_files
        merge_files(["/a.wav", "/b.wav"], str(tmp_path / "out.wav"), 0.0, lambda _: None)
    cmd = " ".join(mock_run.call_args[0][0])
    assert "concat" in cmd


def test_merge_crossfade_uses_acrossfade_filter(tmp_path):
    with patch("subprocess.run", return_value=_ok()) as mock_run:
        from processors.merge_audio import merge_files
        merge_files(["/a.wav", "/b.wav"], str(tmp_path / "out.wav"), 2.0, lambda _: None)
    cmd = " ".join(mock_run.call_args[0][0])
    assert "acrossfade" in cmd


def test_loop_uses_stream_loop_flag(tmp_path):
    with patch("subprocess.run", return_value=_ok()) as mock_run:
        from processors.merge_audio import loop_audio
        loop_audio("/in.wav", str(tmp_path / "out.wav"), 3600.0, lambda _: None)
    cmd = mock_run.call_args[0][0]
    assert "-stream_loop" in cmd
    assert "3600.0" in cmd


def test_merge_raises_on_ffmpeg_failure(tmp_path):
    with patch("subprocess.run", return_value=_fail()):
        from processors.merge_audio import merge_files
        with pytest.raises(RuntimeError, match="ffmpeg merge failed"):
            merge_files(["/a.wav", "/b.wav"], str(tmp_path / "out.wav"), 0.0, lambda _: None)


def test_loop_raises_on_ffmpeg_failure(tmp_path):
    with patch("subprocess.run", return_value=_fail()):
        from processors.merge_audio import loop_audio
        with pytest.raises(RuntimeError, match="ffmpeg loop failed"):
            loop_audio("/in.wav", str(tmp_path / "out.wav"), 60.0, lambda _: None)
