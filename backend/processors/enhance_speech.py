import os
import pathlib
from typing import Callable

# Module-level cache — loaded once per sidecar lifetime, never per-job.
_model = None
_df_state = None


def _get_device() -> str:
    import torch
    return "cuda" if torch.cuda.is_available() else "cpu"


def _load_model():
    global _model, _df_state
    if _model is not None:
        return _model, _df_state

    from df.enhance import init_df

    appdata = os.environ.get("APPDATA", str(pathlib.Path.home()))
    models_dir = pathlib.Path(appdata) / "enhance-audio-pro" / "models" / "deepfilter"
    os.environ.setdefault("DFHOME", str(models_dir))

    _model, _df_state, _ = init_df()
    _model = _model.to(_get_device())
    return _model, _df_state


def enhance_file(
    input_path: str,
    output_path: str,
    progress_cb: Callable[[int], None],
) -> None:
    """Remove noise from input_path using DeepFilterNet3, write result to output_path."""
    from df.enhance import enhance, load_audio, save_audio

    model, df_state = _load_model()

    progress_cb(10)
    audio, _ = load_audio(input_path, sr=df_state.sr())

    progress_cb(30)
    enhanced = enhance(model, df_state, audio)

    progress_cb(90)
    save_audio(output_path, enhanced, df_state.sr())

    progress_cb(100)
