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

    # MODELS_DIR is set by the Tauri sidecar manager (D:\enhance-audio-pro-data\models on Windows)
    models_base = os.environ.get("MODELS_DIR")
    if not models_base:
        appdata = os.environ.get("APPDATA", str(pathlib.Path.home()))
        models_base = str(pathlib.Path(appdata) / "enhance-audio-pro" / "models")
    models_dir = pathlib.Path(models_base) / "deepfilter"
    os.environ["DFHOME"] = str(models_dir)

    _model, _df_state, _ = init_df()
    _model = _model.to(_get_device())
    return _model, _df_state


def enhance_file(
    input_path: str,
    output_path: str,
    progress_cb: Callable[[int], None],
    strength: float = 1.0,
) -> None:
    """Remove noise from input_path using DeepFilterNet3, write result to output_path.

    strength: 0.0-1.0, maps to atten_lim_db (0=no effect, 1=full suppression ~40dB).
    """
    from df.enhance import enhance, load_audio, save_audio

    model, df_state = _load_model()

    # Map 0.0-1.0 to atten_lim_db: strength 1.0 → 40 dB, 0.0 → 0 dB (pass-through)
    atten_lim_db = max(0.0, min(40.0, strength * 40.0))

    pathlib.Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    progress_cb(10)
    audio, _ = load_audio(input_path, sr=df_state.sr())

    progress_cb(30)
    enhanced = enhance(model, df_state, audio, atten_lim_db=atten_lim_db)

    progress_cb(90)
    save_audio(output_path, enhanced, df_state.sr())

    progress_cb(100)
