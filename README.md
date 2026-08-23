# Enhance Audio Pro

A professional offline desktop application for AI-powered speech enhancement and audio conversion — no upload limits, no internet required.

![Version](https://img.shields.io/badge/version-0.2.4-violet) ![Platform](https://img.shields.io/badge/platform-Windows-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## What It Does

Enhance Audio Pro uses **DeepFilterNet3** — a state-of-the-art deep learning model — to remove background noise, hiss, and room reverb from voice recordings directly on your machine. Everything runs locally: no files leave your computer.

### Key Features

- **AI Speech Enhancement** — DeepFilterNet3 with post-processing (HF de-hiss shelf + envelope de-pumping) tuned to outperform Adobe Podcast on jitter while staying more natural on timbre
- **Format Conversion** — convert between MP3, WAV, FLAC, OPUS and more via bundled FFmpeg
- **Video Audio Extraction** — drag-and-drop `.mp4 / .mov / .mkv` directly; audio is extracted automatically
- **Waveform Player** — full-featured playback with zoom, J/L speed ladder, frame-level scrubbing, and A/B original/enhanced toggle
- **Batch Queue** — unlimited files, sequential processing, per-job status tracking
- **In-app Recording** — record directly into the queue
- **17 Languages** — full UI localization
- **Fully Offline** — no cloud, no account, no upload limits

---

## Quality vs Adobe Podcast (benchmark, 5 samples)

| Metric | App v0.2.3 (before) | **App v0.2.4** | Adobe Podcast |
|---|---|---|---|
| HF hiss attenuation | −0.8% | **−40%** | −56% |
| Jitter increase | +55% | **+16.6%** | +19.5% |
| STOI (intelligibility) | 0.858 | **0.847** | 0.786 |
| LTAS distance (naturalness) | 6.18 | **7.19** | 11.75 |

v0.2.4 jitter is **below** Adobe Podcast while retaining more natural timbre (lower LTAS distance).

---

## Installation

1. Download `Enhance Audio Pro_0.2.4_x64-setup.exe` from [Releases](https://github.com/dimasrama12/enhance-audio-pro/releases)
2. Run the installer — no Python or additional runtime required
3. On first launch, the app sets up automatically

**Requirements:** Windows 10/11 x64 — GPU (CUDA) recommended for faster processing, CPU fallback included.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React + TypeScript + Tailwind CSS + Framer Motion |
| Desktop shell | Tauri v2 (Rust) |
| AI / Audio processing | Python + DeepFilterNet3 + torchaudio + FFmpeg |
| Queue & settings | SQLite + Zustand |
| Distribution | PyInstaller sidecar bundled in NSIS installer |

---

## Building from Source

```powershell
# Install dependencies
npm install

# Development (hot-reload)
$env:CARGO_TARGET_DIR='D:\cargo_build\enhance-audio-pro'
npm run tauri dev

# Build Python sidecar (requires Python 3.11 + PyInstaller)
cd backend
py -3.11 -m PyInstaller build.spec --clean --noconfirm

# Build full installer (must use --target gnu, see CLAUDE.md §18.14)
$env:CARGO_TARGET_DIR='D:\cargo_build\enhance-audio-pro'
npm run tauri build -- --target x86_64-pc-windows-gnu
```

See `CLAUDE.md` for full architectural decisions, build rules, and development history.

---

## Project Structure

```
src/          # React frontend (TypeScript)
src-tauri/    # Rust / Tauri core (IPC, SQLite, sidecar lifecycle)
backend/      # Python FastAPI sidecar (DeepFilterNet, FFmpeg, conversion)
scripts/      # Build and benchmark scripts
public/       # Static assets
```

---

## License

MIT
