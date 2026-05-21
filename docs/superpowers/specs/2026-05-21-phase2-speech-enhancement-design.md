# Enhance Audio Pro — Phase 2 Design Spec
Date: 2026-05-21  
Status: Approved  
Phase: 2 (of 5)

---

## 1. Phase 2 Scope

Phase 2 wires DeepFilterNet3 speech enhancement end-to-end:

1. **Setup Wizard download wiring** — wizard downloads the DeepFilterNet3 model (~65 MB) on first launch with live progress
2. **Queue execution pipeline** — user clicks "Process" → Rust dispatches job to Python → DeepFilterNet processes file → output saved → real-time progress/status events update the UI
3. **Rust callback server** — second axum HTTP listener that bridges Python→Rust events into Tauri's event bus

Out of scope for Phase 2: Demucs stem separation, concurrent job processing, audio editing tools, macOS build.

---

## 2. Architecture

The Phase 1 three-process topology is unchanged. Phase 2 adds a callback server and processing pipeline on top of it.

```
React UI
  ↕  Tauri invoke (processQueue, startModelDownload)
Rust core  ←──────────────── POST /callback/{progress,status,wizard}
  ├─ reqwest → POST /enhance           Python FastAPI sidecar
  ├─ reqwest → POST /wizard/download     ├─ DeepFilterNet3 (CUDA → CPU fallback)
  └─ rusqlite ─ app.db                   └─ reads job rows from SQLite
```

**Two ports at startup:**
- `BACKEND_PORT` — existing Python FastAPI server (Phase 1)
- `CALLBACK_PORT` — new Rust axum callback server; passed to Python via env var

---

## 3. Rust Callback Server

**File:** `src-tauri/src/callback/mod.rs`

Axum server bound to `127.0.0.1:0` at app startup (OS assigns port). Registered in `lib.rs` alongside the existing sidecar lifecycle.

**POST handlers:**

| Path | Payload | Tauri event emitted |
|---|---|---|
| `/callback/progress` | `{ job_id, percent }` | `queue://progress { jobId, percent }` |
| `/callback/status` | `{ job_id, status }` | `queue://status-change { jobId, status }` |
| `/callback/wizard` | `{ type: "progress"\|"complete", percent? }` | `wizard://progress { percent }` or `wizard://complete {}` |

**State shared with main thread:** `AppHandle` cloned into each handler via axum `State<AppHandle>`.

**Startup order:**
1. Rust binds callback server → gets `CALLBACK_PORT`
2. Rust picks `BACKEND_PORT` (existing)
3. Rust spawns Python sidecar with both env vars
4. Rust polls `GET /health` before showing UI (existing)

---

## 4. Setup Wizard — Model Download Wiring

**Trigger:** `setupComplete = false` in plugin-store → `SetupWizard` component shown, main UI blocked.

**New Tauri command:** `start_model_download() → IpcResponse`
- Rust calls `POST /wizard/download { callback_url: "http://127.0.0.1:{CALLBACK_PORT}/callback/wizard" }` on Python
- Python returns HTTP 202 immediately; download runs as `BackgroundTask`

**Python download flow:**
1. `huggingface_hub.hf_hub_download` pulls `DeepFilterNet3` weights into `%APPDATA%\enhance-audio-pro\models\deepfilter\`
2. Custom `tqdm` callback fires every ~2% → POSTs `{ type: "progress", percent }` to `callback_url`
3. On completion → POSTs `{ type: "complete" }`

**Frontend (SetupWizard.tsx):**
- `useEffect` registers `listen("wizard://progress", ...)` and `listen("wizard://complete", ...)`
- Progress bar updates on each `wizard://progress` event
- On `wizard://complete`: calls `save_settings({ setupComplete: true })` → wizard dismissed, main UI shown

**Model storage:** `%APPDATA%\enhance-audio-pro\models\deepfilter\` — Python creates directory if missing.

---

## 5. Queue Execution Pipeline

**New Tauri command:** `process_queue(job_ids: Vec<String>) → IpcResponse`

**Per-job flow:**
1. Rust: UPDATE `status = 'processing'`, `updated_at = now` in SQLite
2. Rust: emit `queue://status-change { jobId, status: "processing" }` to React
3. Rust: `POST /enhance { job_id, input_path, output_path, callback_url }` → Python returns 202
4. Python `BackgroundTask`:
   - Reads job row from SQLite for path details
   - Calls `enhance_file(input_path, output_path, callback_fn)` (see Section 6)
   - `callback_fn` POSTs `{ type: "progress", job_id, percent }` every ~5% to `callback_url`
   - On success: POSTs `{ type: "complete", job_id }`
   - On exception: POSTs `{ type: "error", job_id, message }`
5. Rust callback handlers:
   - `progress` → emit `queue://progress { jobId, percent }`
   - `complete` → UPDATE SQLite `status = 'done'`, emit `queue://status-change { jobId, status: "done" }`
   - `error` → UPDATE SQLite `status = 'error'`, emit `queue://status-change { jobId, status: "error" }`

**Output file naming:** `{destination_folder}/{stem}_enhanced.{ext}` — original file is never modified.

**Concurrency:** Serial (one job at a time). Multiple concurrent jobs are Phase 3.

**Cancel:** Not in Phase 2 scope.

---

## 6. Python DeepFilterNet Module

**New file:** `backend/processors/enhance_speech.py`

**Model loading:** Called once at module import, cached as a module-level singleton.
```python
device = "cuda" if torch.cuda.is_available() else "cpu"
model, df_state, _ = init_df()   # deepfilternet package
```

**`enhance_file(input_path, output_path, progress_cb)`:**
1. Load audio: `torchaudio.load(input_path)` → resample to 48kHz (DeepFilterNet3 requirement)
2. Process in chunks (frame_size from `df_state`), call `progress_cb(percent)` every chunk
3. Save output: `torchaudio.save(output_path, enhanced, sample_rate)` at original sample rate

**New FastAPI endpoints (added to `backend/routers/`):**

| File | Method | Path | Description |
|---|---|---|---|
| `routers/enhance.py` | POST | `/enhance` | Accepts job params, dispatches BackgroundTask, returns 202 |
| `routers/wizard.py` | POST | `/wizard/download` | Dispatches model download BackgroundTask, returns 202 |

**New dependencies (added to `backend/requirements.txt`):**
```
deepfilternet>=0.5.6
torch>=2.0.0
torchaudio>=2.0.0
huggingface_hub>=0.20.0
httpx>=0.27.0   # for async callback POSTs
```

---

## 7. Frontend Changes

**`src/lib/ipc.ts`** — add two new wrappers:
```ts
processQueue(jobIds: string[]): Promise<IpcResponse>
startModelDownload(): Promise<IpcResponse>
```

**`src/stores/useQueueStore.ts`** — add actions:
```ts
setProgress(jobId: string, percent: number): void
setStatus(jobId: string, status: JobStatus): void
```

**`src/components/QueueGrid.tsx`** — add:
- Progress bar column (visible only when `status === 'processing'`)
- Subscribe to `queue://progress` and `queue://status-change` Tauri events in `useEffect`
- "Process Selected" button in `QueueToolbar` calling `processQueue`

**`src/components/SetupWizard.tsx`** — wire:
- `listen("wizard://progress", ...)` → updates `progressPercent` state
- `listen("wizard://complete", ...)` → calls `startModelDownload` resolution path

---

## 8. Data Layer Changes

No schema changes to `queue_jobs`. Two new columns added:

```sql
ALTER TABLE queue_jobs ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE queue_jobs ADD COLUMN error_message TEXT;
```

Migration runs on app start (Rust migration runner, Task 8 from Phase 1).

---

## 9. Testing

| Layer | File | What is tested |
|---|---|---|
| Python | `backend/tests/test_enhance_speech.py` | `enhance_file` calls progress_cb at intervals, writes output file |
| Python | `backend/tests/test_wizard_download.py` | Download mocked; progress callback fires; `complete` fires at end |
| Python | `backend/tests/test_enhance_endpoint.py` | `/enhance` returns 202, dispatches background task |
| Python | `backend/tests/test_wizard_endpoint.py` | `/wizard/download` returns 202 |
| Rust | `src-tauri/src/callback/mod.rs` (unit) | Callback handlers parse payloads, emit correct event names |
| Vitest | `src/stores/__tests__/useQueueStore.test.ts` | `setProgress`, `setStatus` update state correctly |
| Vitest | `src/components/__tests__/SetupWizard.test.ts` | Progress bar renders at correct % from mock events |

---

## 10. Deliverables Checklist

| # | Deliverable | Owner |
|---|---|---|
| 1 | Rust callback server (axum, `callback/mod.rs`) | Rust |
| 2 | `CALLBACK_PORT` env var wired into sidecar spawn | Rust |
| 3 | `process_queue` Tauri command | Rust |
| 4 | `start_model_download` Tauri command | Rust |
| 5 | SQLite migration: add `progress`, `error_message` columns | Rust |
| 6 | Python `enhance_speech.py` (DeepFilterNet3, CUDA→CPU) | Python |
| 7 | Python `routers/enhance.py` endpoint | Python |
| 8 | Python `routers/wizard.py` endpoint + HuggingFace download | Python |
| 9 | `requirements.txt` updated (deepfilternet, torch, torchaudio, httpx) | Python |
| 10 | Zustand store actions `setProgress`, `setStatus` | React |
| 11 | `QueueGrid` progress bar column + event subscriptions | React |
| 12 | `SetupWizard` wizard event wiring | React |
| 13 | All Pytest + Vitest tests passing | All |

---

## 11. Error Handling

- Python sidecar crash during processing → existing `sidecar://error` event (Phase 1) shows error toast
- DeepFilterNet load failure (model missing) → Python returns HTTP 503 with `{ error: "model_not_ready" }` → Rust returns `IpcResponse { success: false, error: "Model not loaded. Run Setup Wizard first." }`
- Individual job error → status set to `error` in SQLite; `error_message` column written; UI shows red status badge
- Download failure in wizard → `wizard://error { message }` event → wizard shows retry button

---

_Spec approved 2026-05-21. Proceed to implementation plan._
