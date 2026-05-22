import sys
import pytest


@pytest.fixture(autouse=True)
def reset_model_cache():
    """Clear module-level model cache between tests."""
    mod = sys.modules.get("processors.enhance_speech")
    if mod:
        mod._model = None
        mod._df_state = None
    yield
    mod = sys.modules.get("processors.enhance_speech")
    if mod:
        mod._model = None
        mod._df_state = None


def test_progress_callbacks_are_called_in_order():
    """enhance_file calls progress_cb at increasing values ending at 100."""
    from processors.enhance_speech import enhance_file

    calls = []
    enhance_file("/tmp/in.wav", "/tmp/out.wav", calls.append)

    assert calls[-1] == 100
    assert calls == sorted(calls), "progress must be monotonically increasing"


def test_progress_includes_start_and_end_milestones():
    """progress_cb is called at 10 and 100 at minimum."""
    from processors.enhance_speech import enhance_file

    calls = []
    enhance_file("/tmp/in.wav", "/tmp/out.wav", calls.append)

    assert 10 in calls
    assert 100 in calls


def test_save_audio_called_with_correct_output_path():
    """save_audio receives the output_path argument that was passed in."""
    from processors.enhance_speech import enhance_file

    enhance_file("/tmp/in.wav", "/tmp/out_enhanced.wav", lambda _: None)

    save_mock = sys.modules["df.enhance"].save_audio
    called_output_path = save_mock.call_args[0][0]
    assert called_output_path == "/tmp/out_enhanced.wav"


def test_model_is_loaded_lazily_not_at_import():
    """Importing the module does NOT call init_df; only enhance_file does."""
    sys.modules.pop("processors.enhance_speech", None)
    init_df_mock = sys.modules["df.enhance"].init_df
    init_df_mock.reset_mock()

    import processors.enhance_speech  # noqa: F401 — intentional bare import

    init_df_mock.assert_not_called()


def test_strength_defaults_to_full():
    """strength=1.0 maps to atten_lim_db=40.0."""
    from processors.enhance_speech import enhance_file

    enhance_file("/tmp/in.wav", "/tmp/out.wav", lambda _: None, strength=1.0)

    enhance_mock = sys.modules["df.enhance"].enhance
    _, kwargs = enhance_mock.call_args
    assert abs(kwargs.get("atten_lim_db", 0) - 40.0) < 0.01


def test_strength_zero_maps_to_zero_atten():
    """strength=0.0 results in atten_lim_db=0 (pass-through)."""
    from processors.enhance_speech import enhance_file

    enhance_file("/tmp/in.wav", "/tmp/out.wav", lambda _: None, strength=0.0)

    enhance_mock = sys.modules["df.enhance"].enhance
    _, kwargs = enhance_mock.call_args
    assert abs(kwargs.get("atten_lim_db", 999) - 0.0) < 0.01


def test_strength_half_maps_to_twenty_db():
    """strength=0.5 results in atten_lim_db=20.0."""
    from processors.enhance_speech import enhance_file

    enhance_file("/tmp/in.wav", "/tmp/out.wav", lambda _: None, strength=0.5)

    enhance_mock = sys.modules["df.enhance"].enhance
    _, kwargs = enhance_mock.call_args
    assert abs(kwargs.get("atten_lim_db", 0) - 20.0) < 0.01
