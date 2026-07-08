# Changelog

All notable changes to Enhance Audio Pro are documented in this file.

---

## [0.2.0] — 2026-07-03

> Accumulated feature, UX, and stability release covering all work since v0.1.0
> (PRD refinement Tasks 1–68, per-tab architecture, the video-extraction pipeline,
> and distribution hardening). Note: the built installer/bundle identifier is still
> `0.1.0` (`Enhance Audio Pro_0.1.0_x64-setup.exe`, 367 MB) pending a formal version
> bump in `package.json` / `tauri.conf.json`.

### Added

#### Video → Audio Extraction Pipeline
- Drag-and-drop or browse **video files** (`.mp4`, `.mov`, `.mkv`, …) on the Enhance and Convert tabs — audio is demuxed in the background via bundled ffmpeg (`-vn -map 0:a:0 -c:a libmp3lame`), no size/duration limits
- Real-time extraction progress: non-blocking dimmed placeholder rows with a live linear progress bar (true ffmpeg `-progress` streamed to the UI)
- Extracted file preserves the exact original base filename (collision-avoidance hash moved into the cache directory)
- Windows drag-drop `\\?\` verbatim-path normalization so drag matches browse
- Duplicate-video detection modal (Add All / Add New Only / Cancel)

#### Per-Tab Queue Architecture
- Independent **Enhance / Convert / Separate** sub-tabs, each with a fully isolated queue, filter, search, selection, lock state, view mode, and group-by-format
- **Unlimited** file input (removed the 30 audio / 10 video batch cap)
- Per-row Enhance/Convert mode dropdown; sequential "Convert All" (one processing, rest queued, auto-advance)
- Bottom action bar (Enhance All violet / Convert All neutral); Record button relocated left of the search bar
- Completion toast with a "Download All" batch action

#### Waveform Player & Editing (PRD Tasks 43–60)
- Premiere-Pro-style continuous waveform: drag-to-seek, Alt+Scroll zoom, frame-level max zoom, manual zoom slider, hover-pan
- J/L 5-step bidirectional speed ladder with real reversed-buffer backward audio; RAF-smoothed ~60 fps playhead
- Marquee drag-selection, multi-row drag reordering, waveform auto-focus, A/B toggle in player (Enhance tab only)
- Lockable queue items (Shift+L global lock), locked-deletion safeguards, right-click overrides

#### Settings, Shortcuts & Persistence
- Modifier-aware, duplicate-free rebindable keyboard shortcuts; `Shift+1/2` view toggle, `1/2/3` tab switch, `Ctrl+R` reload
- Scratch-disk / cache directory setting; destination-path persistence; filename uniqueness
- Manual column resizing with `localStorage` persistence + Copy Width Log

### Changed
- Removed the AI-model download section from Settings (model assumed pre-bundled)
- Light mode overhauled across all major components (zinc palette, `dark:` prefixes)
- User Guide converted to plain paragraph layout with dynamic localization
- Done status badge replaces inline A/B toggle in queue rows
- Installer bundling: `nsis.compression: "none"` → full ~367 MB payload with the complete backend

### Fixed
- **Video import "Backend unavailable after 8 attempts"** — extraction retry window raised 8→45 attempts (~90 s) to cover PyInstaller sidecar cold-start
- **Installer bundled the wrong (stale msvc) sidecar** — mandated `--target x86_64-pc-windows-gnu` for full-payload installers
- **Installed-app "Unknown error during enhancement"** — clean `--clean` PyInstaller rebuild fixed mixed runtime-hook versions
- **"Export failed [WinError 2]"** — manipulate/convert/merge/equalizer processors now use bundled `imageio_ffmpeg`
- Enhance stuck/parallel process (asyncio lock, per-job heartbeat, 30-min timeout), non-native format handling (MP3/AAC via temp WAV), backend HTTP error recovery
- "Enhance All / Convert All" no longer lock when a single row is run manually
- Clean app shutdown: sidecar killed first, cache/temp swept, no orphaned backend processes
- Removed placeholder-row pulse/shimmer animation (kept only the linear progress bar)

---

## [0.1.0] — 2026-05-23

### Added

#### Core App Shell (Phase 1)
- Custom draggable titlebar, sidebar with Video/Audio tab navigation
- Drag-and-drop DropZone with format validation (30 audio / 10 video batch limit)
- Queue data grid with filename, destination, size, and status columns
- Filter, search bar, and clear queue controls
- Settings panel: theme toggle, output folder picker, language selector
- Setup Wizard with AI model download progress screen
- SQLite-backed job queue persisted to `%APPDATA%\enhance-audio-pro\app.db`
- Tauri/Rust core with Python FastAPI sidecar lifecycle (spawn, health-poll, kill)

#### AI Speech Enhancement (Phase 2)
- DeepFilterNet3 noise reduction with CUDA → CPU fallback
- Real-time progress bars driven by Tauri event bus (`queue://progress`)
- Setup Wizard downloads DeepFilterNet3 weights (~65 MB) on first launch

#### Stem Separation (Phase 3)
- Demucs `htdemucs_ft` stem separation — extracts vocals, drums, bass, other
- Separate Stems button in toolbar; outputs `{stem}_{filename}.wav` per stem

#### Audio Conversion & Packaging (Phase 4)
- Per-job output format selector: MP3, WAV, FLAC, M4A, OGG, Opus, WebM
- Global format override with Apply All to queue
- Per-job bitrate selector: Auto / 64k / 96k / 128k / 192k / 256k / 320k
- Per-job sample rate selector: Auto / 22050 / 44100 / 48000 / 96000 Hz
- Custom output filename template with `{name}`, `{date}`, `{format}` tokens
- PyInstaller one-file spec for distributable backend sidecar

#### Audio Manipulation Tools (Phase 5)
- ManipulationPanel with 8 tabs: Trim, Speed, Pitch, Volume, Fade, Merge, Loop, EQ
- 11-band parametric EQ with 18 presets (flat, bass boost, voice, etc.)
- Non-destructive: all operations write to a new output file

#### Polish, UX & Localization (Phase 6)
- WaveSurfer.js waveform player with Play/Pause/Stop and time display
- A/B toggle (original vs. enhanced) when output file available
- Enhancement strength slider (0–100) mapped to DeepFilterNet attenuation limit
- Multi-select queue: Ctrl+Click (toggle), Shift+Click (range), Click (exclusive)
- Grid / List view toggle for the queue
- 17-language localization: EN, ID, ZH, ES, DE, FR, JA, PT, KO, RU, AR, HI, IT, NL, PL, TR, VI
- Keyboard shortcuts: Ctrl+A, Escape, Delete, E, S, C (all rebindable)
- HelpPanel with 7 collapsible sections

#### Extended Features (Phase 7)
- Auto-save session state (queue view mode, filter, all settings) via Zustand persist
- Spectrogram view tab in WaveformPlayer (roseus colormap, 100 px)
- History panel showing last 50 processed files
- Custom output folder picker (system directory dialog)
- Drag-to-reorder queue items with grip handle

#### Quality & Recording (Phase 8)
- Live queue status bar: total / pending / processing / done / error pill counters
- In-app microphone recording (MediaRecorder API → adds directly to queue)
- Customizable keyboard shortcuts panel in Settings
- Queue grouping by output format toggle
- Reset All Editing button (clears all 11 manipulation parameters in one click)

#### Build & Distribution (Phase 9)
- `scripts/build-backend.ps1` — PyInstaller sidecar build script
- `scripts/build-app.ps1` — Full build orchestration (sidecar + Tauri MSI)
- `npm run build:backend` and `npm run build:full` shortcuts
- GitHub Actions release workflow (triggers on `v*` tags, produces MSI artifact)

---

### Technical Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS, Framer Motion, Zustand |
| Desktop shell | Tauri v2 (Rust) |
| AI backend | Python 3.11, FastAPI, DeepFilterNet3, Demucs htdemucs_ft |
| Audio processing | ffmpeg, torchaudio, WaveSurfer.js |
| Database | SQLite via rusqlite |
| Distribution | PyInstaller + Tauri MSI (Windows) / DMG (macOS) |

---

### Test Coverage

| Suite | Count |
|---|---|
| Vitest (frontend) | 38 / 38 passing |
| Pytest (backend) | 65 / 65 passing |
| Rust | cargo check clean |
