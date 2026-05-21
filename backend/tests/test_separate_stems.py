import sys
import pytest


@pytest.fixture(autouse=True)
def reset_model_cache():
    """Clear module-level model cache between tests."""
    mod = sys.modules.get("processors.separate_stems")
    if mod:
        mod._model = None
    yield
    mod = sys.modules.get("processors.separate_stems")
    if mod:
        mod._model = None


def test_progress_callbacks_are_called_in_order(tmp_path):
    """separate_file calls progress_cb at increasing values ending at 100."""
    from processors.separate_stems import separate_file

    calls = []
    separate_file("/fake/in.wav", str(tmp_path), calls.append)

    assert calls[-1] == 100
    assert calls == sorted(calls), "progress must be monotonically increasing"


def test_progress_includes_start_and_end_milestones(tmp_path):
    """progress_cb is called at 10 and 100 at minimum."""
    from processors.separate_stems import separate_file

    calls = []
    separate_file("/fake/in.wav", str(tmp_path), calls.append)

    assert 10 in calls
    assert 100 in calls


def test_torchaudio_save_called_for_each_stem(tmp_path):
    """torchaudio.save is called once per stem — 4 times for htdemucs_ft."""
    from processors.separate_stems import separate_file

    sys.modules["torchaudio"].save.reset_mock()
    separate_file("/fake/in.wav", str(tmp_path), lambda _: None)

    assert sys.modules["torchaudio"].save.call_count == 4


def test_model_is_loaded_lazily_not_at_import():
    """Importing the module does NOT call get_model; only separate_file does."""
    sys.modules.pop("processors.separate_stems", None)
    get_model_mock = sys.modules["demucs.pretrained"].get_model
    get_model_mock.reset_mock()

    import processors.separate_stems  # noqa: F401

    get_model_mock.assert_not_called()
