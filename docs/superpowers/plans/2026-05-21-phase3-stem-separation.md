# Phase 3 — Stem Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Separate Stems" button to the queue that sends pending jobs to a new Python `/separate` endpoint, which uses Demucs `htdemucs_ft` to split each audio file into vocals, drums, bass, and other `.wav` files, reporting real-time progress via the existing Rust callback server.

**Architecture:** Mirrors Phase 2 exactly — Rust `separate_stems` command marks jobs processing and fire-and-forgets `POST /separate` to Python. Python `BackgroundTask` calls `separate_file()`, posting progress and final status to `http://127.0.0.1:{callback_port}/callback/progress` and `/callback/status`. The existing Rust callback server and frontend event listeners need zero changes.

**Tech Stack:** Python `demucs>=4.0.0`, `torchaudio`, `torch` (CUDA/CPU), FastAPI BackgroundTasks, httpx, Rust/Tauri v2 (reqwest, existing AppState), React/TypeScript (lucide-react Scissors icon)

---

## File Map

**New files — Python**
- `backend/processors/separate_stems.py` — lazy `htdemucs_ft` loader + `separate_file()`
- `backend/routers/separate.py` — `POST /separate` endpoint
- `backend/tests/test_separate_stems.py` — 4 unit tests (TDD)
- `backend/tests/test_separate_endpoint.py` — 3 endpoint tests (TDD)

**Modified files — Python**
- `backend/tests/conftest.py` — add Demucs mocks + fix torchaudio.load return value
- `backend/requirements.txt` — add `demucs>=4.0.0`
- `backend/main.py` — include separate router

**New files — Rust**
- `src-tauri/src/commands/separate.rs` — `separate_stems` Tauri command

**Modified files — Rust**
- `src-tauri/src/commands/mod.rs` — add `pub mod separate`
- `src-tauri/src/lib.rs` — import + register `separate_stems`

**Modified files — Frontend**
- `src/lib/ipc.ts` — add `invokeSeparateStems`
- `src/components/QueueToolbar.tsx` — add Separate Stems button, rename Process → Enhance

---

## Task 1: Python — Update conftest.py with Demucs mocks

**Files:**
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Replace conftest.py with the full updated version**

Replace `backend/tests/conftest.py`:

```python
"""
Session-wide mocks for torch, torchaudio, deepfilternet, and demucs.
These packages are large and not installed in the dev/CI test environment.
Individual tests can override specific mock behaviour via patch.dict(sys.modules, ...).
"""
import sys
from unittest.mock import MagicMock

# --- DeepFilterNet mocks ---
_mock_df_state = MagicMock()
_mock_df_state.sr.return_value = 48000

_mock_df_model = MagicMock()
_mock_df_model.to.return_value = _mock_df_model

_mock_df_enhance = MagicMock()
_mock_df_enhance.init_df.return_value = (_mock_df_model, _mock_df_state, None)
_mock_df_enhance.load_audio.return_value = (MagicMock(), 48000)
_mock_df_enhance.enhance.return_value = MagicMock()
_mock_df_enhance.save_audio = MagicMock()

_mock_torch = MagicMock()
_mock_torch.cuda.is_available.return_value = False

# torchaudio.load must return a 2-tuple (wav_tensor, sample_rate)
_mock_torchaudio = MagicMock()
_mock_torchaudio.load.return_value = (MagicMock(), 44100)

# --- Demucs mocks ---
_mock_demucs_stem = MagicMock()
_mock_demucs_stem.cpu.return_value = _mock_demucs_stem

_mock_demucs_sources = MagicMock()
_mock_demucs_sources.__getitem__ = lambda self, i: _mock_demucs_stem

_mock_demucs_model = MagicMock()
_mock_demucs_model.sources = ["vocals", "drums", "bass", "other"]
_mock_demucs_model.samplerate = 44100
_mock_demucs_model.audio_channels = 2
_mock_demucs_model.to.return_value = _mock_demucs_model

_mock_demucs_pretrained = MagicMock()
_mock_demucs_pretrained.get_model.return_value = _mock_demucs_model

_mock_demucs_apply = MagicMock()
_mock_demucs_apply.apply_model.return_value = [_mock_demucs_sources]

_mock_demucs_audio = MagicMock()
_mock_demucs_audio.convert_audio.return_value = MagicMock()

for _mod, _mock in [
    ("torch", _mock_torch),
    ("torchaudio", _mock_torchaudio),
    ("df", MagicMock(enhance=_mock_df_enhance)),
    ("df.enhance", _mock_df_enhance),
    ("demucs", MagicMock()),
    ("demucs.pretrained", _mock_demucs_pretrained),
    ("demucs.apply", _mock_demucs_apply),
    ("demucs.audio", _mock_demucs_audio),
]:
    sys.modules.setdefault(_mod, _mock)
```

- [ ] **Step 2: Verify existing tests still pass with updated conftest**

```powershell
cd "D:\vibe coding\app enhance audio pro\backend"
& ".venv\Scripts\python.exe" -m pytest tests/test_health.py tests/test_enhance_speech.py tests/test_enhance_endpoint.py tests/test_wizard_endpoint.py -v 2>&1 | Select-Object -Last 15
```

Expected: 11 passed, 0 failed.

- [ ] **Step 3: Commit**

```powershell
cd "D:\vibe coding\app enhance audio pro"
git add backend/tests/conftest.py
git commit -m "chore: extend conftest with Demucs mocks and explicit torchaudio.load return value"
```

---

## Task 2: Python — separate_stems processor (TDD)

**Files:**
- Create: `backend/processors/separate_stems.py`
- Create: `backend/tests/test_separate_stems.py`

- [ ] **Step 1: Write failing tests first**

Create `backend/tests/test_separate_stems.py`:

```python
import sys
import pytest


@pytest.fixture(autouse=True)
def reset_model_cache():
    """Clear module-level model cache between tests."""
    mod = sys.modules.get("processors.separate_stems")
    if mod:
        mod._model = None
    yield
    mod = sys.modules.get("processors.separate_stems")
    if mod:
        mod._model = None


def test_progress_callbacks_are_called_in_order(tmp_path):
    """separate_file calls progress_cb at increasing values ending at 100."""
    from processors.separate_stems import separate_file

    calls = []
    separate_file("/fake/in.wav", str(tmp_path), calls.append)

    assert calls[-1] == 100
    assert calls == sorted(calls), "progress must be monotonically increasing"


def test_progress_includes_start_and_end_milestones(tmp_path):
    """progress_cb is called at 10 and 100 at minimum."""
    from processors.separate_stems import separate_file

    calls = []
    separate_file("/fake/in.wav", str(tmp_path), calls.append)

    assert 10 in calls
    assert 100 in calls


def test_torchaudio_save_called_for_each_stem(tmp_path):
    """torchaudio.save is called once per stem — 4 times for htdemucs_ft."""
    from processors.separate_stems import separate_file

    sys.modules["torchaudio"].save.reset_mock()
    separate_file("/fake/in.wav", str(tmp_path), lambda _: None)

    assert sys.modules["torchaudio"].save.call_count == 4


def test_model_is_loaded_lazily_not_at_import():
    """Importing the module does NOT call get_model; only separate_file does."""
    sys.modules.pop("processors.separate_stems", None)
    get_model_mock = sys.modules["demucs.pretrained"].get_model
    get_model_mock.reset_mock()

    import processors.separate_stems  # noqa: F401

    get_model_mock.assert_not_called()
```

- [ ] **Step 2: Run tests — expect FAIL (module does not exist)**

```powershell
cd "D:\vibe coding\app enhance audio pro\backend"
& ".venv\Scripts\python.exe" -m pytest tests/test_separate_stems.py -v 2>&1 | Select-Object -Last 10
```

Expected: `ModuleNotFoundError: No module named 'processors.separate_stems'`

- [ ] **Step 3: Create separate_stems.py**

Create `backend/processors/separate_stems.py`:

```python
import os
import pathlib
from typing import Callable

_model = None


def _get_device() -> str:
    import torch
    return "cuda" if torch.cuda.is_available() else "cpu"


def _load_model():
    global _model
    if _model is not None:
        return _model

    from demucs.pretrained import get_model

    appdata = os.environ.get("APPDATA", str(pathlib.Path.home()))
    torch_home = pathlib.Path(appdata) / "enhance-audio-pro" / "models" / "torch"
    os.environ.setdefault("TORCH_HOME", str(torch_home))

    _model = get_model("htdemucs_ft")
    _model = _model.to(_get_device())
    return _model


def separate_file(
    input_path: str,
    output_dir: str,
    progress_cb: Callable[[int], None],
) -> None:
    """Separate input_path into stems (vocals, drums, bass, other) in output_dir."""
    import torch
    import torchaudio
    from demucs.apply import apply_model
    from demucs.audio import convert_audio

    model = _load_model()
    device = _get_device()

    progress_cb(10)
    wav, sr = torchaudio.load(input_path)
    wav = convert_audio(wav, sr, model.samplerate, model.audio_channels)
    wav = wav.unsqueeze(0).to(device)

    progress_cb(30)
    with torch.no_grad():
        sources = apply_model(model, wav, device=device)[0]

    progress_cb(90)
    out = pathlib.Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    stem_name = pathlib.Path(input_path).stem

    for i, stem in enumerate(model.sources):
        stem_path = out / f"{stem}_{stem_name}.wav"
        torchaudio.save(str(stem_path), sources[i].cpu(), model.samplerate)

    progress_cb(100)
```

- [ ] **Step 4: Run tests — expect PASS**

```powershell
& ".venv\Scripts\python.exe" -m pytest tests/test_separate_stems.py -v
```

Expected:
```
PASSED tests/test_separate_stems.py::test_progress_callbacks_are_called_in_order
PASSED tests/test_separate_stems.py::test_progress_includes_start_and_end_milestones
PASSED tests/test_separate_stems.py::test_torchaudio_save_called_for_each_stem
PASSED tests/test_separate_stems.py::test_model_is_loaded_lazily_not_at_import
4 passed
```

- [ ] **Step 5: Commit**

```powershell
cd "D:\vibe coding\app enhance audio pro"
git add backend/processors/separate_stems.py backend/tests/test_separate_stems.py
git commit -m "feat: add Demucs stem separation processor with lazy model loading (4 tests)"
```

---

## Task 3: Python — separate router + endpoint tests (TDD)

**Files:**
- Create: `backend/routers/separate.py`
- Create: `backend/tests/test_separate_endpoint.py`

- [ ] **Step 1: Write failing endpoint tests**

Create `backend/tests/test_separate_endpoint.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport


async def test_separate_returns_202():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/separate", json={
            "job_ids": ["test-job-1"],
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.status_code == 202


async def test_separate_returns_processing_started_detail():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/separate", json={
            "job_ids": ["test-job-1"],
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.json()["detail"] == "Processing started."


async def test_separate_with_empty_job_ids_returns_202():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/separate", json={
            "job_ids": [],
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.status_code == 202
```

- [ ] **Step 2: Run tests — expect FAIL (404)**

```powershell
cd "D:\vibe coding\app enhance audio pro\backend"
& ".venv\Scripts\python.exe" -m pytest tests/test_separate_endpoint.py -v 2>&1 | Select-Object -Last 8
```

Expected: Tests fail with 404 — route `/separate` not yet registered.

- [ ] **Step 3: Create routers/separate.py**

Create `backend/routers/separate.py`:

```python
import asyncio
import os
import pathlib
import sqlite3
from typing import List

import httpx
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from processors.separate_stems import separate_file

router = APIRouter()


class SeparateRequest(BaseModel):
    job_ids: List[str]
    callback_url: str


@router.post("/separate")
async def separate_jobs(
    req: SeparateRequest, background_tasks: BackgroundTasks
) -> JSONResponse:
    if req.job_ids:
        background_tasks.add_task(_process_jobs, req.job_ids, req.callback_url)
    return JSONResponse(status_code=202, content={"detail": "Processing started."})


async def _process_jobs(job_ids: List[str], callback_url: str) -> None:
    loop = asyncio.get_event_loop()

    appdata = os.environ.get("APPDATA", str(pathlib.Path.home()))
    db_path = pathlib.Path(appdata) / "enhance-audio-pro" / "app.db"

    for job_id in job_ids:
        try:
            conn = sqlite3.connect(str(db_path))
            row = conn.execute(
                "SELECT filepath, destination, filename FROM queue_jobs WHERE id = ?",
                (job_id,),
            ).fetchone()
            conn.close()

            if row is None:
                continue

            filepath, destination, filename = row
            stem_name = pathlib.Path(filename).stem
            out_dir = (
                pathlib.Path(destination)
                if destination
                else pathlib.Path(filepath).parent / f"{stem_name}_stems"
            )

            def _sync_separate(out: str) -> None:
                def _progress(pct: int) -> None:
                    httpx.post(
                        f"{callback_url}/callback/progress",
                        json={"job_id": job_id, "percent": pct},
                        timeout=5,
                    )
                separate_file(filepath, out, _progress)

            await loop.run_in_executor(None, lambda: _sync_separate(str(out_dir)))

            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(
                    f"{callback_url}/callback/status",
                    json={"job_id": job_id, "status": "done"},
                )

        except Exception as exc:
            try:
                async with httpx.AsyncClient(timeout=5) as client:
                    await client.post(
                        f"{callback_url}/callback/status",
                        json={
                            "job_id": job_id,
                            "status": "error",
                            "error_message": str(exc),
                        },
                    )
            except Exception:
                pass
```

- [ ] **Step 4: Register router in main.py**

Replace `backend/main.py`:

```python
import os
import uvicorn
from fastapi import FastAPI
from routers import enhance, health, queue, separate, wizard

app = FastAPI(title="Enhance Audio Pro Backend", version="0.1.0")
app.include_router(health.router)
app.include_router(queue.router)
app.include_router(enhance.router)
app.include_router(wizard.router)
app.include_router(separate.router)

if __name__ == "__main__":
    port = int(os.environ.get("BACKEND_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
```

- [ ] **Step 5: Run endpoint tests — expect PASS**

```powershell
& ".venv\Scripts\python.exe" -m pytest tests/test_separate_endpoint.py -v
```

Expected:
```
PASSED tests/test_separate_endpoint.py::test_separate_returns_202
PASSED tests/test_separate_endpoint.py::test_separate_returns_processing_started_detail
PASSED tests/test_separate_endpoint.py::test_separate_with_empty_job_ids_returns_202
3 passed
```

- [ ] **Step 6: Run full Python suite — expect 18 passed**

```powershell
& ".venv\Scripts\python.exe" -m pytest tests/ -v 2>&1 | Select-Object -Last 25
```

Expected: 18 passed (11 prior + 4 processor + 3 endpoint), 0 failed.

- [ ] **Step 7: Update requirements.txt**

Replace `backend/requirements.txt`:

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
deepfilternet>=0.5.6
torch>=2.0.0
torchaudio>=2.0.0
httpx>=0.27.0
demucs>=4.0.0
```

- [ ] **Step 8: Commit**

```powershell
cd "D:\vibe coding\app enhance audio pro"
git add backend/routers/separate.py backend/tests/test_separate_endpoint.py backend/main.py backend/requirements.txt
git commit -m "feat: add /separate endpoint and Demucs to requirements (18 pytest passing)"
```

---

## Task 4: Rust — commands/separate.rs + mod.rs + lib.rs

**Files:**
- Create: `src-tauri/src/commands/separate.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create commands/separate.rs**

Create `src-tauri/src/commands/separate.rs`:

```rust
use serde_json::json;
use tauri::{AppHandle, Emitter, State};

use crate::commands::IpcResponse;
use crate::db::queue as db_queue;
use crate::AppState;

#[tauri::command]
pub async fn separate_stems(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    job_ids: Vec<String>,
) -> IpcResponse<()> {
    if job_ids.is_empty() {
        return IpcResponse {
            success: true,
            data: Some(()),
            error: None,
        };
    }

    let backend_port = state.backend_port;
    let callback_port = state.callback_port;

    let updated_ids: Vec<String> = {
        let conn = match state.db.lock() {
            Ok(c) => c,
            Err(e) => {
                return IpcResponse {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                }
            }
        };

        job_ids
            .iter()
            .filter(|id| db_queue::update_job_status(&conn, id, "processing").is_ok())
            .cloned()
            .collect()
    };

    for id in &updated_ids {
        let _ = app_handle.emit(
            "queue://status-change",
            json!({ "jobId": id, "status": "processing" }),
        );
    }

    let payload = json!({
        "job_ids": updated_ids,
        "callback_url": format!("http://127.0.0.1:{}", callback_port),
    });

    tauri::async_runtime::spawn(async move {
        let url = format!("http://127.0.0.1:{}/separate", backend_port);
        let _ = reqwest::Client::new().post(&url).json(&payload).send().await;
    });

    IpcResponse {
        success: true,
        data: Some(()),
        error: None,
    }
}
```

- [ ] **Step 2: Update commands/mod.rs**

Replace `src-tauri/src/commands/mod.rs`:

```rust
pub mod download;
pub mod process;
pub mod queue;
pub mod separate;
pub mod settings;

use serde::Serialize;

#[derive(Serialize)]
pub struct IpcResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}
```

- [ ] **Step 3: Update lib.rs**

Replace `src-tauri/src/lib.rs`:

```rust
use std::sync::{Arc, Mutex};
use tauri::Manager;

mod callback;
mod commands;
mod db;
mod sidecar;

use commands::download::start_model_download;
use commands::process::process_queue;
use commands::queue::{add_files, get_queue};
use commands::separate::separate_stems;
use commands::settings::{get_settings, save_settings};

pub struct AppState {
    pub db: Arc<Mutex<rusqlite::Connection>>,
    pub backend_port: u16,
    pub callback_port: u16,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;

            let db_path = data_dir.join("app.db");
            let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;
            db::migrations::run_migrations(&conn).map_err(|e| e.to_string())?;
            let db = Arc::new(Mutex::new(conn));

            let cb_listener = std::net::TcpListener::bind("127.0.0.1:0")
                .map_err(|e| e.to_string())?;
            cb_listener.set_nonblocking(true).map_err(|e| e.to_string())?;
            let callback_port = cb_listener.local_addr().unwrap().port();

            let cb_state = callback::CallbackState {
                app: app.handle().clone(),
                db: db.clone(),
            };
            tauri::async_runtime::spawn(async move {
                let listener = tokio::net::TcpListener::from_std(cb_listener).unwrap();
                let router = callback::build_router(cb_state);
                axum::serve(listener, router).await.unwrap();
            });

            let backend_port = sidecar::manager::available_port();
            sidecar::manager::spawn(app.handle(), backend_port, callback_port)?;

            app.manage(AppState {
                db,
                backend_port,
                callback_port,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            add_files,
            get_queue,
            get_settings,
            save_settings,
            process_queue,
            start_model_download,
            separate_stems,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: cargo check — must pass clean**

```powershell
cd "D:\vibe coding\app enhance audio pro\src-tauri"
$env:CARGO_TARGET_DIR = "D:\cargo_build\enhance-audio-pro"
cargo check 2>&1 | Select-Object -Last 10
```

Expected: `Finished` with no errors. Warnings acceptable.

- [ ] **Step 5: Commit**

```powershell
cd "D:\vibe coding\app enhance audio pro"
git add src-tauri/src/commands/separate.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add separate_stems Tauri command wired to /separate Python endpoint"
```

---

## Task 5: Frontend — ipc.ts + QueueToolbar

**Files:**
- Modify: `src/lib/ipc.ts`
- Modify: `src/components/QueueToolbar.tsx`

- [ ] **Step 1: Add invokeSeparateStems to ipc.ts**

Replace `src/lib/ipc.ts`:

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { IpcResponse } from '@/types/ipc';
import type { QueueJob } from '@/types/queue';
import type { AppSettings } from '@/types/settings';

export async function invokeAddFiles(paths: string[]): Promise<IpcResponse<QueueJob[]>> {
  return invoke<IpcResponse<QueueJob[]>>('add_files', { paths });
}

export async function invokeGetQueue(): Promise<IpcResponse<QueueJob[]>> {
  return invoke<IpcResponse<QueueJob[]>>('get_queue');
}

export async function invokeGetSettings(): Promise<IpcResponse<AppSettings>> {
  return invoke<IpcResponse<AppSettings>>('get_settings');
}

export async function invokeSaveSettings(settings: AppSettings): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('save_settings', { settings });
}

export async function invokeProcessQueue(jobIds: string[]): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('process_queue', { jobIds });
}

export async function invokeStartModelDownload(): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('start_model_download');
}

export async function invokeSeparateStems(jobIds: string[]): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('separate_stems', { jobIds });
}
```

- [ ] **Step 2: Replace QueueToolbar.tsx with Separate Stems button**

Replace `src/components/QueueToolbar.tsx`:

```typescript
import { useState } from 'react';
import { Play, Scissors, Search, Trash2 } from 'lucide-react';
import { useQueueStore } from '@/stores/useQueueStore';
import { invokeProcessQueue, invokeSeparateStems } from '@/lib/ipc';

const FILTERS = [
  { value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' }, { value: 'done', label: 'Done' },
  { value: 'error', label: 'Error' },
];

export default function QueueToolbar(): JSX.Element {
  const { filter, searchQuery, setFilter, setSearchQuery, clearQueue, jobs } = useQueueStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSeparating, setIsSeparating] = useState(false);

  const pendingIds = jobs.filter((j) => j.status === 'pending').map((j) => j.id);
  const busy = isProcessing || isSeparating;
  const canAct = pendingIds.length > 0 && !busy;

  async function handleProcess(): Promise<void> {
    if (!canAct) return;
    setIsProcessing(true);
    try {
      await invokeProcessQueue(pendingIds);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleSeparate(): Promise<void> {
    if (!canAct) return;
    setIsSeparating(true);
    try {
      await invokeSeparateStems(pendingIds);
    } finally {
      setIsSeparating(false);
    }
  }

  return (
    <div className="flex items-center gap-3 shrink-0">
      <div className="relative flex-1">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 bg-white/10 rounded-lg text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-violet-500 transition"
        />
      </div>
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="bg-white/10 text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-violet-500 transition"
      >
        {FILTERS.map((f) => (
          <option key={f.value} value={f.value} className="bg-neutral-800">{f.label}</option>
        ))}
      </select>
      <button
        onClick={handleProcess}
        disabled={!canAct}
        title="Enhance speech for pending files"
        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white"
      >
        <Play size={14} />
        {isProcessing ? 'Enhancing…' : 'Enhance'}
      </button>
      <button
        onClick={handleSeparate}
        disabled={!canAct}
        title="Separate stems for pending files"
        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white"
      >
        <Scissors size={14} />
        {isSeparating ? 'Separating…' : 'Separate Stems'}
      </button>
      <button
        onClick={clearQueue}
        title="Clear queue"
        className="p-2 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-colors"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Run frontend tests — expect 19 passing (no regressions)**

```powershell
cd "D:\vibe coding\app enhance audio pro"
npm test 2>&1 | Select-Object -Last 10
```

Expected: 19 passed, 0 failed.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/ipc.ts src/components/QueueToolbar.tsx
git commit -m "feat: add invokeSeparateStems IPC wrapper and Separate Stems button in QueueToolbar"
```

---

## Task 6: Integration — full test suite + CLAUDE.md + PRD update + push

**Files:**
- Modify: `CLAUDE.md`
- Modify: `PRD_Enhance_Audio_Pro.txt`

- [ ] **Step 1: Run full Python suite**

```powershell
cd "D:\vibe coding\app enhance audio pro\backend"
& ".venv\Scripts\python.exe" -m pytest tests/ -v 2>&1 | Select-Object -Last 25
```

Expected: 18 passed, 0 failed.

- [ ] **Step 2: Run full frontend suite**

```powershell
cd "D:\vibe coding\app enhance audio pro"
npm test 2>&1 | Select-Object -Last 10
```

Expected: 19 passed, 0 failed.

- [ ] **Step 3: Final cargo check**

```powershell
cd "D:\vibe coding\app enhance audio pro\src-tauri"
$env:CARGO_TARGET_DIR = "D:\cargo_build\enhance-audio-pro"
cargo check 2>&1 | Select-Object -Last 5
```

Expected: `Finished` with no errors.

- [ ] **Step 4: Update CLAUDE.md section 13 — add Phase 3 completion**

In `CLAUDE.md`, replace the `## Phase 3 (next)` block under "Not Started" with a new completed section and updated pending list:

Find and replace this block:
```
## Phase 3 (next)
- [ ] Stem Separation backend — Demucs integration (vocals, drums, bass, other) with CUDA/CPU fallback
- [ ] PyInstaller build + Tauri installer packaging (.exe for Windows)
- [ ] File format conversion pipeline (300+ formats via ffmpeg)
- [ ] Batch processing limits enforcement (30 audio / 10 video simultaneous)
- [ ] Output format selector per file + global batch format override
```

With:
```
# Phase 3 — Completed Tasks (2026-05-21)
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
- [x] Rust: commands/separate.rs — separate_stems Tauri command, fire-and-forget to /separate
- [x] Rust: commands/mod.rs — pub mod separate added
- [x] Rust: lib.rs — separate_stems registered in invoke_handler; cargo check clean
- [x] Frontend: ipc.ts — invokeSeparateStems wrapper added
- [x] Frontend: QueueToolbar — Separate Stems button (indigo, Scissors icon), Enhance renamed from Process
      → 19/19 Vitest tests passing
      → Phase 3 COMPLETE ✓

## Phase 4 (next)
- [ ] PyInstaller build + Tauri installer packaging (.exe for Windows)
- [ ] File format conversion pipeline (300+ formats via ffmpeg)
- [ ] Batch processing limits enforcement (30 audio / 10 video simultaneous)
- [ ] Output format selector per file + global batch format override
```

- [ ] **Step 5: Update PRD_Enhance_Audio_Pro.txt Phase statuses**

In `PRD_Enhance_Audio_Pro.txt`, find and replace the roadmap section:

Find:
```
* Phase 1: Core UI structure, routing, settings, and drag-and-drop file ingestion.
  [STATUS: IN PROGRESS — Tasks 1-6 of 13 COMPLETE — 2026-05-20]
  [COMPLETED: Vite+React scaffold, TypeScript types, file validation (TDD), Zustand stores (TDD), IPC wrappers, all 7 UI components — 16/16 tests passing]
  [REMAINING: Tasks 7-13 — Tauri Rust backend, SQLite, Tauri commands, Python sidecar, icons, dev run]
  [PLAN: docs/superpowers/plans/2026-05-20-phase1-scaffold.md]
  [SPEC: docs/superpowers/specs/2026-05-20-enhance-audio-pro-design.md]
* Phase 2: Integration of the Python Backend for core AI processing (Speech Enhance & Stem Separation).
* Phase 3: Building the queue system, batch processing logic, and file conversion.
* Phase 4: Implementing Audio editing tools (Trimming, EQ, Merging, Pitch, Speed).
* Phase 5: Final polish, animations, localization, and packaging the executable for Windows and macOS.
```

Replace with:
```
* Phase 1: Core UI structure, routing, settings, and drag-and-drop file ingestion.
  [STATUS: COMPLETE — 2026-05-20]
  [COMPLETED: Full scaffold, TypeScript types, file validation, Zustand stores, IPC wrappers, 7 UI components, Tauri v2 Rust scaffold, SQLite, IPC commands, Python sidecar, dev run — 16/16 tests passing]
  [PLAN: docs/superpowers/plans/2026-05-20-phase1-scaffold.md]
  [SPEC: docs/superpowers/specs/2026-05-20-enhance-audio-pro-design.md]
* Phase 2: Speech Enhancement (DeepFilterNet3) — axum callback server, model wizard, process queue.
  [STATUS: COMPLETE — 2026-05-21]
  [COMPLETED: Rust callback server, DB migration, process_queue + start_model_download commands, DeepFilterNet3 processor, /enhance + /wizard/download endpoints, QueueGrid progress bar, SetupWizard — 19/19 Vitest + 11/11 Pytest passing]
  [SPEC: docs/superpowers/specs/2026-05-21-phase2-speech-enhancement-design.md]
* Phase 3: Stem Separation (Demucs htdemucs_ft) — vocals, drums, bass, other per audio file.
  [STATUS: COMPLETE — 2026-05-21]
  [COMPLETED: Demucs processor, /separate endpoint, separate_stems Tauri command, Separate Stems button in QueueToolbar — 18/18 Pytest + 19/19 Vitest passing]
  [SPEC: docs/superpowers/specs/2026-05-21-phase3-stem-separation-design.md]
* Phase 4: PyInstaller packaging + ffmpeg conversion + batch limits + output format selector.
* Phase 5: Audio editing tools (Trimming, EQ, Merging, Pitch, Speed, Loop, Crossfade).
* Phase 6: Final polish — A/B preview, localization (17 languages), keyboard shortcuts, macOS packaging.
```

- [ ] **Step 6: Final commit and push**

```powershell
cd "D:\vibe coding\app enhance audio pro"
git add claude.md PRD_Enhance_Audio_Pro.txt
git commit -m "chore: mark Phase 3 complete in CLAUDE.md and PRD; advance roadmap to Phase 4"
git push origin master
```

---

## Self-Review

**Spec coverage check:**

| Spec deliverable | Task |
|---|---|
| `processors/separate_stems.py` lazy Demucs load, CUDA→CPU | Task 2 |
| `routers/separate.py` POST /separate BackgroundTasks | Task 3 |
| `requirements.txt` demucs>=4.0.0 | Task 3 |
| `main.py` separate router registered | Task 3 |
| `commands/separate.rs` Rust command | Task 4 |
| `commands/mod.rs` pub mod separate | Task 4 |
| `lib.rs` separate_stems registered | Task 4 |
| `ipc.ts` invokeSeparateStems | Task 5 |
| `QueueToolbar.tsx` Separate Stems button | Task 5 |
| 4 Pytest unit tests (TDD) | Task 2 |
| 3 Pytest endpoint tests (TDD) | Task 3 |
| `conftest.py` Demucs mocks | Task 1 |
| CLAUDE.md + PRD updated | Task 6 |
| GitHub pushed | Task 6 |

All 14 spec deliverables covered. ✓

**Placeholder scan:** No TBD, TODO, or vague references. Every step has exact code. ✓

**Type consistency:**
- `invokeSeparateStems(jobIds: string[])` → `separate_stems(job_ids: Vec<String>)` ✓
- `separate_file(input_path, output_dir, progress_cb)` consistent across processor + router ✓
- `SeparateRequest.job_ids` (Python) ↔ `json!({ "job_ids": updated_ids })` (Rust) ✓
- Callback events reuse existing `queue://progress` and `queue://status-change` — no new event types ✓
