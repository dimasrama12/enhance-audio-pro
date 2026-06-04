import sys
import os
import types
from dataclasses import dataclass
import traceback
import pathlib
import soundfile as sf
import torch

# Shim torchaudio.backend and torchaudio.info
@dataclass
class AudioMetaData:
    sample_rate: int
    num_frames: int
    num_channels: int
    bits_per_sample: int
    encoding: str

_backend = types.ModuleType("torchaudio.backend")
_common = types.ModuleType("torchaudio.backend.common")
_common.AudioMetaData = AudioMetaData
_backend.common = _common
sys.modules.setdefault("torchaudio.backend", _backend)
sys.modules.setdefault("torchaudio.backend.common", _common)

import torchaudio

def load_shim(file, frame_offset=0, num_frames=-1, normalize=True, channels_first=True, **kwargs):
    # soundfile expects frames to be -1 to read all, or a positive integer
    frames = num_frames if (num_frames is not None and num_frames >= 0) else -1
    
    # Read using soundfile
    data, sr = sf.read(file, start=frame_offset, frames=frames, dtype='float32')
    tensor = torch.from_numpy(data)
    if tensor.ndim == 1:
        tensor = tensor.unsqueeze(0)  # [1, T]
    elif channels_first:
        tensor = tensor.T  # [C, T]
    return tensor, sr

def save_shim(file, src, sample_rate, channels_first=True, **kwargs):
    data = src.cpu().numpy()
    if channels_first:
        data = data.T
    sf.write(file, data, sample_rate)

def info_shim(file, **kwargs):
    # Get info using soundfile
    info_sf = sf.info(file)
    return AudioMetaData(
        sample_rate=info_sf.samplerate,
        num_frames=info_sf.frames,
        num_channels=info_sf.channels,
        bits_per_sample=16,  # Dummy
        encoding="PCM_S"    # Dummy
    )

torchaudio.load = load_shim
torchaudio.save = save_shim
torchaudio.info = info_shim
if "torchaudio" in sys.modules:
    sys.modules["torchaudio"].backend = _backend

try:
    print("Attempting to import df.enhance...")
    from df.enhance import init_df, load_audio, save_audio, enhance
    print("Import: SUCCESS")
    
    # Load model
    model, df_state, _ = init_df()
    print("Model loaded successfully.")
    
    # Test files
    test_files = [
        r"D:\vibe coding\New folder\tes audio2.wav",
        r"D:\vibe coding\New folder\tes audio2.mp3"
    ]
    
    for fp in test_files:
        print(f"\n--- Testing file: {fp} ---")
        if not os.path.exists(fp):
            print("File does not exist.")
            continue
            
        try:
            print("Loading audio...")
            audio, epoch = load_audio(fp, sr=df_state.sr())
            print("Load audio: SUCCESS")
            print("Audio shape:", audio.shape)
            
            # Try a small enhancement step
            print("Enhancing...")
            chunk = audio[..., :int(5 * df_state.sr())]  # 5 seconds
            processed = enhance(model, df_state, chunk, atten_lim_db=10.0)
            print("Enhancement: SUCCESS")
            print("Processed shape:", processed.shape)
            
            # Try saving audio
            out_fp = fp.replace(".wav", "_enhanced_test.wav").replace(".mp3", "_enhanced_test.mp3")
            print(f"Saving to {out_fp}...")
            save_audio(out_fp, processed, df_state.sr())
            print("Save audio: SUCCESS")
            if os.path.exists(out_fp):
                os.remove(out_fp)
                print("Cleaned up saved test file.")
                
        except Exception as e:
            print("FAILED for file:")
            traceback.print_exc()
            
except Exception as e:
    print("--- ERROR OCCURRED ---")
    traceback.print_exc()
