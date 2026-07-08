# Enhance Audio Pro — System Architecture Documentation

**Version:** v0.1.0  
**Date:** 2026-07-04  
**Status:** Feature-Complete, Active Distribution

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture Diagram](#2-high-level-architecture-diagram)
3. [Process Layer Breakdown](#3-process-layer-breakdown)
   - 3.1 [React Frontend](#31-react-frontend)
   - 3.2 [Tauri / Rust Core](#32-tauri--rust-core)
   - 3.3 [Python FastAPI Sidecar](#33-python-fastapi-sidecar)
4. [Data Flow](#4-data-flow)
   - 4.1 [File Import Flow](#41-file-import-flow)
   - 4.2 [Audio Enhancement Flow](#42-audio-enhancement-flow)
   - 4.3 [Video Extraction Flow](#43-video-extraction-flow)
   - 4.4 [Real-Time Progress Event Flow](#44-real-time-progress-event-flow)
5. [IPC Communication Design](#5-ipc-communication-design)
6. [Database Layer](#6-database-layer)
7. [State Management](#7-state-management)
8. [Key Module Reference](#8-key-module-reference)
9. [Build & Distribution Pipeline](#9-build--distribution-pipeline)
10. [Technology Stack Summary](#10-technology-stack-summary)

---

## 1. System Overview

Enhance Audio Pro is an **offline desktop application** built for Windows that provides AI-powered audio enhancement, audio/video conversion, stem separation, and audio manipulation — entirely without internet connectivity after initial model download.

The application is composed of **three cooperating processes**, each with a distinct responsibility:

| Process | Technology | Responsibility |
|---|---|---|
| **Frontend** | React + TypeScript | All user interface, state management, user interaction |
| **Core** | Tauri v2 + Rust | IPC bridge, SQLite queue database, sidecar lifecycle, event relay |
| **Sidecar** | Python FastAPI (PyInstaller .exe) | AI model inference, ffmpeg processing, audio/video manipulation |

These processes communicate through two channels:
- **Tauri `invoke`** — Frontend calls Rust commands synchronously (request/response)
- **HTTP (localhost)** — Rust calls Python for long-running jobs; Python pushes progress back to Rust via HTTP callbacks, which Rust re-emits as Tauri events to the frontend

---

## 2. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER DESKTOP (Windows)                       │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                  TAURI WEBVIEW WINDOW                         │  │
│  │                                                               │  │
│  │   ┌─────────────────────────────────────────────────────┐    │  │
│  │   │              REACT FRONTEND (TypeScript)            │    │  │
│  │   │                                                     │    │  │
│  │   │  TitleBar │ Sidebar │ DropZone │ QueueToolbar       │    │  │
│  │   │  QueueGrid │ WaveformPlayer │ ManipulationPanel     │    │  │
│  │   │  SettingsPanel │ HistoryPanel │ SetupWizard         │    │  │
│  │   │                                                     │    │  │
│  │   │  Zustand Stores: useQueueStore, useSettingsStore,   │    │  │
│  │   │                  useUIStore, useAudioPlayer         │    │  │
│  │   └──────────────────┬──────────────────▲──────────────┘    │  │
│  │                      │  invoke()         │  Tauri Events      │  │
│  │                      ▼                  │  queue://progress   │  │
│  │   ┌──────────────────────────────────────────────────────┐   │  │
│  │   │              TAURI / RUST CORE                       │   │  │
│  │   │                                                      │   │  │
│  │   │  Commands: add_files, process_queue, convert_files,  │   │  │
│  │   │            extract_video_audio, manipulate_audio,    │   │  │
│  │   │            get_settings, save_settings, …            │   │  │
│  │   │                                                      │   │  │
│  │   │  SQLite DB (app.db) ──── rusqlite ────────────────   │   │  │
│  │   │  Axum Callback Server (random port)                  │   │  │
│  │   │  Sidecar Manager (spawn + health poll)               │   │  │
│  │   └──────────────┬────────────────────▲─────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                     │  HTTP POST             │  HTTP POST          │
│                     │  (reqwest)             │  /callback/progress │
│                     ▼                        │                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              PYTHON FASTAPI SIDECAR (.exe)                   │  │
│  │                                                              │  │
│  │  Routers: /health, /enhance, /convert, /manipulate,         │  │
│  │           /extract_audio, /wizard, /eq, /merge, /loop       │  │
│  │                                                              │  │
│  │  Processors:                                                 │  │
│  │    enhance_speech.py  → DeepFilterNet3 (CUDA / CPU)         │  │
│  │    convert_audio.py   → ffmpeg (imageio_ffmpeg bundle)      │  │
│  │    manipulate_audio.py → ffmpeg (trim/speed/pitch/fade)     │  │
│  │    extract_audio.py   → ffmpeg (video demux + progress)     │  │
│  │    equalizer.py       → ffmpeg (11-band parametric EQ)      │  │
│  │    merge_audio.py     → ffmpeg (multi-file concat)          │  │
│  │                                                              │  │
│  │  Static Assets: imageio_ffmpeg (ffmpeg-win-x86_64-v7.1.exe) │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  LOCAL STORAGE                                               │  │
│  │  %APPDATA%\enhance-audio-pro\app.db       (SQLite queue)    │  │
│  │  %APPDATA%\enhance-audio-pro\settings.json (plugin-store)   │  │
│  │  %APPDATA%\enhance-audio-pro\enhance_audio.log (rotation)   │  │
│  │  D:\enhance-audio-pro-data\models\        (AI model weights)│  │
│  │  %TEMP%\enhance-audio-pro-cache\          (scratch/cache)   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Process Layer Breakdown

### 3.1 React Frontend

**Location:** `src/`  
**Language:** TypeScript (strict mode)  
**Framework:** React 18 (functional components, hooks)  
**Styling:** Tailwind CSS + Framer Motion  
**Bundler:** Vite

The frontend renders inside Tauri's embedded WebView and never communicates with any external server. All backend calls go through `tauri.invoke()` defined in `src/lib/ipc.ts`.

#### Component Tree

```
App.tsx
├── TitleBar.tsx          — frameless window chrome, drag region
├── Sidebar.tsx           — tab navigation (Audio / History / Help)
│   ├── HistoryPanel.tsx  — recently completed jobs, reveal-in-Explorer
│   └── HelpPanel.tsx     — built-in user guide
├── DropZone.tsx          — drag-and-drop + browse, file validation
├── QueueToolbar.tsx      — Enhance/Convert/Separate sub-tab pills, Record button
├── QueueStatusBar.tsx    — live job count pills (queued/processing/done/error)
├── QueueGrid.tsx         — main file queue table/card view
│   ├── SortableJobRow    — per-row: status badge, progress bar, action buttons
│   └── SortableJobCard   — grid-view card variant
├── ManipulationPanel.tsx — 8-tab audio editing panel (opens over QueueGrid)
│   └── EQPanel.tsx       — 11-band EQ, 18 presets
├── WaveformPlayer.tsx    — WaveSurfer waveform, zoom, J/K/L speed, A/B toggle
├── SetupWizard.tsx       — first-launch model download wizard
├── SettingsPanel.tsx     — modal: theme, language, output, shortcuts
├── KeyboardShortcutsPanel.tsx — rebindable shortcut editor
├── RecordButton.tsx      — in-app audio recording (MediaRecorder API)
├── ContextMenu.tsx       — right-click context actions on queue rows
└── ToastContainer.tsx    — bottom-right notification toasts
```

#### State Stores (Zustand)

| Store | File | Contents |
|---|---|---|
| `useQueueStore` | `stores/useQueueStore.ts` | Per-tab job queues (`tabQueues`), selection, lock, progress, filters, search, view mode, operation type per row |
| `useSettingsStore` | `stores/useSettingsStore.ts` | Theme, language, output folder, scratch disk, default format, keyboard shortcut bindings — persisted to `localStorage` |
| `useUIStore` | `stores/useUIStore.ts` | Active sub-tab, sidebar/settings visibility, import state, duplicate pending modal |
| `useAudioPlayer` | `stores/useAudioPlayer.ts` | Singleton HTML5 Audio player; enforces single-playback across all rows |
| `useToastStore` | `stores/useToastStore.ts` | Toast message queue with optional action buttons |

#### Key Library Files

| File | Purpose |
|---|---|
| `lib/ipc.ts` | One wrapper function per Tauri command. Single source of truth for all `invoke` call signatures. |
| `lib/importHelper.ts` | Orchestrates non-blocking background import: partitions audio vs video, spawns placeholder rows, resolves them as processing completes. |
| `lib/fileValidation.ts` | Extension whitelist check, file-size read, Windows `\\?\` verbatim prefix stripping. |
| `lib/audioPreload.ts` | Preloads audio blobs into memory before the waveform opens to eliminate loading delay. |
| `lib/errorLogger.ts` | Appends frontend errors to the Rust `append_error_log` command. |
| `hooks/useKeyboardShortcuts.ts` | Global keyboard event listener; reads bindings from `useSettingsStore`; dispatches store actions. |
| `i18n/index.ts` | i18next configuration; 17 language JSON bundles. |

---

### 3.2 Tauri / Rust Core

**Location:** `src-tauri/src/`  
**Language:** Rust (stable, `x86_64-pc-windows-gnu` toolchain locally; MSVC on CI)  
**Framework:** Tauri v2  
**Key crates:** `rusqlite`, `reqwest`, `axum`, `tokio`, `tauri-plugin-store`, `tauri-plugin-shell`, `tauri-plugin-dialog`

The Rust layer is the **security and coordination boundary**. It owns the database, manages the Python sidecar lifecycle, and is the sole process that makes outbound HTTP calls to Python.

#### Module Map

```
src-tauri/src/
├── main.rs                 — binary entry point; calls lib::run()
├── lib.rs                  — app setup, AppState, invoke_handler, CloseRequested handler
├── commands/
│   ├── mod.rs              — IpcResponse<T> shared envelope
│   ├── queue.rs            — add_files, get_queue, delete_job, set_destination,
│   │                         read_audio_file, show_item_in_folder, copy_enhanced_file
│   ├── process.rs          — process_queue, cancel_jobs (45-retry cold-start loop)
│   ├── convert.rs          — convert_files, set_output_format, set_bitrate, set_sample_rate
│   ├── manipulate.rs       — manipulate_audio, merge_audio, loop_audio, apply_eq,
│   │                         export_volume_adjusted_audio
│   ├── video.rs            — extract_video_audio (45-retry cold-start loop)
│   ├── settings.rs         — get_settings, save_settings, get/save_scratch_disk_dir
│   ├── download.rs         — start_model_download, check_model_status
│   └── record.rs           — save_recording (writes MediaRecorder bytes to disk)
├── db/
│   ├── mod.rs              — module declaration
│   ├── migrations.rs       — CREATE TABLE queue_jobs (idempotent migrations)
│   └── queue.rs            — insert_job, get_all_jobs, update_job_status (raw SQL)
├── sidecar/
│   └── manager.rs          — available_port() via TcpListener, spawn() with env vars,
│                             health poll loop (/health GET, up to 120 s)
└── callback/
    └── mod.rs              — Axum HTTP server; routes /callback/progress and
                              /callback/status; re-emits as Tauri events
```

#### AppState (shared across all commands)

```rust
pub struct AppState {
    pub db: Arc<Mutex<rusqlite::Connection>>,  // SQLite connection
    pub backend_port: u16,                      // Python sidecar port
    pub callback_port: u16,                     // Axum callback server port
    pub sidecar_child: Mutex<Option<CommandChild>>, // Handle to kill on close
    pub scratch_disk_dir: String,               // User-configured temp dir
}
```

#### IPC Response Envelope

Every command returns a uniform JSON structure, consumed by `src/types/ipc.ts`:

```rust
// Rust (commands/mod.rs)
pub struct IpcResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}
```

```typescript
// TypeScript (src/types/ipc.ts)
interface IpcResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}
```

#### Sidecar Lifecycle

1. On app start, `sidecar/manager.rs` binds a random TCP port and sets environment variables:
   - `BACKEND_PORT` — Python server port
   - `CALLBACK_PORT` — Axum callback server port
   - `MODELS_DIR` — AI model weights directory
   - `DATABASE_PATH` — SQLite file path
   - `SCRATCH_DISK_DIR` — user-configured cache location
   - `KMP_DUPLICATE_LIB_OK=TRUE` — suppress Intel MKL duplicate library warnings
2. Spawns `binaries/backend-x86_64-pc-windows-gnu.exe` via `tauri-plugin-shell`.
3. Polls `GET /health` up to 120 s (PyInstaller cold-start can take 35–60 s on first launch).
4. On `CloseRequested`: kills the child process → sleeps 150 ms → deletes cache → `process::exit(0)`.

---

### 3.3 Python FastAPI Sidecar

**Location:** `backend/`  
**Language:** Python 3.11  
**Framework:** FastAPI + Uvicorn  
**Distribution:** PyInstaller single-file `.exe` (≈ 359–376 MB including AI model code and static ffmpeg)  
**Key libraries:** `deepfilternet`, `demucs`, `torch`, `torchaudio`, `imageio-ffmpeg`, `httpx`, `uvicorn`

The sidecar runs as a local HTTP server. All endpoints are serialized via `asyncio.Lock` to prevent concurrent CUDA/GPU access causing OOM errors.

#### Router Map

| Router | Endpoint(s) | Processor |
|---|---|---|
| `health.py` | `GET /health` | — (returns `{"status":"ok"}`) |
| `enhance.py` | `POST /enhance` | `enhance_speech.py` → DeepFilterNet3 |
| `convert.py` | `POST /convert` | `convert_audio.py` → ffmpeg |
| `manipulate.py` | `POST /manipulate` | `manipulate_audio.py` → ffmpeg |
| `manipulate.py` | `POST /merge` | `merge_audio.py` → ffmpeg |
| `manipulate.py` | `POST /loop` | `manipulate_audio.py` → ffmpeg |
| `manipulate.py` | `POST /eq` | `equalizer.py` → ffmpeg |
| `manipulate.py` | `POST /export_volume` | `manipulate_audio.py` → ffmpeg |
| `video.py` | `POST /extract_audio` | `extract_audio.py` → ffmpeg |
| `wizard.py` | `GET /wizard/status`, `POST /wizard/download` | Hugging Face streaming download |
| `queue.py` | `POST /queue/process` | Legacy placeholder (501) |

#### Processor Details

**`enhance_speech.py`**
- Lazy-loads DeepFilterNet3 model weights from `MODELS_DIR` on first call (CUDA if available, CPU fallback).
- Non-native formats (MP3, AAC, M4A, OPUS, WMA) are converted to a temporary WAV via ffmpeg before enhancement, then re-encoded to the requested output format.
- Output written to `destination_folder`; intermediate temp files always cleaned up.

**`convert_audio.py`**
- Wraps `imageio_ffmpeg.get_ffmpeg_exe()` — uses the static ffmpeg binary bundled inside the PyInstaller package (`_MEIPASS/imageio_ffmpeg/binaries/`). Never depends on system ffmpeg.
- Supports 7 output formats: MP3, WAV, FLAC, AAC, OGG, OPUS, M4A.
- Applies bitrate and sample rate settings from the job row.

**`extract_audio.py`**
- Probes video duration via `ffmpeg -i` stderr parse to compute real progress percentages.
- Runs demux with `-progress pipe:1 -nostats` and streams `out_time_us` line-by-line to derive 1–99% progress, then emits 100 on `progress=end`.
- Sends each percentage to `{callback_url}/callback/progress` via `httpx` (best-effort; failures don't abort extraction).
- Output path uses collision-safe subdirectory: `<scratch>/enhance-audio-pro-cache/extracted/<hash8>/<exact_filename>`.

**`equalizer.py`**
- 11-band parametric EQ implemented as a chained ffmpeg `equalizer=` filter string.
- 18 built-in presets (Flat, Bass Boost, Vocal Clarity, etc.).

#### Progress Callback Flow

```
Python processor
    │
    │  httpx.post(f"{callback_url}/callback/progress", json={job_id, percent})
    ▼
Rust Axum callback server (random port)
    │
    │  app_handle.emit("queue://progress", {jobId, percent})
    ▼
React QueueGrid event listener
    │
    │  useQueueStore.setProgress(jobId, percent)
    ▼
Progress bar updates in real time (no polling)
```

---

## 4. Data Flow

### 4.1 File Import Flow

```
User drops files onto DropZone
        │
        ▼
fileValidation.ts
  - Strip \\?\ verbatim prefix (Windows drag-drop artifact)
  - Validate extension (audio: mp3/wav/flac/… | video: mp4/mov/mkv)
  - Detect duplicates → show modal if re-adding known files
        │
        ├── Audio files ──────────────────────────────────────────────►
        │                                                              │
        └── Video files → insert placeholder row (dimmed)             │
                         → Rust extract_video_audio                   │
                         → Python POST /extract_audio                 │
                         → real-time progress bar                     │
                         → extracted .mp3 path returned               │
                                                                       │
                                                                       ▼
                                                        Rust add_files command
                                                          - Validate paths
                                                          - INSERT INTO queue_jobs
                                                          - Return job rows
                                                                       │
                                                                       ▼
                                                        useQueueStore.resolvePlaceholder()
                                                          - Replace dimmed placeholder
                                                          - Row becomes interactive
```

### 4.2 Audio Enhancement Flow

```
User clicks "Enhance All" (QueueToolbar) or per-row Enhance button
        │
        ▼
QueueToolbar.handleProcess()
  - Mark all pending jobs → 'queued'
  - Dispatch first job → 'processing'
        │
        ▼
ipc.invokeProcessQueue(jobId)
        │
        ▼
Rust commands/process.rs::process_queue()
  - Fetch job from SQLite
  - POST /enhance { job_id, filepath, destination_folder, output_format }
  - Retry loop: up to 45 attempts × 2 s = 90 s window (cold-start safe)
  - 10-second per-request timeout via reqwest
        │
        ▼
Python routers/enhance.py
  - Acquire asyncio.Lock (serializes concurrent requests)
  - Send "processing" heartbeat callback
  - Call enhance_speech.py (DeepFilterNet3)
  - Stream progress callbacks 0–100%
  - Send "done" callback with output_filepath
        │
        ▼
Rust callback/mod.rs
  - Emit "queue://progress" events → QueueGrid updates progress bar
  - Emit "queue://status-change" { status:"done", outputFilepath } → row turns green
        │
        ▼
QueueGrid auto-advance listener
  - Find next 'queued' job → dispatch invokeProcessQueue(nextJob.id)
```

### 4.3 Video Extraction Flow

```
User drops .mp4 / .mov / .mkv file
        │
        ▼
importHelper.processImportItem()
  - Detect video → add dimmed placeholder row with temp id
  - Call ipc.invokeExtractVideoAudio(path, format, placeholderId)
        │
        ▼
Rust commands/video.rs::extract_video_audio()
  - POST /extract_audio { input_path, output_format, job_id, callback_url }
  - Retry loop: up to 45 attempts × 2 s (matches cold-start window)
        │
        ▼
Python routers/video.py + processors/extract_audio.py
  - Probe duration via ffmpeg stderr
  - ffmpeg -vn -map 0:a:0 -c:a libmp3lame with -progress pipe:1
  - Stream out_time_us → percent → POST callback_url/callback/progress
  - Write output to <scratch>/enhance-audio-pro-cache/extracted/<hash8>/<name>
        │
        ▼
importHelper receives { audio_path, base_name }
  - Call invokeAddFiles([audio_path]) → DB insert
  - Call useQueueStore.resolvePlaceholder() → row becomes live
```

### 4.4 Real-Time Progress Event Flow

```
Python sidecar
  httpx.post("http://127.0.0.1:{callbackPort}/callback/progress",
             json={"job_id": "...", "percent": 42})

        │
        ▼
Rust Axum server (callback/mod.rs)
  app_handle.emit("queue://progress", ProgressPayload { job_id, percent })

        │
        ▼
React (QueueGrid.tsx)
  listen("queue://progress", (e) => {
    useQueueStore.getState().setProgress(e.payload.jobId, e.payload.percent)
  })

        │
        ▼
SortableJobRow renders <progress value={job.progress} max={100} />
  — updates at ~60 fps, no polling
```

---

## 5. IPC Communication Design

### Command Invocation (Frontend → Rust)

```typescript
// src/lib/ipc.ts
import { invoke } from '@tauri-apps/api/core';

export async function invokeProcessQueue(jobId: string): Promise<IpcResponse<null>> {
  return invoke('process_queue', { jobId });
}
```

```rust
// src-tauri/src/commands/process.rs
#[tauri::command]
pub async fn process_queue(job_id: String, state: tauri::State<'_, AppState>)
    -> Result<IpcResponse<()>, String> { … }
```

### Tauri Event Subscription (Rust → Frontend)

```typescript
// QueueGrid.tsx
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  const unlisten = listen<ProgressPayload>('queue://progress', (e) => {
    setProgress(e.payload.jobId, e.payload.percent);
  });
  return () => { unlisten.then(f => f()); };
}, []);
```

### HTTP Callback (Python → Rust)

```python
# backend/routers/enhance.py
import httpx
httpx.post(
    f"http://127.0.0.1:{callback_port}/callback/progress",
    json={"job_id": job_id, "percent": pct},
    timeout=2.0
)
```

---

## 6. Database Layer

**Engine:** SQLite (via `rusqlite` in Rust)  
**Location:** `%APPDATA%\enhance-audio-pro\app.db`  
**Access:** Rust only. Python reads the DB path from `DATABASE_PATH` env var for reference, but all writes go through Rust commands.

### `queue_jobs` Table Schema

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PRIMARY KEY | UUID generated at import time |
| `filepath` | TEXT | Absolute path to the source file |
| `filename` | TEXT | Display name (basename) |
| `destination_folder` | TEXT | Output directory |
| `output_format` | TEXT | Target format (mp3, wav, flac, …) |
| `bitrate` | TEXT | e.g. "192k" |
| `sample_rate` | INTEGER | e.g. 44100 |
| `file_size` | INTEGER | Bytes |
| `status` | TEXT | pending / queued / processing / done / error / cancelled |
| `progress` | INTEGER | 0–100 |
| `output_filepath` | TEXT | Path to the processed output file |
| `error_message` | TEXT | Last error description |
| `created_at` | DATETIME | Import timestamp |
| `archived` | INTEGER | 0=active, 1=historical (history panel) |
| `media_type` | TEXT | "audio" or "video" |

### Startup Behavior

On every app launch, Rust runs:
```sql
UPDATE queue_jobs SET archived = 1 WHERE archived = 0
```
This ensures the queue starts empty each session (prior jobs move to History), while Ctrl+R page reloads are guarded by a `sessionStorage` flag on the frontend.

---

## 7. State Management

### Frontend State Hierarchy

```
Level 1 — Local (useState)
  Form inputs, UI toggles, animation state within a single component

Level 2 — Global (Zustand)
  useQueueStore    → file queue (per-tab isolation: enhance / convert / separate)
  useSettingsStore → persisted user preferences (localStorage via Zustand persist)
  useUIStore       → active tab, modal visibility, import state
  useAudioPlayer   → singleton audio playback (enforces one active player)
  useToastStore    → notification queue

Level 3 — Backend (Tauri Plugin Store)
  settings.json    → persisted to disk; merged with Zustand on startup
  scratch_disk.txt → scratch disk path written by save_scratch_disk_dir command
```

### Per-Tab Queue Isolation

`useQueueStore` organizes all job state under `tabQueues: Record<AudioSubTab, QueueJob[]>`, along with per-tab maps for: filters, search query, selected IDs, locked IDs, importing IDs, view mode (table/grid), group-by-format, and operation type. Switching tabs shows a completely independent queue with no cross-contamination.

---

## 8. Key Module Reference

### Frontend (`src/`)

| Module | Path | Description |
|---|---|---|
| App root | `App.tsx` | Init, layout, theme + i18n effects |
| IPC layer | `lib/ipc.ts` | All `invoke()` wrappers |
| Import logic | `lib/importHelper.ts` | Background import orchestration |
| File validation | `lib/fileValidation.ts` | Extension check, path normalization |
| Queue store | `stores/useQueueStore.ts` | Per-tab job state |
| Settings store | `stores/useSettingsStore.ts` | Persisted preferences |
| UI store | `stores/useUIStore.ts` | Transient UI state |
| Keyboard | `hooks/useKeyboardShortcuts.ts` | Global rebindable shortcuts |
| i18n | `i18n/index.ts` | 17-language localization |

### Rust (`src-tauri/src/`)

| Module | Path | Description |
|---|---|---|
| App setup | `lib.rs` | AppState, invoke handler, shutdown |
| Queue commands | `commands/queue.rs` | File import, DB CRUD |
| Process commands | `commands/process.rs` | Enhance dispatch + retry |
| Convert commands | `commands/convert.rs` | Conversion dispatch |
| Video commands | `commands/video.rs` | Video extraction dispatch |
| Manipulate commands | `commands/manipulate.rs` | Audio editing dispatch |
| Settings commands | `commands/settings.rs` | Settings persistence |
| DB migrations | `db/migrations.rs` | Schema creation |
| DB queue | `db/queue.rs` | SQL operations |
| Sidecar manager | `sidecar/manager.rs` | Spawn + health poll |
| Callback server | `callback/mod.rs` | Axum HTTP → Tauri events |

### Python (`backend/`)

| Module | Path | Description |
|---|---|---|
| App entry | `main.py` | FastAPI app, logging, router registration |
| Health | `routers/health.py` | Liveness check |
| Enhance router | `routers/enhance.py` | Lock + heartbeat + progress relay |
| Convert router | `routers/convert.py` | Lock + progress relay |
| Manipulate router | `routers/manipulate.py` | Audio editing endpoints |
| Video router | `routers/video.py` | Video extraction + progress relay |
| Wizard router | `routers/wizard.py` | Model download streaming |
| Enhance processor | `processors/enhance_speech.py` | DeepFilterNet3 inference |
| Convert processor | `processors/convert_audio.py` | ffmpeg format conversion |
| Manipulate processor | `processors/manipulate_audio.py` | ffmpeg audio editing |
| EQ processor | `processors/equalizer.py` | 11-band parametric EQ |
| Merge processor | `processors/merge_audio.py` | Multi-file concatenation |
| Video processor | `processors/extract_audio.py` | Video demux + progress stream |

---

## 9. Build & Distribution Pipeline

### Local Development Build

```powershell
# Set target dir to D: drive to avoid path-with-spaces linker bug
$env:CARGO_TARGET_DIR = 'D:\cargo_build\enhance-audio-pro'

# 1. Build Python sidecar (always with --clean to prevent stale rthooks)
cd backend
python -m PyInstaller build.spec --clean --noconfirm
# Output: backend/dist/backend.exe (~359–376 MB)

# 2. Copy sidecar to Tauri binaries directory
Copy-Item dist\backend.exe ..\src-tauri\binaries\backend-x86_64-pc-windows-gnu.exe

# 3. Build Tauri app (standalone exe, no installer)
npm run tauri build -- --no-bundle
# Output: D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe (~7.8 MB)

# 4. Build full NSIS installer (MUST use --target gnu; plain build bundles wrong sidecar)
npm run tauri build -- --target x86_64-pc-windows-gnu
# Output: D:\cargo_build\enhance-audio-pro\x86_64-pc-windows-gnu\release\bundle\nsis\
#         Enhance Audio Pro_0.1.0_x64-setup.exe (~367 MB with nsis.compression:none)
```

### CI/CD (GitHub Actions)

- Triggered on `v*` tags.
- Uses `stable-x86_64-pc-windows-msvc` toolchain (no MinGW dependency on CI).
- Installs Python dependencies, runs Pytest, builds PyInstaller sidecar, then `npm run tauri build`.
- Uploads `Enhance Audio Pro_*.exe` (NSIS installer) as a GitHub Release asset.

### Build Hygiene Rules

1. **Always delete `backend/build/`** before rebuilding the sidecar after any PyInstaller upgrade, or pass `--clean`. Stale `localpycs`/rthooks silently mix PyInstaller versions and produce a boot-crashing exe.
2. **Always use `--target x86_64-pc-windows-gnu`** for the local NSIS installer. Plain `npm run tauri build` selects the `msvc`-named binary (a stale 46 MB stub) and produces a ~49 MB installer missing the full backend.
3. **Always set `CARGO_TARGET_DIR`** before any `cargo` command. The workspace path contains spaces (`D:\vibe coding\…`), which the GNU linker treats as argument delimiters and fails.
4. **Kill `backend.exe` processes** before rebuilding. Windows file locks on the existing sidecar binary cause "Access is denied" during `tauri build`.

---

## 10. Technology Stack Summary

| Category | Technology | Version / Notes |
|---|---|---|
| Desktop framework | Tauri | v2 |
| Frontend language | TypeScript | Strict mode |
| Frontend framework | React | v18, functional components |
| UI styling | Tailwind CSS | + Framer Motion for animations |
| Component library | shadcn/ui | (selected components) |
| Waveform | WaveSurfer.js | Drag-to-seek, zoom, reversed playback |
| Global state | Zustand | Multiple isolated stores |
| Drag & drop (DnD) | @dnd-kit | Multi-item drag with placeholder preservation |
| Internationalization | i18next | 17 languages |
| Backend language | Rust | stable-x86_64-pc-windows-gnu (local) / MSVC (CI) |
| Rust async | Tokio | Multi-threaded runtime |
| Rust HTTP client | reqwest | Async, with timeout + retry |
| Rust HTTP server | Axum | Callback server (internal) |
| Database (Rust) | rusqlite | SQLite, direct SQL, no ORM |
| Settings store | tauri-plugin-store | JSON file persistence |
| AI language | Python | 3.11 |
| AI server | FastAPI + Uvicorn | Localhost only |
| Speech enhancement | DeepFilterNet3 | CUDA / CPU fallback |
| Stem separation | Demucs (htdemucs_ft) | CUDA / CPU fallback |
| Audio/video codec | ffmpeg | Static binary via imageio-ffmpeg v7.1 |
| Python distribution | PyInstaller | v6.20.0, single-file exe, ~360–376 MB |
| Build tool (frontend) | Vite | Dev server + production bundle |
| Package manager | npm | Do not mix with pnpm |
| Test framework (frontend) | Vitest | 38 tests |
| Test framework (backend) | Pytest | 67 tests |
| CI/CD | GitHub Actions | Release on `v*` tags → NSIS installer artifact |
| Installer | NSIS (via Tauri) | Uncompressed, ~367 MB (full sidecar payload) |
| OS target | Windows 10+ x64 | macOS planned for a later phase |

---

*Generated for report documentation purposes. Reflects the state of Enhance Audio Pro v0.1.0 as of 2026-07-04.*
