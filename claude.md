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

# Phase 2 — Completed Tasks (2026-05-21)
- [x] Phase 2 design spec written and approved
      → docs/superpowers/specs/2026-05-21-phase2-speech-enhancement-design.md
- [x] Phase 2 implementation plan written (16 tasks, TDD, full code)
      → docs/superpowers/plans/2026-05-21-phase2-speech-enhancement.md
- [x] Rust: axum callback server (callback/mod.rs) — /callback/progress, /callback/status, /callback/wizard
      → emits queue://progress, queue://status-change, wizard://progress, wizard://complete, wizard://error
- [x] Rust: DB layer extended — progress + error_message columns, update_job_status, update_job_error, get_job_by_id
- [x] Rust: commands/process.rs — process_queue (sync, fire-and-forget via tauri::async_runtime::spawn)
- [x] Rust: commands/download.rs — start_model_download (sync, fire-and-forget)
- [x] Rust: sidecar/manager.rs — passes CALLBACK_PORT env var to Python sidecar
- [x] Rust: lib.rs — Arc<Mutex<Connection>>, callback axum server on random port, AppState with callback_port
      → cargo check passes clean
- [x] Python: processors/enhance_speech.py — lazy DeepFilterNet3 load, CUDA/CPU fallback, progress callbacks
      → 4/4 Pytest tests passing (TDD)
- [x] Python: routers/enhance.py — POST /enhance, BackgroundTasks, asyncio.get_running_loop() + run_in_executor
      → 3/3 Pytest tests passing (TDD)
- [x] Python: routers/wizard.py — POST /wizard/download, BackgroundTasks, httpx progress callbacks
      → 2/2 Pytest tests passing (TDD)
- [x] Python: main.py — all 4 routers wired (health, queue, enhance, wizard)
      → 11/11 Pytest tests passing total
- [x] Frontend: QueueJob type extended — progress: number, error_message: string | null
- [x] Frontend: useQueueStore — setProgress, setStatus actions added
      → 7/7 Vitest tests passing
- [x] Frontend: ipc.ts — invokeProcessQueue, invokeStartModelDownload wrappers
- [x] Frontend: QueueGrid — Tauri event listeners for queue://progress + queue://status-change, animated progress bar
- [x] Frontend: QueueToolbar — Process button with disabled state when no pending jobs
- [x] Frontend: SetupWizard — wizard://progress, wizard://complete, wizard://error event wiring with live progress bar
      → 19/19 Vitest frontend tests passing
      → Phase 2 COMPLETE ✓

# Not Started (Phase 3+)
# Note: PRD Phase 2 included Stem Separation — deferred to Phase 3 by implementation decision.
# PRD Phase 3 = queue batch logic + file conversion; PRD Phase 4 = audio tools; PRD Phase 5 = polish/packaging.

# Phase 3 — Completed Tasks (2026-05-22)
- [x] Phase 3 design spec written and approved
      → docs/superpowers/specs/2026-05-21-phase3-stem-separation-design.md
- [x] Phase 3 implementation plan written
      → docs/superpowers/plans/2026-05-21-phase3-stem-separation.md
- [x] Python: conftest.py extended with Demucs mocks + torchaudio.load return value
- [x] Python: processors/separate_stems.py — lazy htdemucs_ft loader, CUDA/CPU fallback
      → 4/4 Pytest tests passing (TDD)
- [x] Python: routers/separate.py — POST /separate, BackgroundTasks, progress callbacks
      → 3/3 Pytest tests passing (TDD)
- [x] Python: requirements.txt — added demucs>=4.0.0
- [x] Python: main.py — all 5 routers registered (health, queue, enhance, wizard, separate)
      → 18/18 Pytest tests passing total
- [x] Rust: commands/separate.rs — separate_stems sync command, fire-and-forget to /separate
      (sync not async — same State<'_, T> lifetime fix as process_queue in Phase 2)
- [x] Rust: commands/mod.rs — pub mod separate added
- [x] Rust: lib.rs — separate_stems registered in invoke_handler; cargo check clean
- [x] Frontend: ipc.ts — invokeSeparateStems wrapper added
- [x] Frontend: QueueToolbar — Separate Stems button (indigo, Scissors icon); Enhance renamed from Process
      → 19/19 Vitest tests passing
      → Phase 3 COMPLETE ✓

# Phase 4 — Completed Tasks (2026-05-22)
- [x] Phase 4 implementation plan written
      → docs/superpowers/plans/2026-05-22-phase4-packaging-conversion.md
- [x] Python: processors/convert_audio.py — ffmpeg subprocess wrapper, SUPPORTED_FORMATS
      → 4/4 Pytest tests passing (TDD)
- [x] Python: routers/convert.py — POST /convert, BackgroundTasks, output_format-aware path
      → 3/3 Pytest tests passing (TDD)
- [x] Python: main.py — 6 routers registered; 25/25 Pytest tests passing total
- [x] Python: build.spec — PyInstaller one-file spec for backend sidecar
- [x] Rust: db/migrations.rs — output_format TEXT DEFAULT 'wav' (idempotent ALTER TABLE)
- [x] Rust: db/queue.rs — output_format in QueueJob; update_job_output_format; count_active_jobs_by_type
- [x] Rust: commands/convert.rs — convert_files (fire-and-forget) + set_output_format
- [x] Rust: commands/queue.rs — 30 audio / 10 video batch limits enforced at add_files
- [x] Rust: lib.rs — convert_files + set_output_format registered; cargo check clean
- [x] Rust: tauri.conf.json — bundle targets ["msi"] for Windows
- [x] Frontend: src/types/queue.ts — output_format: string added
- [x] Frontend: useQueueStore.ts — setOutputFormat action; JobStatus import fixed
- [x] Frontend: ipc.ts — invokeConvertFiles + invokeSetOutputFormat wrappers
- [x] Frontend: QueueGrid.tsx — Output Format column with per-row <select> (7 formats)
- [x] Frontend: QueueToolbar.tsx — global format override + Apply All + Convert button (teal)
- [x] Frontend: DropZone.tsx — 5-second rejection warning on batch limit exceeded
- [x] Build: scripts/build-backend.bat — one-command PyInstaller build + copy to binaries
      → 20/20 Vitest tests passing
      → Phase 4 COMPLETE ✓

# Phase 5 — Completed Tasks (2026-05-22)
- [x] Phase 5 design spec written and approved
      → docs/superpowers/specs/2026-05-22-phase5-audio-manipulation-design.md
- [x] Phase 5 implementation plan written
      → docs/superpowers/plans/2026-05-22-phase5-audio-manipulation.md
- [x] Python: processors/manipulate_audio.py — trim, speed, pitch, volume, fade (ffmpeg)
      → 7/7 Pytest tests passing (TDD)
- [x] Python: processors/merge_audio.py — concat+acrossfade, stream_loop (ffmpeg)
      → 6/6 Pytest tests passing (TDD)
- [x] Python: processors/equalizer.py — parametric EQ + 18 presets (ffmpeg)
      → 6/6 Pytest tests passing (TDD)
- [x] Python: routers/manipulate.py — POST /manipulate, /merge, /loop, /eq
      → 6/6 Pytest tests passing (TDD)
- [x] Python: main.py — manipulate router registered; 51/51 Pytest tests passing total
- [x] Rust: commands/manipulate.rs — manipulate_audio, merge_audio, loop_audio, apply_eq
- [x] Rust: commands/mod.rs — pub mod manipulate added
- [x] Rust: lib.rs — all 4 manipulation commands registered in invoke_handler; cargo check clean
- [x] Frontend: ipc.ts — invokeManipulateAudio, invokeMergeAudio, invokeLoopAudio, invokeApplyEQ wrappers
- [x] Frontend: useQueueStore.ts — selectedJobId + setSelectedJob state
- [x] Frontend: QueueGrid.tsx — row click selects/deselects job (highlight on selected)
- [x] Frontend: EQPanel.tsx — 11-band vertical sliders + 18 preset selector + reset button
- [x] Frontend: ManipulationPanel.tsx — 8-tab collapsible panel (Trim/Speed/Pitch/Volume/Fade/Merge/Loop/EQ)
      → slides up with AnimatePresence when a job is selected
- [x] Frontend: App.tsx — ManipulationPanel mounted below QueueGrid
      → 20/20 Vitest tests passing
      → Phase 5 COMPLETE ✓

# Phase 6 — Completed Tasks (2026-05-22)
- [x] Phase 6 design spec and implementation plan
- [x] Waveform / Spectrogram visualization — WaveformPlayer.tsx (WaveSurfer.js, 56px waveform bar)
- [x] Playback controls — Play/Pause/Stop + time display in Waveform tab
- [x] A/B original vs enhanced toggle — enabled when job status is 'done' and output_filepath exists
- [x] Enhancement strength slider — 0–100 range in SettingsPanel, maps to DeepFilterNet atten_lim_db (0–40 dB)
- [x] Multi-select queue — Ctrl+Click (toggle), Shift+Click (range), exclusive click
      → selectedJobIds: string[] replaces selectedJobId in useQueueStore
      → primarySelectedId() computed getter for ManipulationPanel backward compat
- [x] Grid View / List View toggle — LayoutGrid/LayoutList button in QueueToolbar; card grid layout
- [x] Localization framework — i18next + react-i18next; English base strings in en.json
      → SUPPORTED_LANGUAGES array: 17 languages (en, id, zh, es, de, fr, ja, pt, ko, ru, ar, hi, it, nl, pl, tr, vi)
      → SettingsPanel language selector wired to i18n.changeLanguage
- [x] Custom keyboard shortcuts — useKeyboardShortcuts hook
      → Ctrl+A: select all | Escape: deselect | Delete: remove selected | E: Enhance | S: Separate | C: Convert
- [x] Built-in user guide — HelpPanel.tsx (7 collapsible sections, triggered from TitleBar help icon)
- [x] Export bitrate/quality options — BitrateSelect per row (Auto/64k/96k/128k/192k/256k/320k)
      → bitrate column added to SQLite; set_bitrate Rust command; -b:a flag in ffmpeg convert
- [x] output_filepath tracking — Python sends output_filepath in done callback; stored in DB + frontend state
      → Rust: StatusPayload.output_filepath, update_job_output_filepath helper
- [x] Backend: enhance.py accepts strength (float 0.0–1.0); convert.py reads bitrate from DB
      → 56/56 Pytest tests passing
- [x] Frontend tests: 31/31 Vitest tests passing
      → Phase 6 COMPLETE ✓

## Phase 7 — Completed Tasks (2026-05-22)
- [x] Task 1: Auto-save project state — useQueueStore + useSettingsStore wrapped with Zustand persist middleware
      (queue persists: filter, viewMode; settings persists: theme, language, enhancementStrength)
- [x] Task 2: Spectrogram view — SpectrogramPlugin integrated in WaveformPlayer; Waveform/Spectrogram tab toggle
- [x] Task 3: Multi-language translations — 17 locale JSON files created and registered in i18n/index.ts
- [x] Task 4: macOS packaging — tauri.conf.json bundle targets: ["msi", "dmg", "app"]
- [x] Task 5: Custom output folder picker — SettingsPanel uses @tauri-apps/plugin-dialog open() with directory:true
- [x] Task 6: History / recent files panel — HistoryPanel.tsx with Tauri IPC; Clock icon toggle in Sidebar
- [x] Task 7: Drag-to-reorder queue items — @dnd-kit/core + @dnd-kit/sortable; GripVertical handle on table rows
      and grid cards; reorderJobs(activeId, overId) action added to useQueueStore
      → 33/33 Vitest tests passing
      → Phase 7 COMPLETE ✓
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

### 18.13 Phase 2 Architecture — Callback Server Pattern (2026-05-21)
- **Decision:** axum 0.7 HTTP server on a random port inside the Rust process receives progress/status POSTs from Python, then emits Tauri events to the frontend
- **Port handoff:** Rust binds `127.0.0.1:0` (OS assigns port), passes it to Python via `CALLBACK_PORT` env var alongside `BACKEND_PORT`
- **DB sharing:** `Arc<Mutex<rusqlite::Connection>>` shared between Tauri commands and axum handlers — avoids opening a second SQLite connection
- **Async command fix:** `process_queue` and `start_model_download` are sync Tauri commands that use `tauri::async_runtime::spawn` internally for fire-and-forget HTTP calls — avoids `State<'_, T>` lifetime conflicts with Tauri v2's `'static` requirement on async commands
- **`cargo test --lib` known issue:** Pre-existing STATUS_ENTRYPOINT_NOT_FOUND crash due to Windows API Set DLL resolution failure in isolated test binaries (affects Tauri WebView2 deps). Verified pre-existing before Phase 2. Workaround: use `cargo check` for Rust verification.

### 18.14 Phase 2 Python Patterns (2026-05-21)
- **Lazy imports:** `torch`, `df`, `torchaudio` imported inside functions, not at module level — prevents import-time crash when model not yet downloaded
- **Model cache:** Module-level `_model` / `_df_state` variables loaded once per sidecar lifetime via `_load_model()` guard
- **Thread executor:** `asyncio.get_running_loop().run_in_executor(None, ...)` wraps sync `enhance_file` — keeps FastAPI event loop unblocked during GPU/CPU inference
- **Test mocking:** `backend/tests/conftest.py` pre-populates `sys.modules` with MagicMock stubs for `torch`, `torchaudio`, `df`, `df.enhance` — all 11 tests run without GPU or DeepFilterNet installed
- **Python venv:** `backend/.venv/Scripts/python.exe` — system Python 3.11.5 at `C:\Users\User\AppData\Local\Programs\Python\Python311\` does NOT have pytest; always use venv

---
_This CLAUDE.md is customized specifically for the Enhance Audio Pro project. Update this file's contents whenever there are architectural changes or completed feature progress._
