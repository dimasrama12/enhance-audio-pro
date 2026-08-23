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
- Version : v0.2.4
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

# CRITICAL — Full Installer Bundled the WRONG (stale msvc) Sidecar; Fixed via --target gnu (2026-07-03)
- **Symptom:** The user reported the NSIS installer was a "lightweight ~40 MB" build and wanted the comprehensive 300+ MB one bundling the full backend.
- **Root cause (important, recurring trap):** Running the bundler as plain `npm run tauri build` (NO `--target`) on this gnu-host machine generates `D:\cargo_build\enhance-audio-pro\release\nsis\x64\installer.nsi`, whose sidecar `File` line references **`binaries\backend-x86_64-pc-windows-msvc.exe`** — the STALE 46 MB msvc stub dated **May 23** (never updated since). So every plain-build installer shipped an ancient backend missing ALL recent fixes, and was only ~46–49 MB. Meanwhile `--target x86_64-pc-windows-gnu` generates a DIFFERENT script under `...\x86_64-pc-windows-gnu\release\nsis\x64\installer.nsi` that references the correct fresh **`backend-x86_64-pc-windows-gnu.exe`** (376 MB). Proof: with `nsis.compression: "none"`, the plain build stayed 52 MB (msvc stub) while the `--target gnu` build was 367 MB (full sidecar).
- **MANDATORY BUILD RULE:** ALWAYS build the installer with `npm run tauri build -- --target x86_64-pc-windows-gnu` (this is exactly what `scripts/build-app.ps1` line 63 does). Output lands in `...\x86_64-pc-windows-gnu\release\bundle\nsis\`, NOT `...\release\bundle\nsis\`. NEVER trust a plain `npm run tauri build` installer — it silently bundles the msvc-named binary.
- **Safety net applied:** copied the fresh 376 MB backend over the stale `backend-x86_64-pc-windows-msvc.exe` too (a PyInstaller exe is triple-agnostic at runtime; the triple only drives Tauri's file selection), so even a plain build now bundles a current backend. CI (`release.yml`, msvc toolchain) rebuilds that file fresh, so this local copy is harmless there.
- **Config change:** `tauri.conf.json` → `bundle.windows.nsis.compression: "none"` so the installer is ~367 MB (uncompressed payload), unambiguously containing the full backend and matching the user's 300+ MB expectation. (LZMA would still bundle the full sidecar but compress it much smaller.)
- **Delivered:** `npm run tauri build -- --target x86_64-pc-windows-gnu` (Rust 2m59s, exit 0, 2 known dead-code warnings) → makensis produced `Enhance Audio Pro_0.1.0_x64-setup.exe` (**367.5 MB**, 2026-07-03 02:57) at `...\x86_64-pc-windows-gnu\release\bundle\nsis\`; copied to `D:\tes\Enhance Audio Pro_0.1.0_x64-setup.exe` for manual install testing.

# Non-Blocking Background Import, Global Action Unlock, Duplicate Modal for Videos (2026-07-03)
Three behavioral fixes (frontend-only; no Rust/Python changes) + standalone exe rebuild for manual regression testing.
- **Fix 1 — "Enhance All" / "Convert All" no longer lock when one row is run manually:** Previously, kicking off a single per-row Enhance/Convert set a job to `processing`, which made `QueueActionBar.canEnhance/canConvert` false (they were gated by `!isAnyActive`), disabling the bottom action button (stuck showing "Enhancing…") so the other pending rows couldn't be batch-processed. **Fix:** removed the `isAnyActive` gate from `canEnhance`/`canConvert` (QueueGrid.tsx) and the `isActive` early-return from `QueueToolbar.handleProcess`/`handleConvert`. The global action now always queues the remaining pending rows; if something is already processing it simply marks them `queued` and the existing auto-advance (`queue://status-change` listener) picks them up when the current job finishes. Button labels now read "Enhance All"/"Convert All" whenever work can be queued, and only fall back to "Enhancing…/Converting…" (disabled) when nothing is left to queue. Dimmed import placeholders are excluded from all batch/queue counts (they aren't in the DB yet).
- **Fix 2 — Duplicate modal now catches re-added VIDEOS (was showing a misleading red error):** The old `handleImportFiles` silently deduped re-dropped videos by `source_video_path` BEFORE the importable-set check, so re-adding an already-imported video produced an empty set → the red inline "Only MP3, WAV, or video files are supported…" / "No supported audio or video files found." warning (screenshot b.png). **Fix:** duplicate detection now runs up front on the SOURCE path for both media kinds — audio matches by `filepath`, video matches by `source_video_path` — and any duplicates open the "Duplicate Files Detected" modal with **Add All (Re-add Duplicate)** / **Add N New Only (No Duplicate)** / **Cancel**. All remaining inline red import errors (unsupported/skipped/extraction-failure) were converted to non-blocking toasts; `importError`/`importLimitWarning` removed from `useUIStore` and their JSX removed from `DropZone`.
- **Fix 3 — Import is now fully non-blocking with per-row illumination:** Discarded the blocking "Importing files…" overlay entirely (removed from `App.tsx`; `isImporting`/`importCancelSeq`/`cancelImport` removed from `useUIStore`). New flow in `importHelper.ts`: `handleImportFiles` → (duplicate check) → `startBackgroundImport(items, …)` immediately drops **dimmed placeholder rows** (`makePlaceholder`, temp `placeholder-<uuid>` id, `media_type:'audio'` so video-sourced rows still show on the Audio tab) via new store action `addPlaceholders`, then fires `processImportItem` per item concurrently. Each item extracts (video→ffmpeg) and/or `invokeAddFiles`, then swaps its placeholder for the real DB job via `resolvePlaceholder` (which un-dims that specific row) — or `removePlaceholder` + error toast on failure. Placeholder rows reuse the existing `tabImportingIds` dim (`opacity-40 pointer-events-none`, no click/delete/process). Per-job convert-format default + destination are applied in `processImportItem`. Leftover placeholders (crash mid-import) are cleaned on next launch by `setJobs(DB)` filtering to real ids.
- **Store additions:** `useQueueStore` — `addPlaceholders`, `resolvePlaceholder`, `removePlaceholder`. `useUIStore` — new `ImportItem { path, isVideo }` type; `DuplicatePending` reshaped to `{ allItems, uniqueItems, duplicateNames, skippedInvalid }`.
- **Verification:** `tsc --noEmit` 0 errors; 38/38 Vitest pass. Rust `add_files` locks `state.db` mutex so the new per-file concurrent `invokeAddFiles` calls serialize safely. Standalone release exe rebuilt (`npm run tauri build -- --no-bundle`, Rust 4m12s, exit 0, only the 2 known dead-code warnings) at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe` (7.8 MB, 2026-07-03 09:03) for manual regression testing. Installer NOT regenerated per the workflow (user manual-tests the exe first, then we compile the full `--target x86_64-pc-windows-gnu` NSIS installer).

# Real-Time Video-Extraction Progress: Skeleton Shimmer + Live Progress Bar (2026-07-03)
Turned the dimmed background-import placeholder rows (video → audio extraction) into rich, real-time skeleton-loading feedback driven by genuine backend progress events. End-to-end across all three languages, reusing the existing enhance callback pipeline.
- **Backend real progress (`backend/processors/extract_audio.py`):** replaced the no-op `10→100` stub with true ffmpeg progress. Probes total duration via `_probe_duration_seconds()` (parses the `Duration:` banner from `ffmpeg -hide_banner -i` stderr; imageio-ffmpeg ships ffmpeg only, no ffprobe), then runs the demux with `-progress pipe:1 -nostats` and streams `subprocess.Popen`, parsing `out_time_us` line-by-line → `progress_cb(pct)` (1..99, clamped) and `100` on `progress=end`. Falls back to indeterminate (no per-percent emits) when duration is unknown. `-loglevel error` keeps stderr tiny so the single stdout read loop can't deadlock; stderr is drained after the loop for the error path (preserves the friendly "No audio track found" message).
- **Backend routing (`backend/routers/video.py`):** `ExtractRequest` gained optional `job_id` + `callback_url`. The extraction thread's `_cb` now `httpx.post`s each percent to `{callback_url}/callback/progress` with `{job_id, percent}` (best-effort — a failed callback never aborts extraction). Serialised by the existing `_extract_lock`.
- **Rust (`src-tauri/src/commands/video.rs`):** `extract_video_audio` takes a new `job_id: Option<String>` and forwards it plus `callback_url` (built from `state.callback_port`, same server enhance/convert use) into the `/extract_audio` payload.
- **Event loop (reuses enhance infra):** placeholder id → backend → `/callback/progress` → Rust `callback/mod.rs` emits `queue://progress {jobId, percent}` → QueueGrid's existing listener calls `setProgress`, updating the placeholder row's `progress` field (no new event channel, no new listener needed).
- **Frontend plumbing:** `ipc.invokeExtractVideoAudio(path, fmt, jobId?)`; `importHelper.processImportItem` passes `placeholder.id` as the jobId so events light up that exact row.
- **UI (`src/index.css` + `src/components/QueueGrid.tsx`):** new CSS — `import-row-pulse` (slow 1.8s breathing opacity), `import-shimmer-text` (gradient sweep clipped to the filename text, skeleton-loading style), `import-bar-indeterminate` (marquee). Importing rows/cards now pulse + shimmer the filename, and the STATUS column shows a violet "Extracting"/`NN%` badge with a live progress bar — **indeterminate marquee until the first real percentage arrives, then determinate** (new `ImportingStatus` component). On completion, `resolvePlaceholder` swaps in the real DB job and drops the id from `tabImportingIds`, which automatically stops the pulse/shimmer, hides the bar, restores full opacity, and re-enables the row for selection/delete/process. Replaced the old flat `opacity-40` dim in both table row and grid card.
- **Live verification (frozen sidecar, not just build):** clean `--clean` PyInstaller rebuild → started `dist/backend.exe` with a tiny callback server + generated 8s testsrc+sine mp4 → `POST /extract_audio` with `job_id` returned `success:true` and the callback server logged real streamed percents `[1, 99, 100]` (short clip finishes in ~2s so only one intermediate landed; longer videos stream many). Health 200 after ~35s cold start.
- **Tests:** `backend/tests/test_extract_audio.py` rewritten for the Popen streaming path (mocks `subprocess.Popen` + the `subprocess.run` duration probe, stubs `imageio_ffmpeg.get_ffmpeg_exe` since it shells out); asserts a real intermediate percentage is streamed and `-progress` is in the ffmpeg cmd. **67/67 Pytest, 38/38 Vitest, `tsc --noEmit` 0 errors.**
- **Packaging:** fresh clean sidecar `backend.exe` (376 MB) → `src-tauri/binaries/backend-x86_64-pc-windows-gnu.exe`; standalone release exe rebuilt (`npm run tauri build -- --no-bundle`, Rust 10m38s, exit 0, only the 2 known dead-code warnings) at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe` (7.8 MB, 2026-07-03 13:32) with the fresh sidecar (359 MB) copied beside it. Installer NOT regenerated — user manual-tests the exe first, then we build the `--target x86_64-pc-windows-gnu` NSIS installer.

# Import-Row Animation Trim + CRITICAL Video-Extraction Cold-Start Fix (2026-07-03)
Two revisions on the background video-extraction feature (frontend + Rust; no Python change → no sidecar rebuild).
- **Fix 1 — Removed pulse/shimmer from disabled import rows, kept only the progress bar:** The `import-row-pulse` (breathing-opacity) class and the `import-shimmer-text` (gradient-swept filename) class were dropped from both the table row (`SortableJobRow`) and the grid card (`SortableJobCard`) in `src/components/QueueGrid.tsx`. Rows still stay disabled during extraction (`pointer-events-none cursor-default` + the subtle violet bg tint retained), and the only motion is now the linear extraction progress bar (`ImportingStatus` component / card bar — determinate fill once a real percent arrives, indeterminate `import-bar-indeterminate` marquee before that). The unused `import-row-pulse`/`import-shimmer`/`import-shimmer-text` keyframes + classes were deleted from `src/index.css` (kept `import-bar-indeterminate`).
- **Fix 2 (CRITICAL) — "Backend unavailable after 8 attempts …/extract_audio" on video drop:** Root cause was a too-short cold-start retry window in `src-tauri/src/commands/video.rs::extract_video_audio`. Video extraction fires at *import* time — often seconds after launch while the frozen PyInstaller sidecar is still unpacking/initialising (empirically 35–60 s first boot). The extract loop only retried `MAX_ATTEMPTS = 8` × 2 s = ~16 s, expiring before the sidecar answered → reqwest "error sending request" (connection refused) surfaced as the toast. Enhance/convert worked because they run later once the backend is warm (their `process.rs` loop already uses 45 attempts). **Fix:** bumped extract `MAX_ATTEMPTS` from 8 → **45** (~90 s window, matching enhance), each attempt still allowing 1800 s for the actual demux. Tab-independent, so it fixes both Enhance and Convert tabs.
- **Verification:** `tsc --noEmit` 0 errors. Standalone release exe rebuilt (`npm run tauri build -- --no-bundle`, frontend vite 49.7 s, Rust 6m03s, exit 0, only the 2 known dead-code warnings) at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe` (7.8 MB, 2026-07-03 14:52). Existing sidecar `backend.exe` (359 MB, unchanged) sits beside it. Installer NOT regenerated — user manual-tests the exe first.

# Project Folder Cleanup — Planning Docs & Scratch Archived to trash/ (2026-07-03)
Housekeeping pass (no code/build change). Moved obsolete/planning items into `trash/archived-2026-07-03/` (trash/ is gitignored, so this un-tracks the copies; nothing deleted — staged for the user's manual review/deletion). NOT committed.
- **`scratch-scripts/`** — `clean_up.ps1`, `deep_scan.py`, `deep_scan_fast.py`, `scan_output.txt` (untracked home-dir disk-scan scratch, unrelated to the project).
- **`planning-docs/`** — `plan_video.md` (video feature now implemented), `PRD_Enhance_Audio_Pro.txt`, and the **entire `docs/` folder** (`docs/superpowers/plans/claude.md` + the 9 `docs/superpowers/specs/*.md` phase design docs). Root `docs/` no longer exists.
- **Note:** Section 13 / 18 references to `docs/superpowers/specs/…` and `…/plans/…` paths are now historical — those files live under `trash/archived-2026-07-03/planning-docs/docs/` until the user deletes them. Root is now trimmed to active files only (configs, src, src-tauri, backend, scripts, public, dist, releases, node_modules, CHANGELOG.md, CLAUDE.md).
- **`stale-build/`** — `Enhance Audio Pro_0.1.0_x64-setup.exe` (46.63 MB, the stale lightweight installer, git-tracked; superseded by the 367 MB full build in `D:\tes`). The now-empty root `releases/` folder was removed.

# Final Full NSIS Installer Built (post cold-start fix) (2026-07-03)
After the user confirmed the standalone exe (import-row animation trim + video-extraction cold-start fix) tested correctly, built the comprehensive production installer bundling the full backend sidecar.
- **Build:** `CARGO_TARGET_DIR=D:\cargo_build\enhance-audio-pro; npm run tauri build -- --target x86_64-pc-windows-gnu` (per the CRITICAL BUILD RULE — a plain `npm run tauri build` bundles the stale ~46 MB msvc stub). Frontend vite 5.1 s, Rust release 6m19s, exit 0, only the 2 known dead-code warnings; makensis produced the bundle. Cleared `backend`/`enhance-audio-pro` process locks first. Bundled sidecar `binaries\backend-x86_64-pc-windows-gnu.exe` verified current (359 MB, unchanged — no Python change this round).
- **Output:** `Enhance Audio Pro_0.1.0_x64-setup.exe` (**367.46 MB**, 2026-07-03 15:24) at `D:\cargo_build\enhance-audio-pro\x86_64-pc-windows-gnu\release\bundle\nsis\`. Size confirms the full uncompressed sidecar payload (`nsis.compression: "none"`), not the lightweight stub. Copied to `D:\tes\Enhance Audio Pro_0.1.0_x64-setup.exe` for distribution/install testing on the user's friend's machine.

# ═══════════════════════════════════════════════════════════════════════════════
# PROJECT PROCESS BOOK — COMPLETE CHRONOLOGICAL TASK HISTORY (compiled 2026-07-03)
# ═══════════════════════════════════════════════════════════════════════════════
> This is the consolidated, strictly chronological timeline of every task, feature
> request, and programming instruction executed on Enhance Audio Pro — from the very
> first scaffold task to the final installer. Compiled from the archived planning
> docs now in `trash/archived-2026-07-03/` (master implementation plan, PRD update
> log `prd_update_eng.md`, the UI-overhaul `task.md`, and per-feature plans) plus
> the dated progress logs above. Original task numbering is preserved verbatim,
> including gaps (e.g. PRD #26, #61 were skipped in the source; #67 logged after #68).

## STAGE I — FOUNDATIONAL BUILD: Phases 1–9 (2026-05-20 → 2026-05-23)
Built test-first (TDD) across React + Tauri/Rust + Python FastAPI sidecar.

### Phase 1 — App Scaffold (2026-05-20)
1. Project scaffold (package.json, vite, tailwind, postcss, npm install)
2. TypeScript types — ipc.ts, queue.ts, settings.ts
3. File validation utility + 8 Vitest tests (TDD)
4. Zustand stores (useQueueStore, useSettingsStore) + 8 Vitest tests
5. IPC wrappers + React entry (ipc.ts, main.tsx, App.tsx, index.css)
6. All 7 UI components (TitleBar, Sidebar, DropZone, QueueToolbar, QueueGrid, SettingsPanel, SetupWizard) — 16/16 Vitest
7. Tauri v2 Rust scaffold (Cargo.toml, tauri.conf.json, capabilities, main.rs, lib.rs, commands/db/sidecar mods)
8. SQLite DB layer — migrations.rs (queue_jobs), queue.rs (insert/get)
9. Tauri IPC commands — add_files, get_queue, get/save_settings, IpcResponse<T>
10. Python sidecar lifecycle manager — available_port + spawn
11. Python FastAPI backend — /health, /queue/process (501 stub); 2/2 Pytest
12. Binaries dir + sidecar wiring (externalBin, full spawn+health-poll)
13. First dev run + integration test — all green

### Phase 2 — Speech Enhancement (2026-05-21)
1. Cargo axum/tokio/reqwest deps · 2. DB progress/error migration + Rust unit tests · 3. Rust axum callback server (progress/status/wizard) · 4. AppState callback_port wiring · 5. process_queue + start_model_download commands · 6. Python requirements + conftest mocks · 7. enhance_speech.py DeepFilterNet3 lazy loader (CUDA/CPU) · 8. routers/enhance.py · 9. routers/wizard.py streaming HF download · 10. main.py router registration · 11. QueueJob progress/error + store · 12. IPC wrappers · 13. QueueGrid progress bar + event subs · 14. QueueToolbar Enhance dispatch · 15. SetupWizard real download · 16. Integration (19/19 Vitest, 11/11 Pytest)

### Phase 3 — Stem Separation (2026-05-21)
1. Demucs mocks in conftest · 2. separate_stems.py htdemucs_ft lazy loader · 3. routers/separate.py + demucs dep · 4. commands/separate.rs · 5. invokeSeparateStems + Separate button (Enhance renamed from Process) · 6. Integration (19/19 Vitest, 18/18 Pytest)

### Phase 4 — Packaging, Conversion, Batch Limits (2026-05-22)
1. output_format column/type/store · 2. convert_audio.py ffmpeg wrapper (7 formats) · 3. routers/convert.py · 4. commands/convert.rs + set_output_format · 5. per-row format select + global override/Apply All + Convert button · 6. 30 audio/10 video batch limits + DropZone warning · 7. PyInstaller build.spec · 8. MSI bundle target · 9. Integration (20/20 Vitest, 25/25 Pytest)

### Phase 5 — Audio Manipulation Tools (2026-05-22)
1. manipulate_audio.py (trim/speed/pitch/volume/fade) + merge_audio.py + equalizer.py (18 presets) · 2. routers/manipulate.py (/manipulate,/merge,/loop,/eq) · 3. commands/manipulate.rs · 4. IPC wrappers + row-select state · 5. EQPanel 11-band · 6. ManipulationPanel 8-tab · 7. design spec · 8. docs/commit (20/20 Vitest, 51/51 Pytest)

### Phase 6 — Polish, UX, Localization (2026-05-22)
1. WaveformPlayer (WaveSurfer) · 2. A/B toggle · 3. enhancement strength slider · 4. multi-select (Ctrl/Shift click) · 5. Grid/List toggle · 6. i18next + 17 languages · 7. useKeyboardShortcuts (Ctrl+A/Esc/Del/E/S/C) · 8. HelpPanel · 9. per-row BitrateSelect · 10. output_filepath tracking · 11. backend strength/bitrate (31/31 Vitest, 56/56 Pytest)

### Phase 7 — Extended Features (2026-05-22)
1. Zustand persist auto-save · 2. Spectrogram view · 3. 10 more locales (17 total) · 4. macOS bundle targets · 5. output folder picker · 6. HistoryPanel (last 50) · 7. drag-to-reorder (@dnd-kit) (33/33 Vitest)

### Phase 8 — Quality, Recording, PRD Completion (2026-05-22)
1. QueueStatusBar pill counters · 2. per-job sample rate selector · 3. filename template · 4. Reset All Editing · 5. in-app recording (MediaRecorder) · 6. rebindable keyboard shortcuts panel · 7. group-by-format · 8. filename template end-to-end (38/38 Vitest, 65/65 Pytest)

### Phase 9 — Build Pipeline & Release Distribution (2026-05-23)
1. build-backend.ps1 · 2. build-app.ps1 orchestration · 3. build:backend/build:full npm scripts · 4. release.yml GitHub Actions (v* tags → MSI) · 5. CHANGELOG v0.1.0 · 6. phase spec docs · 7. commit — **PROJECT FEATURE-COMPLETE (v0.1.0)**

## STAGE II — PRD ITERATIVE REFINEMENT (Tasks 1–68, 2026-05-24 → 2026-06-08)
Numbered user feature requests from `prd_update_eng.md`, executed in order (numbering gaps preserved):
1. Light Mode Improvements · 2. Settings Persistence & Global Changes · 3. User Guide & Settings UI Changes · 4. Scroll & Background Interaction Prevention · 5. Main Screen Table UI Enhancements · 6. Dropzone Text & Interaction Adjustments · 7. Grid View & Shortcuts · 8. Deselecting Queue Files · 9. Recent Files Shortcut · 10. Toolbar Layout Reordering · 11. Settings Persistence Bug Fix · 12. File Import Enhancements (Folder Import & Drag-and-Drop) · 13. Light Theme Color Palette Update · 14. Settings Modal Width Adjustment · 15. Dynamic User Guide Localization · 16. Table View Column Dividers · 17. Process Isolation · 18. Sequential Queue Processing & Status Indicators · 19. Format Group Collapsible Toggle · 20. Lock Queue Items Feature · 21. Theme-Specific Icon and Button Colors · 22. Thicken Table Column Dividers · 23. Lock Queue Items Update · 24. Queue Separation by Media Tab · 25. Remove "Open files" Icon · 27. Active Tab Stroke Indicator · 28. Queue Background Contrast · 29. Default Destination Display · 30. Lock Header Icon · 31. Manipulation Tools Visibility · 32. Global Lock Shortcut (Shift+L) · 33. Toolbar Buttons Width · 34. Sidebar Active Tab Border · 35. Manipulation Tools Visibility refinement · 36. Queue Selection Color · 37. Queue Table Header Contrast & Borders · 38. Record Button Visibility · 39. Fix Drag & Drop Axis Constraints · 40. Waveform Visibility in Light Theme · 41. Audio Recording Implementation & Custom Naming · 42. Remove Play Icon Column · 43. Revamp Manipulation Tools (Focus on Waveform) · 44. Waveform Interaction, Zoom & Style Upgrades (2026-06-01) · 45. Waveform Timeline, Zoom, Volume, Shortcuts & Dropzone Layout · 46. Translation of Task 45 request · 47. Waveform Visual/Zoom Responsiveness, Vertical Gain Stretch, Frame-Level Zoom · 48. Fast Dropzone Transition, Initial Fit Zoom, Volume Cap, Crash Fix, W Shortcut, Reset · 49. Dropzone Sync Bug, 'L' Lock vs Speed Split, Rewind Fix, Volume Gain Playback · 50. Playback Shortcuts Logic & Frame-by-Frame Navigation · 51. Waveform Playback, Zoom, Smooth Cursor & Clean App Shutdown (2026-06-03) · 52. Instant Backward Playback, Capped Zoom, Load Caching, Timeline Navigation · 53. Shortcut Adjustments, Fully-Loaded Caching, Loading Cancellation · 54. Waveform Opening Refactor, Marquee Drag Selection, Delete Shortcuts, Clear Queue · 55. Marquee Selection Bounds, Lock Safeguards, Import Loading Indicators, Switching Fixes · 56. Locked Deletion Safeguards, Right-Click Overrides, Lock Header Toggle, Rapid Switching, Multi-Row Drag Reorder, Tauri Compile · 57. Ctrl+R Shortcut, Delete Key Fix, Waveform Rapid-Switch Error, Multi-Item Drag, Rebuild · 58. Multi-Item Drag Visual Union, Waveform Auto-Focus & Preservation, Playback Switch Fixes, Recompile · 59. Multi-Drag Placeholder Preservation, Continuous Autofocus, Playback Interruption Fixes, Compile · 60. Multi-Drag Gap, Reopen Audio Playback, Rebuild · 62. Dynamic Default Output Format · 63. UI Refinements, Deletion Warnings & Directory Persistence (destination-path bug, Done badge, cache cleanup, column alignment, delete confirmation, seamless A/B, history reveal) · 64. Enhance Pipeline Improvements & Output-Format Fix (non-native MP3/AAC/etc via temp WAV) · 65. Enhance Process Fix (asyncio lock, heartbeat, 30-min timeout), Delete Warning, History Upgrades · 66. Queue Enhancements, Resizable Size Column, Sequential Queueing, History Reveal Fix, Unique Naming, Rebuild · 67. Backend-Unavailable Retry Fix, Enhance-All First-Row Transition, Scratch-Disk/Cache Setting, Rebuild (2026-06-06) · 68. Delete Confirmation Re-verify, History Error Fix, Enhance Cold-Start Fix, Background Audio Preload, Debug Error Logger

## STAGE III — UNLIMITED QUEUE & PER-TAB ARCHITECTURE (2026-06-09 → 2026-06-15)
- **Task 74 (2026-06-09)** — Unlimited file input (removed MAX_QUEUE_JOBS), per-row Enhance/Convert mode dropdown, sequential Convert All, toolbar reorder, completion toast + Download All, Python convert lock/heartbeat.
- **Queue Column Width Calibration (2026-06-13)** — root-caused the resize overflow bug (adjustWidth only handled filename/destination), calibrated + locked 12 column widths (955px total).
- **Columns Non-Resizable (2026-06-14)** — removed the resize system entirely; hardcoded COL_WIDTHS.
- **Audio Sub-Tab System (2026-06-14)** — Enhance | Convert | Separate sub-tabs; per-tab column visibility.
- **UI Overhaul — task.md Tasks 1–9 (2026-06-14):** (1) tab label rename, (2) per-tab independent queues (major useQueueStore refactor — tabQueues + all per-tab state), (3) Record button left of search, (4) neutral tab-pill styling, (5) bottom QueueActionBar, (6) resizable columns w/ Copy Width Log, (7) Shift+1/2 view + 1/2/3 tab-switch shortcuts, (8) strict tab isolation audit, (9) tsc + rebuild.
- **task.md Tasks 10–15 (2026-06-15):** (10) empty queues on startup + shutdown cleanup order (kill sidecar → sleep → delete cache), (11) disable Separate sub-tab, (12) shrink bottom action buttons, (13) modifier-aware unique shortcut recording, (14) full manual column resizing w/ localStorage persistence + toast, (15) verify + build.
- **Task 16 — Bundle FFmpeg with sidecar (2026-06-15):** fixed "Export failed [WinError 2]" — switched manipulate/convert/merge/equalizer processors to `imageio_ffmpeg.get_ffmpeg_exe()`; build.spec bundles the static binary. 65/65 Pytest.

## STAGE IV — VIDEO PIPELINE & DISTRIBUTION HARDENING (2026-07-02 → 2026-07-03)
- **Installer builds + sidecar PyInstaller crash fix (2026-07-02):** diagnosed installed-app "Unknown error during enhancement" → stale `backend/build/` cache mixed PyInstaller runtime-hook versions (`PyiFrozenImporter` vs `PyiFrozenLoader`); clean `--clean` rebuild fixed it. Established build-hygiene rule (always `--clean`).
- **Tab-isolated Cancel All + Convert-tab A/B hidden + video roadmap (2026-07-02):** `plan_video.md` blueprint created.
- **Video drag-drop → audio extraction implemented (2026-07-02):** extract_audio.py (ffmpeg `-vn` demux), routers/video.py (/extract_audio), commands/video.rs, frontend import partitioning, live verification.
- **Video drag-drop fix, exact filename, Esc-to-cancel (2026-07-03):** stripped Windows `\\?\` verbatim prefix (drag == browse), moved collision hash into directory (exact base filename), cancelable import overlay.
- **CRITICAL installer wrong-sidecar fix (2026-07-03):** plain `npm run tauri build` bundled the stale msvc stub → **MANDATORY RULE: build installer with `--target x86_64-pc-windows-gnu`**; set `nsis.compression: "none"` (367 MB full payload).
- **Non-blocking background import + global action unlock + duplicate modal for videos (2026-07-03):** removed isAnyActive gate, up-front duplicate detection for videos, fully non-blocking import with dimmed placeholder rows.
- **Real-time video-extraction progress (2026-07-03):** true ffmpeg `-progress` streaming → `/callback/progress` → `queue://progress` → skeleton shimmer + live bar.
- **Import-row animation trim + CRITICAL cold-start fix (2026-07-03):** removed pulse/shimmer (kept only the linear progress bar); bumped extract retry 8→45 attempts (~90 s) to cover sidecar cold-start (was failing with "Backend unavailable after 8 attempts").
- **Final full NSIS installer (2026-07-03):** 367.46 MB `Enhance Audio Pro_0.1.0_x64-setup.exe` → `D:\tes\`.
- **Project folder cleanup (2026-07-03):** archived scratch scripts, planning docs, `docs/`, stale installer → `trash/archived-2026-07-03/`. This process book compiled from those archives.

# Scope Trim — Remove Manipulation/EQ/Merge + Demucs Mocks + LavaSR Model (2026-07-06)
Driven by `do_this.md` (STEP 3 + STEP 3 TAMBAHAN 3A–3D). App scope narrowed to **Enhance (DeepFilterNet) + Convert only**. Enhance, Convert, DropZone, QueueGrid, WaveformPlayer, History, Settings, Keyboard Shortcuts, Recording all preserved.

- **STEP 3 — Manipulation/EQ/Merge removal:**
  - **Deleted (8):** `src/components/EQPanel.tsx` (dead — imported nowhere), `backend/processors/merge_audio.py`, `backend/processors/equalizer.py`, `backend/tests/test_manipulate_audio.py`, `test_manipulate_endpoint.py`, `test_merge_audio.py`, `test_equalizer.py` (original `manipulate_audio.py` deleted then reconstructed — see below).
  - **CRITICAL keep:** `manipulate_audio.py` had to be **reconstructed** to hold ONLY `volume_audio` + `_ffmpeg_exe` — the WaveformPlayer "download volume-adjusted audio" export (`export_volume_adjusted_audio` Rust cmd → `POST /export_volume` → `from processors.manipulate_audio import volume_audio`) depends on it. Deleting it whole broke that path. Style mirrors `convert_audio.py` (`imageio_ffmpeg.get_ffmpeg_exe()`, `-af volume=<db>dB`).
  - **Edited (5, kept shared/non-feature lines):** `src/lib/ipc.ts` (removed `invokeSeparateStems` [dead stub — no Rust cmd existed], `invokeManipulateAudio`, `invokeMergeAudio`, `invokeLoopAudio`, `invokeApplyEQ`; kept `invokeExportVolumeAdjustedAudio`); `src-tauri/src/commands/manipulate.rs` (removed `manipulate_audio`/`merge_audio`/`loop_audio`/`apply_eq`; kept `export_volume_adjusted_audio`); `src-tauri/src/lib.rs` (dropped those 4 from `use` + `invoke_handler!`); `backend/routers/manipulate.py` (removed `/manipulate` `/merge` `/loop` `/eq` + `_process_*` + `_get_job_row`; kept `ExportVolumeRequest` + `/export_volume`); `backend/tests/conftest.py` (removed all Demucs mocks — Demucs router/processor were already gone in a prior cleanup; `demucs` never in requirements.txt/build.spec).
  - **NOT touched:** `ManipulationPanel.tsx` (already stripped in a prior session to a pure `WaveformPlayer` wrapper — deleting it would remove the player; left as-is, rename to `WaveformPanel.tsx` deferred pending user confirmation). `App.tsx` still imports it. `backend/main.py` still registers `manipulate.router` (serves `/export_volume`). `commands/mod.rs` still has `pub mod manipulate;`.

- **STEP 3 TAMBAHAN (3A–3D) — LavaSR removal (DeepFilterNet is now the only enhancement model):**
  - **Deleted (2):** `backend/processors/enhance_lavasr.py`, `backend/manual_test_lavasr.py`.
  - **Edited (6):** `backend/routers/enhance.py` (removed the `if _model_type == "lavasr": enhance_file_lavasr(...)` branch — now always `enhance_file(...)` DeepFilterNet); `backend/requirements.txt` (removed `git+https://github.com/ysharma3501/LavaSR.git`); `backend/build.spec` (removed `collect_all('LavaSR')` + `collect_submodules('LavaSR')` + binaries/datas/hidden refs — **kept torch + torchaudio**: torchaudio is required by DeepFilterNet's `df/io.py` compat shim, NOT LavaSR-only); `src/types/settings.ts` + `src/stores/useSettingsStore.ts` (narrowed `aiModel` type `'deepfilternet' | 'lavasr'` → `'deepfilternet'`); `src/components/SettingsPanel.tsx` (removed the V1/V2 model-selector button block).
  - **Design choice (per do_this.md 3B allowance):** `aiModel` field KEPT (permanently `'deepfilternet'`) rather than fully removed — it appears in ~10 call sites as `aiModel ?? 'deepfilternet'` (SetupWizard, Sidebar, KeyboardShortcutsPanel×3, QueueGrid×2, QueueToolbar, useKeyboardShortcuts×2, ipc.ts, process.rs); narrowing the type kept them all compiling untouched. `process_queue`/`invokeProcessQueue` signatures unchanged (still forward `model_type`, defaulting to deepfilternet). LavaSR was never bundled in the installer nor downloaded by SetupWizard (it self-downloaded on-demand via `snapshot_download`), so no SetupWizard/model-weights change needed.

- **Verification (all green):** `tsc --noEmit` 0 errors; **38/38 Vitest**; **41/41 Pytest** (was 67 — the 26 manipulate/merge/eq tests were in the deleted files); dead-reference sweep across the whole repo for `separate_stems|invokeSeparate|invokeManipulate|invokeMerge|invokeLoop|invokeApplyEQ|apply_eq|loop_audio|merge_audio|EQPanel|enhance_lavasr|lavasr|LavaSR` → **0 matches**; `cargo check` (with `CARGO_TARGET_DIR=D:\cargo_build\enhance-audio-pro`) **exit 0**, only the 2 pre-existing dead-code warnings (`get_job_by_id`, `count_active_jobs_by_type`).
- **STEP 5 — installer rebuild (DONE 2026-07-06):** Followed build-hygiene rules. Killed 2 orphaned `backend` PIDs (2412, 5228); `backend/build/`+`dist/` already clean. Rebuilt sidecar `python -m PyInstaller build.spec --clean --noconfirm` → `dist/backend.exe` **358.4 MB** (exit 0; slightly smaller than the prior 359–376 MB — LavaSR gone). **Live smoke test** (not just build success): started the fresh `backend.exe` with real env (BACKEND_PORT/CALLBACK_PORT/MODELS_DIR/DATABASE_PATH/KMP_DUPLICATE_LIB_OK) → `/health` returned `{"status":"ok"}` after ~20 s cold start. Note: `python -c "import df"` fails outside the frozen runtime (torchaudio.backend.common shim only applied by rthook `pyi_rth_torchaudio_compat.py`) — expected, not a regression. Copied `backend.exe` → BOTH `src-tauri/binaries/backend-x86_64-pc-windows-gnu.exe` AND `-msvc.exe` (msvc safety-net). Built installer `npm run tauri build -- --target x86_64-pc-windows-gnu` (CARGO_TARGET_DIR=`D:\cargo_build\enhance-audio-pro`) — Rust release 6m01s, exit 0, only the 2 known dead-code warnings; makensis → **`Enhance Audio Pro_0.1.0_x64-setup.exe` 366.62 MB** at `...\x86_64-pc-windows-gnu\release\bundle\nsis\`, copied to `D:\tes\`. Size ~1 MB smaller than prior 367.46 MB (torch/torchaudio dominate payload; LavaSR pip-dep removal is marginal — the do_this.md "Demucs weights shrink" expectation was moot since Demucs was already gone in a prior cleanup).

# Test Coverage (final)
- 38/38 Vitest (frontend) — test file updated for new per-tab store API
- 41/41 Pytest (backend) — was 67 before the 2026-07-06 scope trim removed the manipulate/merge/eq test files
- cargo check clean (2 known dead-code warnings)
- TypeScript tsc --noEmit: 0 errors
```

# v0.2.3 — Settings Format Display Fix & GitHub Release (2026-07-09)
- [x] **Format display verification:** Confirmed FLAC is natively supported by both the DeepFilterNet enhance pipeline (soundfile) and the convert pipeline (ffmpeg). M4A is also technically supported via ffmpeg but not a primary advertised format.
- [x] **Settings Formats tab trimmed:** `src/components/SettingsPanel.tsx` — `AUDIO_FORMATS` array reduced from 7 entries (MP3, WAV, FLAC, AAC, OGG, OPUS, M4A) to **4 entries (MP3, WAV, FLAC, OPUS)** matching the product's official supported set.
- [x] **Version bumped 0.1.0 → 0.2.3** across `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `package.json`, and `CLAUDE.md`.
- [x] **Installer rebuilt:** `npm run tauri build -- --target x86_64-pc-windows-gnu` (Rust 2m30s, exit 0, 2 known dead-code warnings) → `Enhance Audio Pro_0.2.3_x64-setup.exe` **366.62 MB** at `D:\cargo_build\enhance-audio-pro\x86_64-pc-windows-gnu\release\bundle\nsis\`. Copied to `D:\tes\`.
- [x] **`.gitignore` updated:** Added `installer/`, `releases/`, `*.exe`, `stale-build/` exclusions so installer binaries are never committed to git.
- [x] **Source pushed to GitHub (`dimasrama12/enhance-audio-pro` master):** Initialized git in v3 via clone-and-overlay strategy (preserves v1 history). Commit `badbae1` — 39 files changed, 4439 insertions, 1365 deletions. Includes entire v3 evolution since the May 2026 v1 backup.
- [x] **GitHub Release v0.2.3 created:** https://github.com/dimasrama12/enhance-audio-pro/releases/tag/v0.2.3 — installer uploaded as release asset (366.62 MB).

# Enhance Quality — Post-DFN HF De-hiss + De-pumping (perceptual parity with Adobe Podcast) (2026-08-01)
Driven by `do this.md` (Fase 1 investigasi → Fase 2 `PLAN.md` → implementasi setelah user "continue process"). Root problem (from a 5-sample quantitative benchmark `audio_quality_benchmark.py`): app output loses perceptually to Adobe Podcast because DeepFilterNet **does not attenuate HF hiss** (ΔHF ≈ 0% vs Adobe −56%) and produces **musical-noise pumping** (jitter +55–64% vs Adobe +20%); STOI was already competitive (S50 0.858 > web 0.786).
- **Investigation findings (see `PLAN.md` Fase 1):** whole enhance DSP lives ONLY in `backend/processors/enhance_speech.py:enhance_file`. "Strength" maps to DeepFilterNet's `atten_lim_db` (NOT linear wet/dry): `atten_lim_db = strength*40`, and DFN mixes `noisy*lim + enhanced*(1-lim)`, `lim=10^(-atten/20)` — higher strength = more aggressive. **Quirk:** `atten_lim_db==0` is falsy in DFN → full effect (not pass-through). NO post-processing existed (no EQ/shelf/limiter/gate), 48 kHz, hard 5 s chunks, no external gate.
- **Implemented (3 modules, each env-flagged so measurable independently):**
  - **Module 1 — HF de-hiss shelf** (`_apply_hf_shelf`): `torchaudio.functional.treble_biquad`, default **−4 dB @ 3500 Hz, Q 0.707**. No new dep (torchaudio already required), no ffmpeg round-trip.
  - **Module 2b — envelope de-pumping** (`_apply_envelope_smoothing`): asymmetric one-pole on frame-RMS envelope, bounded corrective gain. Default ON, **attack 5 ms / release 50 ms / ±3 dB**. (Module 2a chunk-overlap NOT needed — jitter target met by 2b alone.)
  - **Module 3 — Strength**: confirmed default **50** (data: STOI/jitter/naturalness all better at 50 than 100 — do NOT raise). Fixed the `atten_lim_db==0` semantic (guard `≥1 dB` for strength>0; only strength==0 is true pass-through) + accurate docstring.
  - Wired via `_post_process(enhanced_audio, sr)` between `torch.cat` and `save_audio` in `enhance_file`.
- **Testing harness (Module 4):** `scripts/regen_enhanced_benchmark.py` (NEW) drives the REAL DeepFilterNet3 (system Python 3.11 + inline torchaudio compat shim mirroring the PyInstaller rthook) to regenerate the `aplikasi(baru)` variant on the same 5 `*_asli.wav`; `audio_quality_benchmark.py` extended to recognize it. Note: the `.venv` is empty — the model + torch/df live in system Python `C:\Users\User\AppData\Local\Programs\Python\Python311`; DFN weights auto-cache to `%LOCALAPPDATA%\DeepFilterNet\...\DeepFilterNet3`.
- **Validated result (avg of 5 samples, real model) — ALL `do this.md` targets met:** ΔHF **−0.8% → −40%** (target −30..−45%, strong hiss masking, still more natural than Adobe's −56%); jitter **+55% → +16.6%** (BELOW Adobe's +19.5%); STOI **0.847** (kept, still > Adobe 0.786); LTAS distance 7.19 (< Adobe 11.75 = more natural); envelope corr 0.814 (≥0.80). Per-sample every clip improved on jitter (parah_1 +108→+52, parah_2 +106→+60). Alt config (max 4 dB/rel 60 ms) reaches jitter +7.9% but trades away HF masking/noise-floor — rejected since hiss is the primary complaint.
- **Tuning without code rebuild (env vars, read per-run):** `EAP_HF_SHELF_DB`, `EAP_HF_SHELF_FREQ`, `EAP_HF_SHELF_Q`, `EAP_ENV_SMOOTH`(0/1), `EAP_ENV_ATTACK_MS`, `EAP_ENV_RELEASE_MS`, `EAP_ENV_MAX_DB`.
- **Tests:** **41/41 Pytest** (backend) green — `test_enhance_speech.py` autouse fixture now sets `EAP_HF_SHELF_DB=0`+`EAP_ENV_SMOOTH=0` so the DSP (needs real tensors) is skipped under the session-wide torch/torchaudio MagicMocks (DSP is validated via the real-model benchmark instead).
- **Version bump 0.2.3 → 0.2.4** (package.json, tauri.conf.json, Cargo.toml, CLAUDE.md).
- **Build (DONE 2026-08-01):** Followed build-hygiene rules. Killed orphaned `backend` PIDs, deleted `backend/build/`+`dist/`, clean sidecar rebuild `py -3.11 -m PyInstaller build.spec --clean --noconfirm` → `dist/backend.exe` **375.8 MB** (exit 0). **Live-verified the frozen exe (not just build success):** started with real env → `/health` 200 after ~90 s cold start; then a real `POST /enhance` on a generated 3 s tone+hiss WAV completed `status=done`, output written, and measured HF-energy ratio dropped in→out (`scripts/smoke_enhance_frozen.py`) — proving `torchaudio.functional.treble_biquad` + numpy envelope smoothing execute inside the PyInstaller bundle (no collection gap). Copied `backend.exe` → BOTH `src-tauri/binaries/backend-x86_64-pc-windows-gnu.exe` AND `-msvc.exe` (358.4 MB each). Installer `npm run tauri build -- --target x86_64-pc-windows-gnu` (CARGO_TARGET_DIR=`D:\cargo_build\enhance-audio-pro`, exit 0, 2 known dead-code warnings) → **`Enhance Audio Pro_0.2.4_x64-setup.exe` 366.63 MB** at `...\x86_64-pc-windows-gnu\release\bundle\nsis\`, copied to `D:\tes\` for install/manual-listening test.
- Frontend untouched (no tsc run needed). Full details + before/after tables in `PLAN.md`. New harness scripts: `scripts/regen_enhanced_benchmark.py`, `scripts/smoke_enhance_frozen.py`.

# HF De-hiss Slider — Settings UI + Full IPC Wiring (2026-08-24)
Exposes the existing `EAP_HF_SHELF_DB` env-var control as a first-class UI slider in Settings → Enhancement, so users can tune HF hiss attenuation without needing environment variables or a rebuild.

- **`src/types/settings.ts`** — `hfDeHissDb?: number` added to `AppSettings` interface; default `−4` in `DEFAULT_SETTINGS`.
- **`src/stores/useSettingsStore.ts`** — `setHfDeHissDb` action added; field included in `partialize` (persisted to localStorage).
- **`src/lib/ipc.ts`** — `invokeProcessQueue` gains 4th param `hfDeHissDb = -4`; forwarded to Rust as `hfDeHissDb`.
- **`src-tauri/src/commands/process.rs`** — `hf_de_hiss_db: Option<f64>` added to `process_queue`; included in JSON payload to Python as `hf_shelf_db` (default `−4.0`).
- **`backend/routers/enhance.py`** — `EnhanceRequest.hf_shelf_db: float = -4.0` added; threaded through `_process_jobs` → `_sync_enhance` → `enhance_file(hf_shelf_db=...)`.
- **`backend/processors/enhance_speech.py`** — `enhance_file` gains `hf_shelf_db: Optional[float] = None`; `_apply_hf_shelf` gains `gain_db_override` param (per-call value takes precedence over `EAP_HF_SHELF_DB` env var); `_post_process` passes it through.
- **`src/components/SettingsPanel.tsx`** — Slider added in Enhancement section below Strength: range `−12` to `0` dB, step `0.5`, live dB readout, hint text. Calls `store.setHfDeHissDb(v)` + `save({ hfDeHissDb: v })`.
- **All 4 `invokeProcessQueue` call sites updated** (`QueueToolbar.tsx`, `QueueGrid.tsx` ×2, `useKeyboardShortcuts.ts`) to pass `hfDeHissDb ?? -4` from `useSettingsStore.getState()`.
- **Verification:** `tsc --noEmit` → 0 errors; **41/41 Pytest** passing.
- **Sidecar rebuilt (2026-08-24):** clean `py -3.11 -m PyInstaller build.spec --clean --noconfirm` → `dist/backend.exe` **358 MB** (exit 0, ~27 min build time on this machine). Copied to BOTH `backend-x86_64-pc-windows-gnu.exe` AND `-msvc.exe`.
- **Installer rebuilt (2026-08-24):** `npm run tauri build -- --target x86_64-pc-windows-gnu` (CARGO_TARGET_DIR=`D:\cargo_build\enhance-audio-pro`, Rust ~6 min, exit 0, 2 known dead-code warnings) → **`Enhance Audio Pro_0.2.4_x64-setup.exe` 366.6 MB** → copied to `D:\enhance audio\`.
- **GitHub:** commit `f24a7c5` pushed to `dimasrama12/enhance-audio-pro` master (20 files changed). README.md created and pushed (commit `c45ed58`). **GitHub Release v0.2.4** created at https://github.com/dimasrama12/enhance-audio-pro/releases/tag/v0.2.4 — installer uploaded as release asset (366.6 MB). Previous releases v0.2.3 and v0.2.0 untouched.

# README.md Created (2026-08-24)
- `README.md` added to project root — auto-displays on the GitHub repository page.
- Contents: project description, feature list, quality benchmark table (vs Adobe Podcast), installation instructions, tech stack table, build-from-source guide, project structure overview.
- Committed and pushed as commit `c45ed58`.

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
