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

# Test Coverage (final)
- 38/38 Vitest (frontend)
- 65/65 Pytest (backend)
- cargo check clean
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
