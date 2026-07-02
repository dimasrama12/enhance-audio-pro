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

# PRD Task 67 — Backend Retry, Enhance-All First-Row Fix, Scratch Disk Setting (2026-06-06)
- [x] Task 67.1 — Backend unavailable retry: `src-tauri/src/commands/process.rs` now retries the HTTP POST to `/enhance` up to 8 times with a 2-second delay between attempts (total ≤16 s window). This covers PyInstaller sidecar cold-start latency so the first enhance after app launch no longer immediately reports "Backend unavailable" error. Added tokio "time" feature to Cargo.toml.
- [x] Task 67.2 — Enhance All first-row processing fix: `QueueToolbar.tsx handleProcess()` was reading the stale closure variable `jobs` (pre-setStatus state) to find the next queued job to dispatch. Replaced with `useQueueStore.getState().jobs` so the fresh post-update state is read and the first job correctly transitions to "processing" immediately.
- [x] Task 67.3 — Scratch Disk / Cache Directory setting: added `scratchDiskDir` field to `AppSettings` type, `setScratchDiskDir` action to `useSettingsStore`, browse+clear UI in SettingsPanel Output section, `invokeGetScratchDiskDir`/`invokeSaveScratchDiskDir` IPC wrappers, Rust `get_scratch_disk_dir`/`save_scratch_disk_dir` commands (persist to `app_data_dir/scratch_disk.txt`), `sidecar/manager.rs` passes `SCRATCH_DISK_DIR` env var, Python `enhance_speech.py` uses it for temp dirs, and `lib.rs` cleans `enhance-audio-pro-cache/` inside the scratch disk on app close.
- [x] Release binary rebuilt: D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe (8.1 MB, 2026-06-06 17:26).

# PRD Task 65 — Fix Stuck Enhance Process (2026-06-06)
- [x] Task 65.1 — Global asyncio lock added to `backend/routers/enhance.py`: `_enhance_lock = asyncio.Lock()` serialises all `_process_jobs` invocations. Concurrent `/enhance` requests (toolbar batch + per-row button) no longer run the DeepFilterNet model in parallel threads — the second request waits for the lock instead of causing CUDA OOM/hang.
- [x] Task 65.2 — Per-job heartbeat: after acquiring the lock, Python sends a "processing" status callback before starting each job, refreshing UI state for jobs that were waiting behind the lock.
- [x] Task 65.3 — Per-job hard timeout (30 min): `threading.Timer` per job sets the `cancellation_events` flag if enhance takes too long. Timed-out jobs report as "error" (not "pending") with a descriptive message.
- [x] Task 65.4 — Rust HTTP error recovery in `src-tauri/src/commands/process.rs`: reqwest POST now carries a 10-second timeout; on failure, Rust writes "error" status to SQLite and emits `queue://status-change` error events — jobs no longer get permanently stuck in "processing" when the sidecar is unavailable.
- [x] Task 65.5 — Delete-While-Processing Confirmation: already fully implemented (row trash, toolbar delete, keyboard Delete, Clear All).
- [x] Task 65.6 — History Panel: Reveal-in-folder + "File has been moved" popup + Clear All History button already fully implemented.
- [x] Release binary rebuilt: D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe (7.7 MB, 2026-06-06 14:23). Windows installer: Enhance Audio Pro_0.1.0_x64-setup.exe (46.6 MB).

# PRD Task 74 — Unlimited Queue, Sequential Convert All, Per-Row Enhance/Convert Toggle (2026-06-09)
- [x] Task 74.1 — Unlimited file input: removed `MAX_QUEUE_JOBS` const + both capacity-check blocks in `src/lib/importHelper.ts` (`handleImportFiles` and `submitAddFilesDirect`). Queue now accepts any number of files.
- [x] Task 74.2 — Per-row Enhance/Convert mode: new `ToolModeSelect` dropdown (Enh/Conv) + `ConvertRowButton` in QueueGrid TOOLS column. Mode tracked in non-persisted `jobOperationTypes: Record<string,'enhance'|'convert'>` Zustand map with `setJobOperationMode` action.
- [x] Task 74.3 — Sequential Convert All: `QueueToolbar.handleConvert` now mirrors `handleProcess` (mark all pending `queued`, dispatch first as `processing`, auto-advance the rest). `QueueGrid` auto-advance listener reads `jobOperationTypes` to call `invokeConvertFiles` vs `invokeProcessQueue` for the next queued job.
- [x] Task 74.4 — Toolbar reorder: Enhance All → Convert All → Separate → Record. `C` shortcut in `useKeyboardShortcuts.ts` now triggers the same sequential convert queue.
- [x] Task 74.5 — Completion toast + Download All: `useToastStore` extended with optional `action`/`duration`; `ToastContainer` renders an action button. `QueueToolbar` fires a bottom-right "N files converted" toast with "Download All" (folder picker + batch `copy_enhanced_file`) when a convert batch settles.
- [x] Task 74.6 — Python `backend/routers/convert.py`: added global `asyncio.Lock` (serialize convert work) + per-job "processing" heartbeat callback.
- [x] Python sidecar rebuilt via PyInstaller; Tauri release binary rebuilt at D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe.

# Queue Column Width Calibration & Lock-In (2026-06-13)
- [x] Root-cause fix in `src/components/QueueGrid.tsx`: the per-column `adjustWidth` only had real branches for `filename`/`destination`; all 9 other resize handles fell through to an `else` that secretly modified `size`/`destination`, so those columns could never shrink → right-side overflow. Rewrote `adjustWidth` so each handle resizes ONLY its own column down to a per-column minimum (new `MIN_COL_WIDTHS` const).
- [x] Calibration workflow: temporary "Column Calibration Mode" readout bar + "Copy Width Log" button + free horizontal-scroll let the user drag every column to taste and copy exact px values.
- [x] Final locked widths hardcoded as `colWidths` defaults (total 955px): grip 28, index 34, filename 208, destination 124, size 65, format 75, bitrate 72, sampleRate 80, status 70, tools 112, lock 41, clear 46.
- [x] Reverted table to `w-full table-fixed` (fits container, no horizontal overflow) and removed the temporary calibration bar + Copy Width Log button. Resize handles retained for future tweaks.
- [x] Build note: orphaned `backend.exe` sidecar processes from prior runs hold a file lock and cause tauri-build "Access is denied" (lib.rs:80 remove_file) — kill `backend`/`enhance-audio-pro` processes before rebuilding. ALSO: build via `npm run tauri build` (NOT plain `cargo build`), else tauri-build compiles with `cfg(dev)` and the webview points at devUrl localhost:1420 → ERR_CONNECTION_REFUSED.
- [x] Tauri release binary rebuilt (no-bundle) at D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe (2026-06-13).

# Queue Columns Made Permanently Non-Resizable (2026-06-14)
- [x] Removed the resize system entirely from `src/components/QueueGrid.tsx`: deleted the `ResizeHandle` component, the `adjustWidth` handler, the `MIN_COL_WIDTHS` const, and the `setColWidths` React state. Column widths are now a hardcoded `COL_WIDTHS` const (total 955px, same calibrated values) — columns can no longer be enlarged/shrunk by dragging. `colWidths` now just aliases `COL_WIDTHS`; all `<th>` cells dropped the `resizable-th` class and their `<ResizeHandle>` children.
- [x] Verified clean: `npx tsc --noEmit` → 0 errors; no leftover references to removed identifiers.
- [x] Tauri release binary rebuilt (no-bundle) at D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe (7.76 MB, 2026-06-14 00:24, build finished in 6m07s, exit 0). Two harmless dead-code warnings (`get_job_by_id`, `count_active_jobs_by_type` now unused after the unlimited-queue change in queue.rs).

# Audio Sub-Tab System (2026-06-14)
- [x] Added `AudioSubTab = 'enhance' | 'convert' | 'separate'` type + `audioSubTab` field (default `'enhance'`) + `setAudioSubTab` to `useUIStore`.
- [x] QueueToolbar left pill group restructured into: persistent 3-tab nav strip [Enhance All | Convert All | Separate] (clicking sets sub-tab) + one conditional action button per active tab + Record button; batch `→ WAV ↻` format control hidden in Enhance tab. Label map uses `Record<AudioSubTab, string>` for type-safety.
- [x] QueueGrid: FORMAT column hidden in Enhance tab, shown in Convert tab (header = "Save to") and Separate tab; BITRATE and SAMPLE HZ columns hidden in Enhance and Convert tabs, shown in Separate tab only.
- [x] SortableJobRow Tools cell: ToolModeSelect dropdown hidden in Enhance and Convert tabs (visible only in Separate when not done/processing/queued); Enhance tab shows only EnhanceRowButton; Convert tab shows only ConvertRowButton; Separate tab retains mode-driven behaviour.
- [x] Tauri release binary rebuilt (no-bundle) at D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe (2026-06-14).

# UI Overhaul — Per-Tab Queues, Bottom Action Bar, Column Resizing, Shortcuts (2026-06-14)
- [x] **Per-tab independent queues:** `useQueueStore` refactored. Flat `jobs[]` replaced by `tabQueues: Record<AudioSubTab, QueueJob[]>`. All per-tab state isolated: `tabFilters`, `tabSearches`, `tabSelectedIds`, `tabLockedIds`, `tabImportingIds`, `tabViewModes`, `tabGroupByFormat`, `tabJobOpTypes`. Files added in Enhance tab never appear in Convert/Separate. Persist key `queue-ui-prefs-v2`.
- [x] **Tab label rename:** Pills now read "Enhance" / "Convert" / "Separate". Action buttons carry "All" suffix (Enhance All, Convert All, Separate All) in the bottom bar.
- [x] **Bottom action bar (`QueueActionBar`):** Sticky bar at bottom of queue. Enhance All = violet, Convert All / Separate All = neutral gray. Communicates with QueueToolbar handlers via `action:enhance` / `action:convert` / `action:separate` DOM events.
- [x] **Record button relocated:** Sits left of search bar in toolbar right section. Recorded audio routes to the active tab.
- [x] **Neutral tab pill style:** Active pill is raised-card white/glass — no violet. Violet reserved for Enhance All button only.
- [x] **Resizable columns:** `ResizeHandle` drag-to-resize per column. `colWidths` is local `useState`. "Copy Width Log" (📋 in TOOLS header) writes JSON to clipboard.
- [x] **Keyboard shortcuts:** `Shift+1`/`Shift+2` for table/grid view. `1`/`2`/`3` switch Enhance/Convert/Separate tabs. All added to `KeyboardShortcutMap`.
- [x] **Full tab isolation:** Search, filter, selection, lock, view mode, group-by, delete, shortcuts — all scoped to `tabQueues[audioSubTab]`.
- [x] Tauri release binary rebuilt (no-bundle) at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe` (2026-06-14, build exit 0).

# Startup Queue Reset, Shutdown Order, Separate Disabled, Shortcut & Resize Polish (2026-06-15)
- [x] **Task 10 — Empty queues on startup + shutdown cleanup order:** `App.tsx` clears the Enhance/Convert/Separate tab queues on first mount, gated by a `sessionStorage` `app_initialized` flag so Ctrl+R page reloads do NOT wipe the queue. `src-tauri/src/lib.rs` `CloseRequested` handler reordered: kill the Python sidecar FIRST, `sleep(150ms)` to let Windows release file locks, THEN recursively delete the scratch/temp cache dir, then `process::exit(0)` — prevents the cache-delete failing on files still locked by the backend.
- [x] **Task 11 — "Separate" sub-tab disabled:** `QueueToolbar.tsx` "Separate" pill rendered disabled (reduced opacity, `cursor-not-allowed`, no click). `useUIStore.setAudioSubTab` guards against the `'separate'` value (early-returns) so the tab can never become active even programmatically.
- [x] **Task 12 — Shrunk bottom action buttons:** "Enhance All" / "Convert All" bottom-bar buttons in `QueueGrid.tsx` reduced to `px-3.5 py-1.5 rounded-md text-xs font-medium`.
- [x] **Task 13 — Modifier-aware, unique shortcut recording:** `SettingsPanel.tsx` + `KeyboardShortcutsPanel.tsx` keydown listeners now capture modifier combos; recording a shortcut already bound elsewhere auto-clears the previous binding (no duplicates). Reset syncs `DEFAULT_KEYBOARD_SHORTCUTS` back to the backend settings file via new `customDefaultShortcuts` field (`AppSettings`, `useSettingsStore.setCustomDefaultShortcuts`, persisted). `useKeyboardShortcuts.ts` ignores empty-string bindings so cleared shortcuts don't fire.
- [x] **Task 14 — Full manual column resizing with persistence:** `QueueGrid.tsx` `colWidths` persisted to `localStorage`; resize handles on every header/cell including grip, index, lock, clear; success toast on "Copy Width Log" clipboard write.
- [x] **Task 15 — Verify + build:** `npx tsc --noEmit` (0 errors) and `npm run tauri build` to produce the final release `.exe`.
- [x] Backup snapshot of source copied to `D:\vibe coding\app enhance audio pro v1\` (plan/task markdown grouped under `plan-and-task-docs\`, CLAUDE.md kept in root); committed and pushed to GitHub `master`.

# Task 16 — Bundle FFmpeg with the Sidecar (Export/Convert Bug Fix) (2026-06-15)
- **Bug:** Downloading volume-adjusted audio from the Waveform Player showed an info toast then a red `Export failed: {"success":false,"error":"[WinError 2] The system cannot find the file specified"}`.
- **Root cause:** `manipulate_audio.py`, `convert_audio.py`, `merge_audio.py`, and `equalizer.py` each had a `_ffmpeg_exe()` that checked for `ffmpeg.exe` next to `sys.executable` and otherwise fell back to bare `"ffmpeg"` on PATH. In a one-file PyInstaller bundle data files extract to `sys._MEIPASS` (not the exe's dir), so the check never matched, and end-user machines have no system ffmpeg → `subprocess.run(["ffmpeg", ...])` raises `FileNotFoundError [WinError 2]`. The enhance path was unaffected because `enhance_speech.py`/`enhance_lavasr.py` already used `imageio_ffmpeg.get_ffmpeg_exe()`.
- **Fix (approach chosen over the task's download-static-ffmpeg plan):** point all four processors at `imageio_ffmpeg.get_ffmpeg_exe()` — `imageio-ffmpeg` is already a dependency and ships a static `ffmpeg-win-x86_64-v7.1.exe`, so no download and no `build-backend.ps1` change. Removed now-unused `pathlib`/`sys` imports.
- **Packaging:** `backend/build.spec` — added `collect_data_files('imageio_ffmpeg')` to `datas` and `'imageio_ffmpeg'` to `hiddenimports`. The binary bundles to `imageio_ffmpeg\binaries\` inside `_MEIPASS`, exactly where `get_ffmpeg_exe()` looks in a frozen build.
- **Test infra:** `backend/tests/conftest.py` now calls `platform.uname()` at import. The ffmpeg tests `patch("subprocess.run")` globally, and `imageio_ffmpeg`'s platform detection shells out via subprocess the first time — warming Python's uname cache before any mock is installed lets it resolve without hitting the mock.
- **Verification:** 65/65 backend pytest pass. Frozen sidecar `backend.exe` (360 MB) rebuilt via PyInstaller and exercised directly — `POST /export_volume` returned `{"success":true}` and wrote the output (the exact path that previously failed). Sidecar copied to `src-tauri/binaries/`; Tauri release rebuilt at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe` (8.16 MB, 2026-06-15 17:31, build exit 0).
- **Build note:** `scripts/build-backend.ps1`'s pip step aborts under PowerShell 5.1 (`$ErrorActionPreference="Stop"` treats pip's stderr as a fatal `NativeCommandError`); ran `python -m PyInstaller build.spec` directly instead since deps were already installed.

# Installer Build for Distribution Testing (2026-07-02)
- [x] Verified the no-bundle release `.exe` (`D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe`) runs enhance and convert with live progress and no errors.
- [x] Confirmed sidecar `binaries\backend-x86_64-pc-windows-gnu.exe` is current (304.7 MB, 2026-07-02) and no `backend`/`enhance-audio-pro` processes were holding file locks before build.
- [x] Built the NSIS installer via `CARGO_TARGET_DIR=D:\cargo_build\enhance-audio-pro; npm run tauri build` (Rust release compile 4m 12s, exit 0; only 2 harmless dead-code warnings `get_job_by_id`, `count_active_jobs_by_type`). makensis produced `Enhance Audio Pro_0.1.0_x64-setup.exe` (46.6 MB) at `D:\cargo_build\enhance-audio-pro\release\bundle\nsis\`.
- [x] Copied the installer to `D:\tes\Enhance Audio Pro_0.1.0_x64-setup.exe` for user install/run testing.
- Note: PowerShell 5.1 wraps Tauri's stderr info lines as `NativeCommandError` in the log — these are not real errors; the build completed with exit code 0.

# Installer "Unknown Error During Enhancement" — Sidecar PyInstaller Crash Fix (2026-07-02)
- **Symptom:** Installed app (from `D:\tes` NSIS installer) failed every enhance job instantly with the modal "Unknown error occurred during enhancement" (the frontend empty-message fallback in `QueueGrid.tsx:520`). Convert appeared to work; enhance never did.
- **Diagnosis path:** The app_data_dir empirically resolves to `%APPDATA%\enhance-audio-pro` (single `app.db` there; sidecar logs to `enhance_audio.log` beside it). The installed run left NO log → sidecar never started. Ran the shipped sidecar `binaries\backend-x86_64-pc-windows-gnu.exe` directly with the app's env (`BACKEND_PORT/CALLBACK_PORT/MODELS_DIR/DATABASE_PATH/KMP_DUPLICATE_LIB_OK`) → it **crashed on startup, exit 1**.
- **Root cause:** `AttributeError: module 'pyimod02_importers' has no attribute 'PyiFrozenImporter'. Did you mean: 'PyiFrozenLoader'?` → `Failed to execute script 'pyi_rth_pkgutil'`. The frozen exe (rebuilt 2026-07-02 12:23) bundled a **stale PyInstaller runtime hook** (old `PyiFrozenImporter` name) mixed with a newer `pyimod02_importers` (`PyiFrozenLoader`). Caused by a stale `backend/build/` cache (`localpycs` from Jun 5, `base_library.zip` 11:37) that PyInstaller 6.20.0 reused. Since the sidecar crashed before serving, enhance (and convert) had no backend → generic error.
- **Fix:** Deleted stale `backend/build/` + `backend/dist/`, then clean rebuild: `python -m PyInstaller build.spec --clean --noconfirm` (PyInstaller 6.20.0, hooks-contrib 2026.5, Python 3.11.5). `--clean` + removed cache forces 6.20's own consistent rthooks/pyimod into the bundle.
- **Verification (live, not just build success):** Started the fresh `dist\backend.exe` with real app env → `/health` returned 200 with no crash. Created a test `app.db` (queue_jobs schema) + 2s WAV, `POST /enhance` → 202, and the log showed DeepFilterNet3 weights loaded from `D:\enhance-audio-pro-data\models` (0.38s), audio processed, output saved, **"Completed in 16.75s"**. (Progress-callback warnings expected — no callback server in the harness.)
- **Repackage:** Copied fresh `backend.exe` (359 MB) → `src-tauri\binaries\backend-x86_64-pc-windows-gnu.exe`; `npm run tauri build` (Rust 6m 18s, exit 0) produced `Enhance Audio Pro_0.1.0_x64-setup.exe` (46.6 MB, 15:28) → copied to `D:\tes\`.
- **Build-hygiene rule going forward:** ALWAYS delete `backend/build/` (or pass `--clean`) before rebuilding the sidecar after a PyInstaller upgrade — the cached `localpycs`/rthooks silently mix versions and produce a boot-crashing exe that still builds with exit 0.

# Tab-Isolated Cancel All, Convert-Tab A/B Hidden, Video Roadmap (2026-07-02)
- [x] **Cancel All isolation:** `QueueToolbar.handleCancelAll` no longer flattens both tabs — it reads `useUIStore.getState().audioSubTab` and cancels ONLY that tab's `processing`/`queued` jobs. Clicking "Cancel All" in Enhance leaves the Convert queue (and vice versa) untouched. The `queue:cancel-all` DOM event is dispatched from the per-tab `QueueStatusBar`, so the handler now honours the tab the button belongs to.
- [x] **Waveform A/B toggle restricted to Enhance tab:** `WaveformPlayer` gained a `showAbToggle?: boolean` prop (default `true`); the Original/Enhanced toggle button now renders only when `showAbToggle && outputFilepath`. `ManipulationPanel` resolves which tab the active player job lives in (`activeEntry.tab`) and passes `showAbToggle={tab === 'enhance'}`, so a waveform opened from the Convert tab hides the toggle entirely (falls back to playing the original source path).
- [x] **`plan_video.md` created** in project root — blueprint (not yet implemented) for video drag-and-drop: intercept `.mp4/.mov/.mkv` on both tabs, bypass size/duration limits, background ffmpeg demux (`-vn -map 0:a:0 -c:a libmp3lame`) via a new `extract_audio.py`/`routers/video.py` + Rust `extract_video_audio` command, inject the resulting default-`.mp3` into the drop's active tab, preserve the video's base filename. Grounded in existing seams: `importHelper.handleImportFiles`, `convert_audio.py`'s `-vn` primitive, `queue.rs add_files` media_type, scratch-dir cleanup in `lib.rs`.
- [x] Verified `npx tsc --noEmit` → 0 errors. No rebuild yet (frontend-only + doc changes; sidecar/Rust untouched).

# Video Drag-and-Drop → Audio Extraction Implemented (plan_video.md V1–V3) (2026-07-02)
- **Backend:** `processors/extract_audio.py` runs ffmpeg `-vn -map 0:a:0? -c:a libmp3lame -q:a 2` via the bundled `imageio_ffmpeg` binary (no size/duration guards). `routers/video.py` exposes `POST /extract_audio` — serialized by a global `asyncio.Lock`, writes the mp3 to `<scratch|temp>/enhance-audio-pro-cache/extracted/<base>.<hash8>.<fmt>` (hash of source path avoids base-name collisions), and returns `{ success, audio_path, base_name }`. Registered in `main.py`. `backend/build.spec` needed NO change — PyInstaller follows the `main.py → routers.video → processors.extract_audio` import chain.
- **Rust:** `commands/video.rs::extract_video_audio` (async) POSTs to `/extract_audio` with a cold-start retry loop (8×2 s) and a 30-min per-attempt timeout, parses the JSON, returns `IpcResponse<ExtractedAudio>`. Registered in `commands/mod.rs` + `lib.rs` invoke_handler. Scratch cache is already wiped on app close by the existing `enhance-audio-pro-cache` recursive delete in `lib.rs`.
- **Frontend:** `ipc.invokeExtractVideoAudio`; `fileValidation.isVideoFile`. `importHelper.handleImportFiles` now partitions dropped paths into video vs audio, extracts each video (dedupes by `source_video_path` so re-drops don't re-extract), tags created jobs with `source_video_path` (frontend-only field on `QueueJob`), and threads a `sourceVideoMap` through duplicate resolution (`DuplicatePending.sourceVideoMap`, consumed in `DropZone.tsx`). Convert tab now accepts video (audio inputs still restricted to mp3/wav); the browse dialog offers video extensions on both audio sub-tabs. The OS drag-drop path already passed all paths unfiltered, so `.mp4/.mov/.mkv` drops reach the pipeline on both tabs.
- **Live verification (frozen sidecar, not just build):** rebuilt `backend.exe` (359.2 MB, clean `--clean` PyInstaller) → started with real env → `/health` 200 after ~60 s cold start → `POST /extract_audio` on a generated 2 s `testsrc+sine` mp4 returned `success:true` and wrote a real 11 KB mp3 with `base_name: eap_test_clip.mp3` (base filename preserved); a no-audio mp4 returned the friendly `"No audio track found in the video."` error.
- **Packaging:** fresh `backend.exe` → `src-tauri\binaries\backend-x86_64-pc-windows-gnu.exe`. Rebuilt the standalone release exe first (`npm run tauri build -- --no-bundle`, 5m29s) at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe` (7.80 MB, 18:27), then the NSIS installer (`npm run tauri build`, reused compiled binary, makensis) → `Enhance Audio Pro_0.1.0_x64-setup.exe` (46.63 MB, 18:31), copied to `releases/` and `D:\tes\`. Build hygiene: killed a leftover `backend` PID before rebuilding; only the 2 known dead-code warnings.
- **Git:** `trash/` added to `.gitignore` (excluded from backup); 46.6 MB NSIS installer committed under `releases/`. (The 358 MB `D:\tes` build exceeds GitHub's 100 MB file limit and is not pushed.)

# Video Drag-Drop Fix, Exact Filename, Esc-to-Cancel Import (2026-07-03)
- **Bug 1 — video drag-and-drop failed while browse worked:** Dropping `.mp4/.mov/.mkv` threw "N video file(s) had no audio track or failed to extract", but the SAME file via "click to browse" extracted fine. **Root cause:** on Windows, wry (Tauri's webview) hands drag-drop paths back with the extended-length **verbatim prefix** `\\?\` (browse-dialog paths are plain). ffmpeg rejects `\\?\…` inputs with "Invalid argument" (verified: only the `\\?\` form fails; brackets, spaces, forward-slashes, lowercase drive all work), so extraction failed and got mislabeled as "no audio track". **Fix:** strip the `\\?\` / `\\?\UNC\` prefix (+ trim/dequote) in two places — `fileValidation.normalizeOsPath()` applied in `DropZone.resolveDroppedPaths` (so drag == browse), and `routers/video._normalize_input_path()` as backend defense-in-depth. `video.py` also now `is_file()`-checks the source and returns a precise `"Video file not found: …"` (400) instead of the generic message, logs `raw`+`normalized` paths, and the frontend now surfaces the real backend error text in the toast.
- **Bug 2 — random hash appended to extracted filename:** output was `<base>.<hash8>.<fmt>` (e.g. `[Kusonime] … [1080p].f40182ee.mp3`), and since the queue filename is the basename, the user saw the hash. **Fix:** moved the collision-avoidance hash into the *directory* — `<scratch|temp>/enhance-audio-pro-cache/extracted/<hash8>/<base>.<fmt>` — so the file keeps EXACTLY the original base name (`[Kusonime] You-zitsu S4 - 01 [1080p].mp3`) while two same-named source videos still can't collide.
- **Bug 3 — no way to cancel "Importing files…" overlay:** added `importCancelSeq` counter + `cancelImport()` to `useUIStore`. `App.tsx` shows a "Cancel (Esc)" button and a capture-phase Esc keydown listener while importing; `importHelper.handleImportFiles`/`submitAddFilesDirect` snapshot the counter and bail out (hide overlay, skip enqueue) if it changes — aborting between per-video extractions and before DB insert. (A single in-flight ffmpeg extraction isn't force-killed, but the overlay clears immediately and the stray cache file is wiped on app close.)
- **Verification:** `tsc --noEmit` 0 errors; 38/38 Vitest; 67/67 Pytest (added `tests/test_video_normalize.py`, 4 cases). Frozen sidecar rebuilt clean (`--clean` PyInstaller, `dist/backend.exe` 376 MB) → started with real env → `/health` 200 → `POST /extract_audio` with BOTH a normal path AND a `\\?\`-verbatim path returned `success:true` with `base_name`/on-disk name exactly `[Kusonime] You-zitsu S4 - 01 [1080p].mp3` (no hash). Sidecar copied to `src-tauri/binaries/`; release exe rebuilt (`npm run tauri build -- --no-bundle`, 4m31s, exit 0, 2 known dead-code warnings) at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe` (7.8 MB, 2026-07-03 01:35). Installer NOT regenerated per request (user wants to manual-test the exe first).

# Test Coverage (final)
- 38/38 Vitest (frontend) — test file updated for new per-tab store API
- 67/67 Pytest (backend) — includes test_extract_audio.py + new test_video_normalize.py (verbatim-prefix stripping)
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
