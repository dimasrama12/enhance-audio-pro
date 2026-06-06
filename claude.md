# CLAUDE.md — Enhance Audio Pro

> Important Note: It's best to write CLAUDE.md contents in English.
> Claude Code processes English instructions more optimally.
> This document contains guidelines, instructions, and rules for the AI Assistant developing this project.

---
## 1. Project Overview
- Name : Enhance Audio Pro
- Description : A professional desktop application designed to assist audio and video editors in enhancing, separating, and manipulating audio tracks effortlessly.
- Goal : To provide offline AI-powered speech enhancement, stem separation, and audio manipulation without upload/download limits.
- Target Users: Audio & Video Editors, Podcasters, Musicians, Content Creators.
- Version : v0.1.0 (Initial Setup)
- Status : Active development

---
## 2. Tech Stack
- Language : TypeScript (Frontend) / Python (Backend) / Rust (Tauri Core)
- Framework : Tauri (React) / PyInstaller (Backend)
- Styling : Tailwind CSS + Framer Motion (for animations)
- UI Library : shadcn/ui (recommended)
- Database : SQLite (for queue and history management)
- ORM : Drizzle or Prisma (for local SQLite)
- Auth : - (Offline Desktop App, No Auth Required)
- State Management: Zustand (React)
- Data Fetching : Tauri `invoke` (Local IPC calls to Rust/Python backend)
- Package Manager : npm / pnpm
- Deployment : Executable (.exe for Windows, .dmg/.app for macOS)

---
## 3. Commands
```bash
# Development (Frontend & Tauri)
npm run tauri dev      # Run dev server + Tauri window
npm run tauri build    # Build production installer for desktop
npm run lint           # Run linter

# Package Management
npm install [package]  # Install new package

# Python Backend (Audio Processing)
# (Add Python backend commands here later)
```

> If there are package managers that MUST NOT be used, write them here.
> Example: Use npm or pnpm consistently, do not mix them.

---
## 4. Project Structure
Architecture: By Feature / Clean Architecture
```
[root]/
  src-tauri/       # Rust codebase and Tauri config (OS Windows, IPC)
  src/             # React Frontend codebase (UI, Components, State)
  backend/         # Python codebase (AI Models, Audio Processing, ffmpeg)
  public/          # Static assets (Icons, dummy audio)
```

File placement rules:
- New UI components always in `src/components/`
- Frontend business logic always in `src/lib/` or `src/hooks/`
- Audio processing scripts always in `backend/`
- Do not create new folders in root without prior confirmation

---
## 5. Naming Conventions
```
# Files and Folders (Frontend)
- Components    : PascalCase    e.g., AudioPlayer.tsx
- Non-components: camelCase     e.g., useAudioQueue.ts
- Folders       : kebab-case    e.g., audio-editor/

# Files and Folders (Python Backend)
- Script files  : snake_case    e.g., enhance_speech.py
- Classes       : PascalCase    e.g., AudioProcessor

# In Code
- Variables     : camelCase     e.g., fileQueue, isProcessing
- Constants     : UPPER_SNAKE   e.g., MAX_BATCH_SIZE
- Functions     : camelCase     e.g., processAudio, getQueueList
- Types/Interfaces: PascalCase  e.g., AudioFileState
- CSS Classes   : kebab-case    e.g., queue-item
```

---
## 6. Code Conventions
```
# Coding Approach
- Apply DRY & Clean Code principles.
- Avoid blocking the UI thread when processing audio. Call the backend asynchronously.

# TypeScript
- Use strict mode
- Do not use 'any' type
- Always explicitly write function return types

# Import Order (Frontend)
1. External libraries (React, Tauri API, etc.)
2. UI Components / Assets
3. Types and Interfaces

# Error Handling
- Always handle errors on the backend side (Python/Rust) and return easily readable responses to the Frontend.
```

---
## 7. Component Rules
```
# Props Rules
- Always write props types explicitly
- Maximum 5-6 props per component, group the rest into an object.

# React Component
- Use Functional Components.
- Extract small repeating components into their own files if used in more than one place.
```

---
## 8. Styling Rules
```
# Styling Approach
- Use Tailwind CSS.
- Compact and structured according to PRD.
- Do not use inline styles except for progress bars or dynamic animations.

# Animations
- Add micro-animations to every button and card on hover using Framer Motion or Tailwind `transition`.
- Provide smooth transition effects on queue state changes.
```

---
## 9. API & IPC Fetching Rules
```
# Frontend -> Backend Communication
- Because this is an offline desktop app, do not use fetch/axios to external servers.
- Use Tauri `invoke` from `@tauri-apps/api/core` to trigger Python/Rust processing.

# IPC Response Format
- Return a uniform format:
  { success: boolean, data: any | null, error: string | null }
```

---
## 10. State Management Rules
```
# State Hierarchy
1. Local state (useState)   : for UI toggles, form inputs
2. Global state (Zustand)   : for Audio File Queue, Processing Status, Settings (Theme, Language)

# Zustand Rules
- Separate stores: `useQueueStore` for file queues, `useSettingsStore` for user preferences.
```

---
## 11. Performance Rules
```
# Hardware Acceleration
- AI processing (Demucs, DeepFilterNet) MUST attempt to utilize the GPU (CUDA) via the Python backend if available. If not, fallback to CPU.

# UI Thread
- Tauri must not freeze when Python is rendering/processing gigabyte-sized audio files.
- Send progress bar signals (0-100%) from Backend to Frontend periodically.
```

---
## 12. Git Rules
Every time Claude Code finishes making code changes or additions, immediately commit to GitHub before moving to the next task.
Regularly commit changes with clean messages and push to GitHub to maintain a safe version history.
```
# Commit Message Format
feat     : [new feature description]
fix      : [fixed bug description]
refactor : [refactor change description]
chore    : [configuration changes, tooling, etc.]
```

---
## 13. Features Progress
```
# Completed and Working
- [x] Draft PRD (Product Requirements Document)
- [x] Initialize Development Rules (CLAUDE.md)
- [x] Architecture brainstorming and all decisions finalized (see Section 18)
- [x] Phase 1 design spec written and approved
      → docs/superpowers/specs/2026-05-20-enhance-audio-pro-design.md
- [x] Phase 1 implementation plan written (13 tasks, TDD, full code)
      → docs/superpowers/plans/2026-05-20-phase1-scaffold.md

# Phase 1 — Completed Tasks (2026-05-20)
- [x] Task 1: Project scaffold — package.json, vite.config.ts, index.html, tailwind.config.js, postcss.config.js, npm install
- [x] Task 2: TypeScript types — src/types/ipc.ts, queue.ts, settings.ts
- [x] Task 3: File validation utility + 8 Vitest tests (TDD) — src/lib/fileValidation.ts
- [x] Task 4: Zustand stores + 8 Vitest tests (TDD) — useQueueStore, useSettingsStore
- [x] Task 5: IPC wrappers + React app entry — src/lib/ipc.ts, main.tsx, App.tsx, index.css
- [x] Task 6: All 7 UI components — TitleBar, Sidebar, DropZone, QueueToolbar, QueueGrid, SettingsPanel, SetupWizard
      → 16/16 Vitest tests passing
- [x] Task 7: Tauri v2 Rust scaffold — src-tauri/Cargo.toml, build.rs, tauri.conf.json,
      capabilities/default.json, main.rs, lib.rs, commands/mod.rs, db/mod.rs, sidecar/mod.rs
      → cargo check confirms all 473 deps compile; missing submodule files expected (Tasks 8-10)
      → App icons generated (violet placeholder, all sizes via npx tauri icon)
      → Rust GNU toolchain (x86_64-pc-windows-gnu) + MinGW gcc 15.2.0 (see Section 18.11)

- [x] Task 8: SQLite database layer — db/migrations.rs (queue_jobs table), db/queue.rs (QueueJob, insert_job, get_all_jobs)
- [x] Task 9: Tauri IPC commands — commands/queue.rs (add_files, get_queue), commands/settings.rs (get_settings, save_settings), shared IpcResponse<T> in commands/mod.rs
- [x] Task 10: Python sidecar lifecycle manager — sidecar/manager.rs (available_port via TcpListener, spawn stub; fully wired in Task 12)
      → cargo check passes clean — all 6 modules compile, zero errors

# Phase 1 — Completed Tasks (continued, 2026-05-20)
- [x] Task 11: Python FastAPI backend — backend/main.py, routers/health.py, routers/queue.py
      → GET /health (200 OK), POST /queue/process (501 placeholder)
      → 2/2 Pytest tests passing; PyInstaller spec created
- [x] Task 12: Binaries directory + sidecar wiring — src-tauri/binaries/backend-x86_64-pc-windows-gnu.exe
      → externalBin restored in tauri.conf.json; sidecar/manager.rs fully wired (spawn + health poll)
      → cargo check passes clean with sidecar binary in place
- [x] Task 13: First dev run + integration test — all tests green, cargo check passes on D-drive target
      → 16/16 Vitest frontend tests passing
      → 2/2 Pytest backend tests passing
      → CARGO_TARGET_DIR=D:\cargo_build\enhance-audio-pro (Drive D, storage-safe)
      → lld linker fixed: -B gcc-ld/ rustflag routes GCC to correct Rust toolchain lld-wrapper
      → Phase 1 COMPLETE ✓

# Phases 2–8 — All Complete (2026-05-21 → 2026-05-23)
- [x] Phase 2: Speech enhancement — DeepFilterNet3, CUDA/CPU, Setup Wizard download wiring
- [x] Phase 3: Stem separation — Demucs htdemucs_ft, vocals/drums/bass/other output stems
- [x] Phase 4: Conversion & packaging — 7-format converter, batch limits, PyInstaller spec, MSI target
- [x] Phase 5: Audio manipulation tools — Trim, Speed, Pitch, Volume, Fade, Merge, Loop, 11-band EQ
- [x] Phase 6: Polish & localization — WaveformPlayer, A/B toggle, multi-select, 17-language i18n, HelpPanel
- [x] Phase 7: Extended features — auto-save state, spectrogram, history panel, drag-to-reorder
- [x] Phase 8: Quality & recording — status bar, sample rate, filename template, recording, shortcuts, grouping
      → Full spec docs in docs/superpowers/specs/

# Phase 9 — Build Pipeline & Distribution (2026-05-23)
- [x] Task 1: scripts/build-backend.ps1 — PyInstaller sidecar build + copy to binaries dir
- [x] Task 2: scripts/build-app.ps1 — full orchestration: backend → tests → tauri build → MSI
- [x] Task 3: package.json — build:backend and build:full npm scripts
- [x] Task 4: .github/workflows/release.yml — CI/CD on v* tags, produces MSI release asset
- [x] Task 5: CHANGELOG.md — v0.1.0 release notes for all Phase 1–9 features
- [x] Task 6: Spec docs created for phases 4, 6, 7, 8, 9 in docs/superpowers/specs/
      → Phase 9 COMPLETE ✓ — PROJECT FEATURE-COMPLETE

# Waveform Interaction, Zoom, and Style Upgrades (2026-06-01)
- [x] Task 44 — Waveform Zoom & Controls: Removed bar width configuration from wavesurfer to render a solid, continuous wave shape (Premiere Pro style). Enabled `dragToSeek` to support real-time playhead dragging. Added a manual zoom slider below the canvas and integrated `Alt + Scroll Wheel` for horizontal zooming. Implemented mouse hover scrolling to pan the zoomed waveform left and right.
- [x] Rebuilt App Installer: Successfully compiled and bundled the Windows production `.exe` installer setup at `D:\cargo_build\enhance-audio-pro\release\bundle\nsis\Enhance Audio Pro_0.1.0_x64-setup.exe` (46.6 MB).

# PRD Task 51 — Waveform Playback & Clean Shutdown (2026-06-03)
- [x] J/L speed ladder: 5-step bidirectional (−4x↔−2x↔1x↔2x↔4x) with no pause stop in middle; L from Play jumps directly to 2x then 4x; J from 4x descends 4→2→1→−2→−4
- [x] Real backward audio: AudioBufferSourceNode plays reversed AudioBuffer; reversed buffer decoded on-demand from blob URL and cached per file
- [x] Smooth reverse playhead: replaced setInterval with requestAnimationFrame loop synced to AudioContext.currentTime for ~60fps position tracking
- [x] Forward playback smoothness: supplementary RAF loop updates time display at display rate (not throttled browser timeupdate)
- [x] Premiere Pro-style max zoom: computed dynamically as containerWidth × 30fps so 1 frame = full waveform width at maximum zoom
- [x] Clean app shutdown: sidecar/manager.rs spawn() returns CommandChild; lib.rs on_window_event(CloseRequested) kills sidecar then calls std::process::exit(0) — no orphaned backend processes

# PRD Update Implementations (2026-05-31)
- [x] Task 1 — Light Mode Improvements: All major components (SettingsPanel, QueueGrid, QueueToolbar, DropZone, QueueStatusBar, TitleBar) now use `dark:` Tailwind prefixes; light mode renders with proper contrast using `zinc-*` palette for backgrounds and text
- [x] Task 2 — Settings Persistence & Global Language: Settings already persisted via Zustand + Tauri backend; added `useTranslation()` to QueueGrid (column headers) and QueueToolbar (action buttons) for i18n coverage; removed AI Models download section from Settings — model assumed pre-bundled
- [x] Task 3 — User Guide Layout: Changed User Guide tab from collapsible accordion to plain paragraph layout with section headings

# Post-Release Fixes & Enhancements (2026-05-30)
- [x] Fix Enhance Speech runtime error: enhance_speech.py now reads MODELS_DIR env var (set by sidecar manager to D:\enhance-audio-pro-data\models) instead of hardcoded APPDATA path — resolves DeepFilterNet model-not-found crash
- [x] Add output directory mkdir in enhance_speech.py and routers/enhance.py to prevent write failures when destination folder doesn't exist
- [x] Inline audio playback: Play/Pause icon in every queue table row; useAudioPlayer singleton Zustand store (HTML5 Audio, tauri://localhost/ protocol); strict single-playback enforcement
- [x] Spacebar shortcut: toggles play/pause for the primary selected queue row (plays enhanced or original based on ab_mode)
- [x] A/B toggle in status column: after enhancement completes, status cell shows Enhanced/Original toggle buttons; clicking each button switches mode AND starts playback immediately
- [x] Auto-set ab_mode='enhanced' when enhancement callback delivers output_filepath so enhanced result is shown by default
- [x] Blue row tint: bg-blue-500/[0.12] applied to rows with ab_mode='enhanced'; reverts instantly on toggle to Original
- [x] QueueJob type extended with ab_mode?: 'enhanced' | 'original'; setAbMode action added to useQueueStore
- [x] Backend sidecar rebuilt via PyInstaller with all fixes

# PRD Tasks 63 & 64 — Bug Fixes, Destination Persistence, Done Badge, Column Alignment (2026-06-05)
- [x] Task 63.1 — Destination path bug fixed: importHelper.ts now auto-calls invokeSetDestination for all new jobs using settings.outputFolder as default, so Python enhance.py always reads a real path and never falls back to filepath.parent
- [x] Task 63.2 — Done status badge: A/B "Enhanced / Original" toggle buttons removed from queue table rows and grid cards; StatusBadge shows green "Done" once enhancement finishes (A/B toggle remains in Waveform Player)
- [x] Task 63.3 — Cache cleanup on close: cleanup_temp_files() in lib.rs runs on CloseRequested, scans DB for temp-dir paths and deletes any files in the system temp directory; partial output cleanup on cancellation added to enhance.py
- [x] Task 63.4 — Column alignment fixed: FILENAME th AND td both carry style={{ width:'100%', minWidth:colWidths.filename }} so STATUS/SIZE/FORMAT/BITRATE/SAMPLE HZ columns remain right-anchored during resize
- [x] Task 63.5 — Delete confirmation popup: row trash icon, toolbar "Delete Selected" button, and Delete keyboard shortcut all show window.confirm() if any targeted job is processing or queued; Clear All modal shows an extra red warning line when processing jobs are present
- [x] Task 63.6 — Seamless waveform A/B toggle: loading waveform overlay paragraph removed from WaveformPlayer; toggle switches source in the background with no flash
- [x] Task 63.7 — History panel: RefreshCw icon removed; clicking a history row calls invokeShowItemInFolder(job.output_filepath) to open/highlight the file in Explorer
- [x] Task 64.1 — EnhanceRowButton hidden when done; amber "Retry" button on error; dimmed 30% opacity when queued
- [x] Task 64.2 — enhance.py reads output_format from DB and saves enhanced file with the user-selected extension
- [x] Task 64.3 — enhance_speech.py handles non-native formats (MP3/AAC/M4A/OPUS/WMA) via temp WAV + ffmpeg conversion; intermediate WAV always cleaned up
- [x] Release binary rebuilt: D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe (7.7 MB, 2026-06-05 21:26)

# PRD Task 65 — Fix Stuck Enhance Process (2026-06-06)
- [x] Task 65.1 — Global asyncio lock added to `backend/routers/enhance.py`: `_enhance_lock = asyncio.Lock()` serialises all `_process_jobs` invocations. Concurrent `/enhance` requests (toolbar batch + per-row button) no longer run the DeepFilterNet model in parallel threads — the second request waits for the lock instead of causing CUDA OOM/hang.
- [x] Task 65.2 — Per-job heartbeat: after acquiring the lock, Python sends a "processing" status callback before starting each job, refreshing UI state for jobs that were waiting behind the lock.
- [x] Task 65.3 — Per-job hard timeout (30 min): `threading.Timer` per job sets the `cancellation_events` flag if enhance takes too long. Timed-out jobs report as "error" (not "pending") with a descriptive message.
- [x] Task 65.4 — Rust HTTP error recovery in `src-tauri/src/commands/process.rs`: reqwest POST now carries a 10-second timeout; on failure, Rust writes "error" status to SQLite and emits `queue://status-change` error events — jobs no longer get permanently stuck in "processing" when the sidecar is unavailable.
- [x] Task 65.5 — Delete-While-Processing Confirmation: already fully implemented (row trash, toolbar delete, keyboard Delete, Clear All).
- [x] Task 65.6 — History Panel: Reveal-in-folder + "File has been moved" popup + Clear All History button already fully implemented.
- [x] Release binary rebuilt: D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe (7.7 MB, 2026-06-06 14:23). Windows installer: Enhance Audio Pro_0.1.0_x64-setup.exe (46.6 MB).

# Test Coverage (final)
- 38/38 Vitest (frontend)
- 65/65 Pytest (backend)
- cargo check clean
- TypeScript tsc --noEmit: 0 errors
```

---
## 14. Testing
```
# Testing Approach
- Testing type   : Unit / Manual
- Framework      : Vitest (Frontend) / PyTest (Python Backend)

# What Needs Testing
- Audio format conversion utilities.
- Integration process of Frontend communication (Tauri) with processes (Python).
```

---
## 15. Do Not
If instructions or prompts are ambiguous, ASK FIRST before starting coding. Do not assume and start working without confirmation.
```
# Structure and Files
- Do not move or delete files without confirmation.
- Do not start modifying `src-tauri` cargo.toml carelessly without knowing the Tauri version used.

# Code
- Do not process audio files by modifying the original file. Create a duplicate (output file) in the destination folder.
- Do not hardcode system directories (use dynamic local OS path APIs).

# Internet
- Do not use APIs from the internet for Audio processing. Everything must be local.
```

---
## 16. Environment & Path Settings
```
# Local Configuration
- Save preferences (Theme, Default Output Folder) in local SQLite or Tauri Plugin Store's built-in JSON config.
- Do not store temporary exported files in RAM, write to OS local storage / temp folder to prevent Memory Leaks on large files.
```

---
## 17. MANDATORY PROGRESS LOGGING RULE

**RULE: At the end of every major task, feature completion, or session, you MUST automatically summarize and log the progress and new decisions into this file to prevent context loss.**

This includes:
- Every completed feature or sub-task
- Every architectural or design decision made during that session
- Any new constraints, blockers, or discoveries
- Updates to the Features Progress section (section 13)

Do not skip this step. Do not wait to be asked. This is a permanent non-negotiable requirement.

---
## 18. Architectural Decisions Log

All major architecture decisions finalized during brainstorming sessions (May 18–20, 2026).

### 18.1 System Architecture
- **Pattern:** Three-process desktop app — React frontend, Tauri/Rust core, Python sidecar
- **Data flow:** React UI → Tauri `invoke` → Rust core → HTTP (reqwest) → Python FastAPI
- **Events:** Python pushes real-time progress to frontend via Tauri event system (not polling)

### 18.2 Frontend-Backend Communication
- **Decision:** Rust HTTP client (`reqwest`) → Python FastAPI server (localhost, random port)
- **Port handoff:** Rust picks a random available port at startup; passes it to Python via `BACKEND_PORT` env var
- **Rejected alternatives:** stdio JSON pipes (harder to debug), shared SQLite only (no real-time control)

### 18.3 Queue Architecture — Option C (CONFIRMED)
- **Decision:** SQLite-backed job queue + Tauri event push for real-time UI updates
- **Job state:** Written to SQLite by Rust on file drop; read by Python during processing
- **Progress updates:** Python emits Tauri events (`queue://progress`, `queue://status-change`) — frontend listens, no polling
- **Rejected alternatives:** Option A (frontend polling), Option B (SQLite polling without events)

### 18.4 Python Backend Distribution
- **Decision:** PyInstaller single-file `.exe` sidecar bundled inside the Tauri installer
- **Result:** Zero Python install required for end users; ~150–300 MB sidecar size
- **Rejected alternatives:** Embedded Python runtime (complex signing), require system Python (bad UX)

### 18.5 AI Model Download Strategy
- **Decision:** Setup wizard on first app launch — all required AI models downloaded before the user can process files
- **Model storage:** `%APPDATA%\enhance-audio-pro\models\`
- **UX:** Progress screen shown during download; app proceeds to main UI only after completion
- **Rejected alternatives:** On first feature use (surprising delays mid-workflow), bundled in installer (2–5 GB)

### 18.6 Target Platform
- **Decision:** Windows (.exe) first; macOS (.dmg) added in a later phase
- **Reason:** Simpler PyInstaller + Tauri builds; faster iteration on core features

### 18.7 Data Layer
- **Database:** SQLite at `%APPDATA%\enhance-audio-pro\app.db`
- **Rust access:** `rusqlite` crate (direct, no ORM for Phase 1)
- **Python access:** Reads same DB for job details during processing
- **Settings storage:** `tauri-plugin-store` (JSON file) for theme, output folder, language

### 18.8 Phase 1 Scope (confirmed, all 4 items)
1. App shell — titlebar, sidebar, Video/Audio tab layout, dark/light mode toggle
2. Drag-and-drop file ingestion — format validation, size read, insert into SQLite queue
3. Queue data grid UI — filename, destination, size, status columns; filter + search bar
4. Settings panel — theme, default output folder, language selector (UI only; no i18n logic yet)

### 18.9 Tauri IPC Commands (Phase 1)
| Command | Description |
|---|---|
| `add_files(paths[])` | Validate files and insert into SQLite queue |
| `get_queue()` | Return all current queue rows |
| `get_settings()` | Read settings from plugin-store |
| `save_settings(settings)` | Write settings to plugin-store |

### 18.10 Python FastAPI Endpoints (Phase 1)
| Endpoint | Description |
|---|---|
| `GET /health` | Rust polls this to confirm sidecar is ready before serving UI |
| `POST /queue/process` | Placeholder — returns 501 until Phase 2 |

### 18.11 Rust Toolchain (discovered Task 7, 2026-05-20)
- **Decision:** Use `stable-x86_64-pc-windows-gnu` toolchain (not MSVC)
- **Reason:** MSVC toolchain requires Visual Studio Build Tools (`link.exe`) which are not installed; MinGW GCC 15.2.0 already present at `D:\apk\mingw64\bin\`
- **Config fix:** Tauri v2 uses `drag-drop-enabled` (not `fileDrop`) in window config
- **ExternalBin:** Restored in Task 12 once `binaries/backend-x86_64-pc-windows-gnu.exe` was built

### 18.12 Build Environment — Drive D Migration (2026-05-20)
- **Problem:** Drive C storage crisis prevented Rust compilation (target dir was `C:\cargo-build\`)
- **Fix:** `CARGO_TARGET_DIR=D:\cargo_build\enhance-audio-pro` set in both `.cargo/config.toml` [build] section and `tauri-dev.bat`; `CARGO_HOME=D:\cargo_cache` set by user at OS level
- **LLD linker root cause:** Rust's `lld-wrapper` (`ld.lld.exe` in `gcc-ld/`) uses `current_exe.parent().parent().join("rust-lld")` to find `rust-lld.exe`. Copying `ld.lld.exe` to `D:\apk\mingw64\bin\` broke this because the wrapper then looked for `rust-lld.exe` two levels up at `D:\apk\mingw64\rust-lld.exe` (which doesn't exist)
- **Fix:** Added `-C link-arg=-BC:/Users/User/.rustup/toolchains/stable-x86_64-pc-windows-gnu/lib/rustlib/x86_64-pc-windows-gnu/bin/gcc-ld/` to `rustflags` in `.cargo/config.toml`. This tells MinGW GCC to find `ld.lld.exe` in the Rust toolchain's `gcc-ld/` directory where the relative path to `rust-lld.exe` is correct
- **tauri-dev.bat PATH:** Prepends `gcc-ld/` and `bin/` from rustup toolchain before `%PATH%` as belt-and-suspenders

### 18.13 CI/CD Pipeline Fixes (2026-05-23)
Root cause of v0.1.0 release failure: `No module named pytest` on the GitHub Actions runner.
Full list of fixes applied (commit 4991a04):

| Problem | Fix |
|---|---|
| `pytest` not installed on CI runner | Added `pytest>=8.0.0` to `backend/requirements.txt` |
| `demucs`, `einops`, `julius`, `soundfile`, `python-multipart` missing from requirements.txt | Added all five; they were referenced in `build.spec` but never installed |
| `.cargo/config.toml` `target-dir = D:\cargo_build\...` applied on CI, redirecting MSI artifacts away from `src-tauri/target/` where the upload step looks | Removed `target-dir` from config.toml; local dev still uses D: drive via `tauri-dev.bat` env var |
| GNU toolchain rustflags had hardcoded `C:/Users/User/.rustup/...` path — invalid on CI | Switched CI workflow to `stable-x86_64-pc-windows-msvc`; GNU rustflags in config.toml are ignored for MSVC builds |
| CI sidecar binary name was `backend-x86_64-pc-windows-gnu.exe`; MSVC target expects `msvc` triple | Updated workflow copy step to produce `backend-x86_64-pc-windows-msvc.exe` |
| `build-app.ps1` did not set CARGO_TARGET_DIR and had hardcoded MSI path | Script now defaults CARGO_TARGET_DIR to D:\cargo_build and derives MSI dir from it |

- **Local dev:** still uses GNU toolchain via `tauri-dev.bat` (sets CARGO_TARGET_DIR + PATH)
- **CI:** uses MSVC (no MinGW required, no hardcoded paths)
- **Sidecar naming:** Tauri's `externalBin: ["binaries/backend"]` auto-appends the target triple, so both local (gnu) and CI (msvc) binaries coexist without config changes

---
_This CLAUDE.md is customized specifically for the Enhance Audio Pro project. Update this file's contents whenever there are architectural changes or completed feature progress._

### 18.14 CRITICAL BUILD RULE — Path With Spaces (2026-06-05)
- **Problem:** The workspace is at `D:\vibe coding\app enhance audio pro` — a path with spaces. The GNU linker (`rust-lld`) treats spaces as argument delimiters, so any rlib path embedded in Cargo's linker args that contains spaces fails with `could not open 'coding\\app\\'`.
- **Historical cause:** Running `cargo check` or `cargo build` WITHOUT `CARGO_TARGET_DIR` writes artifacts to `src-tauri/target/` (inside the spaces path). These artifacts embed their own path. When Cargo later picks them up as cached proc-macro outputs, the linker fails.
- **Fix applied (June 5, 2026):** Deleted `src-tauri/target/` entirely to remove old artifacts compiled against the spaces path.
- **MANDATORY RULE:** **ALWAYS** set `CARGO_TARGET_DIR=D:\cargo_build\enhance-audio-pro` before ANY `cargo` command. Never run `cargo check`, `cargo build`, or `cargo clean` without this env var. The junction `D:\app_enhance_audio_pro` → workspace path avoids the issue in some contexts, but CARGO_TARGET_DIR is the definitive fix.
- **Recommended commands:**
  ```powershell
  # Correct way to run cargo check:
  $env:CARGO_TARGET_DIR='D:\cargo_build\enhance-audio-pro'; cargo check
  # Correct way to build:
  $env:CARGO_TARGET_DIR='D:\cargo_build\enhance-audio-pro'; npm run tauri build
  # Or use the build scripts (they set it automatically):
  npm run build:full   # calls build-app.ps1 which sets CARGO_TARGET_DIR
  ```
