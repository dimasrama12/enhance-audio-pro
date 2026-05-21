import os
import pathlib
from typing import Callable

_model = None


def _get_device() -> str:
    import torch
    return "cuda" if torch.cuda.is_available() else "cpu"


def _load_model():
    global _model
    if _model is not None:
        return _model

    from demucs.pretrained import get_model

    appdata = os.environ.get("APPDATA", str(pathlib.Path.home()))
    torch_home = pathlib.Path(appdata) / "enhance-audio-pro" / "models" / "torch"
    os.environ.setdefault("TORCH_HOME", str(torch_home))

    _model = get_model("htdemucs_ft")
    _model = _model.to(_get_device())
    return _model


def separate_file(
    input_path: str,
    output_dir: str,
    progress_cb: Callable[[int], None],
) -> None:
    """Separate input_path into stems (vocals, drums, bass, other) in output_dir."""
    import torch
    import torchaudio
    from demucs.apply import apply_model
    from demucs.audio import convert_audio

    model = _load_model()
    device = _get_device()

    progress_cb(10)
    wav, sr = torchaudio.load(input_path)
    wav = convert_audio(wav, sr, model.samplerate, model.audio_channels)
    wav = wav.unsqueeze(0).to(device)

    progress_cb(30)
    with torch.no_grad():
        sources = apply_model(model, wav, device=device)[0]

    progress_cb(90)
    out = pathlib.Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    stem_name = pathlib.Path(input_path).stem

    for i, stem in enumerate(model.sources):
        stem_path = out / f"{stem}_{stem_name}.wav"
        torchaudio.save(str(stem_path), sources[i].cpu(), model.samplerate)

    progress_cb(100)
