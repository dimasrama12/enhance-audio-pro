# Enhance Audio Pro — Architecture Design Spec
Date: 2026-05-20  
Status: Approved  
Phase: 1 (of 5)

---

## 1. System Overview

Three-process desktop app. Tauri (Rust) is the host process; it spawns a bundled PyInstaller sidecar on launch and owns the SQLite database. The React frontend communicates exclusively through Tauri `invoke` calls — never directly to Python.

```
React UI (Vite + TypeScript)
  ↕ Tauri invoke (IPC)
Tauri / Rust core
  ↕ reqwest HTTP (localhost:BACKEND_PORT)   ↕ rusqlite
Python FastAPI sidecar (.exe)               SQLite — %APPDATA%\enhance-audio-pro\app.db
  → emit Tauri events (queue://progress, queue://status-change)
```

**Target platform (Phase 1):** Windows only (.exe installer). macOS added in a later phase.

---

## 2. Frontend — React + TypeScript

**Build tooling:** Vite 5, TypeScript strict mode, Tailwind CSS v3, Framer Motion, lucide-react icons.

**State management:**
- `useQueueStore` (Zustand) — file list, per-job status, filter/search state
- `useSettingsStore` (Zustand) — theme, default output folder, language selection

**Routing:** No router needed for Phase 1. Active tab tracked in Zustand.

**Theme:** Tailwind `dark:` classes toggled via `<html class="dark">`. Persisted in `useSettingsStore` and synced to `tauri-plugin-store`.

**Component tree (Phase 1):**
```
App
├── SetupWizard          ← shown on first launch until models downloaded
├── TitleBar             ← custom draggable titlebar
├── Sidebar              ← tab navigation (Video | Audio)
├── MainContent
│   ├── DropZone         ← drag-and-drop file target
│   ├── QueueToolbar     ← filter dropdown, search bar, clear button
│   └── QueueGrid        ← data table (No | Filename | Destination | Size | Status)
└── SettingsPanel        ← slide-over panel
```

**IPC response contract (all Tauri commands):**
```ts
{ success: boolean; data: unknown | null; error: string | null }
```

---

## 3. Tauri / Rust Core

**Tauri version:** v2  
**Key plugins:** `tauri-plugin-shell` (sidecar), `tauri-plugin-store` (settings JSON), `tauri-plugin-dialog` (file picker)

**Sidecar lifecycle:**
1. App starts → Rust picks a random available port → stores as `BACKEND_PORT`
2. Spawns `backend.exe` via `tauri-plugin-shell` with `BACKEND_PORT` env var
3. Polls `GET /health` (up to 30 s, 500 ms interval) before showing main UI
4. On app exit → kills sidecar process

**SQLite setup:** On first launch, Rust runs migrations to create the `queue_jobs` table.

**Tauri commands exposed to frontend (Phase 1):**

| Command | Signature | Description |
|---|---|---|
| `add_files` | `(paths: string[]) → IpcResponse` | Validate files, insert rows into SQLite queue |
| `get_queue` | `() → IpcResponse<QueueJob[]>` | Return all queue rows |
| `get_settings` | `() → IpcResponse<AppSettings>` | Read from plugin-store |
| `save_settings` | `(settings: AppSettings) → IpcResponse` | Write to plugin-store |

**Tauri events emitted to frontend:**

| Event | Payload | Trigger |
|---|---|---|
| `queue://progress` | `{ jobId, percent }` | Python processing tick |
| `queue://status-change` | `{ jobId, status }` | Job state transition |

---

## 4. Python FastAPI Backend

**Runtime:** Python 3.11, FastAPI + Uvicorn  
**Distribution:** PyInstaller single-file `.exe` sidecar (bundled inside Tauri installer, ~150–300 MB)  
**Port:** Reads `BACKEND_PORT` env var at startup

**Phase 1 endpoints:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ status: "ok" }`. Rust polls this to confirm readiness. |
| `POST` | `/queue/process` | Placeholder — returns HTTP 501 until Phase 2 |

**Phase 2+ endpoints (not in scope now):**
- `POST /enhance` — DeepFilterNet speech enhancement
- `POST /separate` — Demucs stem separation

---

## 5. AI Model Setup Wizard

Shown on first app launch. Blocks access to main UI until complete.

**Flow:**
1. App opens → check `%APPDATA%\enhance-audio-pro\models\` for required model files
2. If missing → show Setup Wizard screen with model list + total download size
3. User clicks "Download & Set Up" → Python downloads models with progress events
4. Frontend shows per-model progress bars via `queue://progress` events
5. On completion → Wizard screen dismissed, main UI shown
6. Flag written to `tauri-plugin-store` so wizard never shows again

**Model storage:** `%APPDATA%\enhance-audio-pro\models\`  
**Models required at setup:** DeepFilterNet (noise removal), Demucs htdemucs (stem separation)

---

## 6. Data Layer

**Database file:** `%APPDATA%\enhance-audio-pro\app.db`  
**Rust access:** `rusqlite` crate (direct SQL, no ORM in Phase 1)  
**Python access:** Reads same DB file for job details during processing

**Phase 1 schema:**
```sql
CREATE TABLE IF NOT EXISTS queue_jobs (
  id          TEXT PRIMARY KEY,   -- UUID
  filename    TEXT NOT NULL,
  filepath    TEXT NOT NULL,
  destination TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL,
  media_type  TEXT NOT NULL,      -- 'audio' | 'video'
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
```

**Settings storage:** `tauri-plugin-store` writes to `%APPDATA%\enhance-audio-pro\settings.json`  
**Settings shape:**
```ts
interface AppSettings {
  theme: 'dark' | 'light';
  outputFolder: string;
  language: string;       // BCP-47 code e.g. 'en', 'id'
  setupComplete: boolean; // wizard flag
}
```

---

## 7. Phase 1 Deliverables Checklist

| # | Deliverable | Owner |
|---|---|---|
| 1 | App shell: titlebar, sidebar, tab layout (Video/Audio) | React |
| 2 | Dark/light mode toggle, persisted in settings | React + Tauri store |
| 3 | Setup Wizard UI + model download progress screen | React + Python |
| 4 | Drag-and-drop DropZone with file-type validation | React + Rust |
| 5 | `add_files` Tauri command + SQLite insert | Rust |
| 6 | Queue data grid: columns, filter, search bar | React + Zustand |
| 7 | Settings panel: theme, output folder, language (UI only) | React + Rust |
| 8 | Python FastAPI sidecar with `/health` endpoint | Python |
| 9 | Rust sidecar lifecycle (spawn, health poll, kill) | Rust |
| 10 | SQLite migration runner on first launch | Rust |

---

## 8. Out of Scope for Phase 1

- AI audio processing (Phase 2)
- Queue job execution / progress tracking (Phase 2–3)
- Audio editing tools: trim, EQ, pitch, speed (Phase 4)
- i18n / actual language switching (Phase 5)
- macOS build (later phase)
- Waveform/spectrogram visualization (later phase)

---

## 9. Error Handling

- All Tauri commands return `{ success, data, error }` — frontend always checks `success` before using `data`
- Python sidecar crash → Rust detects via health-poll timeout → emits `sidecar://error` event → frontend shows error toast
- File validation errors (unsupported format, unreadable path) → returned in `error` field, never thrown as exceptions

---

## 10. Testing Approach (Phase 1)

- **Frontend:** Vitest unit tests for Zustand store logic and utility functions
- **Rust:** `cargo test` for `add_files` validation logic and SQLite migration
- **Python:** Pytest for `/health` endpoint and FastAPI app startup
- **Integration:** Manual — drag files onto running dev build, verify queue rows appear

---

_Spec approved by user on 2026-05-20. Proceed to implementation plan._
