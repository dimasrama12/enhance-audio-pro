# Phase 2 — Speech Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire DeepFilterNet3 speech enhancement end-to-end: Rust callback server bridges Python→Tauri events, Setup Wizard downloads the model, queue Process button dispatches jobs, real-time progress bars update as Python enhances audio files.

**Architecture:** Rust starts a second axum HTTP server (callback port) alongside the existing sidecar. Python FastAPI receives `/enhance` and `/wizard/download` requests, processes in BackgroundTasks, POSTs progress/status to the Rust callback server, which emits `queue://progress` and `queue://status-change` Tauri events to the React frontend. The DB gains `progress` and `error_message` columns.

**Tech Stack:** Rust/Tauri v2, axum 0.7, reqwest 0.12, tokio 1 (net), Python FastAPI, DeepFilterNet3 (`deepfilternet>=0.5.6`), httpx, React/TypeScript, Zustand, `@tauri-apps/api/event`

---

## File Map

**New files — Rust**
- `src-tauri/src/callback/mod.rs` — axum callback server + 3 POST handlers
- `src-tauri/src/commands/process.rs` — `process_queue` Tauri command
- `src-tauri/src/commands/download.rs` — `start_model_download` Tauri command

**Modified files — Rust**
- `src-tauri/Cargo.toml` — add axum, tokio (net), reqwest
- `src-tauri/src/lib.rs` — AppState gains `callback_port`; callback server spawned; two new commands registered
- `src-tauri/src/sidecar/manager.rs` — `spawn()` accepts and passes `CALLBACK_PORT`
- `src-tauri/src/db/migrations.rs` — add `progress` and `error_message` columns
- `src-tauri/src/db/queue.rs` — update `QueueJob`, `get_all_jobs`, `insert_job`; add `get_job_by_id`, `update_job_status`, `update_job_error`
- `src-tauri/src/commands/mod.rs` — add `pub mod process; pub mod download;`

**New files — Python**
- `backend/processors/__init__.py`
- `backend/processors/enhance_speech.py` — lazy-loading DeepFilterNet3 wrapper
- `backend/routers/enhance.py` — `POST /enhance` endpoint
- `backend/routers/wizard.py` — `POST /wizard/download` endpoint
- `backend/tests/conftest.py` — session-wide mocks for torch/df (no heavy deps in CI)
- `backend/tests/test_enhance_speech.py`
- `backend/tests/test_enhance_endpoint.py`
- `backend/tests/test_wizard_endpoint.py`

**Modified files — Python**
- `backend/requirements.txt` — add deepfilternet, torch, torchaudio, httpx
- `backend/main.py` — include enhance and wizard routers

**Modified files — Frontend**
- `src/types/queue.ts` — add `progress: number`, `error_message: string | null`
- `src/stores/useQueueStore.ts` — add `setProgress`, `setStatus` actions
- `src/stores/__tests__/useQueueStore.test.ts` — tests for new actions
- `src/lib/ipc.ts` — add `invokeProcessQueue`, `invokeStartModelDownload`
- `src/components/QueueGrid.tsx` — progress bar column + Tauri event subscriptions
- `src/components/QueueToolbar.tsx` — Process button
- `src/components/SetupWizard.tsx` — wire wizard://progress / wizard://complete events

---

## Task 1: Rust — Cargo.toml dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add axum, tokio, reqwest to Cargo.toml**

Open `src-tauri/Cargo.toml` and add under `[dependencies]`:

```toml
axum = "0.7"
tokio = { version = "1", features = ["net"] }
reqwest = { version = "0.12", features = ["json"] }
```

The full `[dependencies]` block becomes:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
tauri-plugin-store = "2"
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
axum = "0.7"
tokio = { version = "1", features = ["net"] }
reqwest = { version = "0.12", features = ["json"] }
```

- [ ] **Step 2: Verify fetch succeeds**

```powershell
cd src-tauri
cargo fetch
```

Expected: Downloads axum, tokio, reqwest crates. No errors.

- [ ] **Step 3: Commit**

```powershell
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: add axum, tokio-net, reqwest for Phase 2 callback server"
```

---

## Task 2: Rust — DB layer: migration + QueueJob + helper functions

**Files:**
- Modify: `src-tauri/src/db/migrations.rs`
- Modify: `src-tauri/src/db/queue.rs`

- [ ] **Step 1: Write failing DB unit tests**

Replace `src-tauri/src/db/queue.rs` with the full updated version (struct + functions + tests):

```rust
use chrono::Utc;
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueueJob {
    pub id: String,
    pub filename: String,
    pub filepath: String,
    pub destination: String,
    pub size_bytes: i64,
    pub media_type: String,
    pub status: String,
    pub progress: i64,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

pub fn insert_job(
    conn: &Connection,
    filepath: &str,
    filename: &str,
    size_bytes: i64,
    media_type: &str,
) -> Result<QueueJob> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO queue_jobs
            (id, filename, filepath, destination, size_bytes, media_type, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, '', ?4, ?5, 'pending', ?6, ?7)",
        params![id, filename, filepath, size_bytes, media_type, now, now],
    )?;

    Ok(QueueJob {
        id,
        filename: filename.to_string(),
        filepath: filepath.to_string(),
        destination: String::new(),
        size_bytes,
        media_type: media_type.to_string(),
        status: "pending".to_string(),
        progress: 0,
        error_message: None,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn get_all_jobs(conn: &Connection) -> Result<Vec<QueueJob>> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, filepath, destination, size_bytes, media_type, status,
                progress, error_message, created_at, updated_at
         FROM queue_jobs
         ORDER BY created_at ASC",
    )?;

    let jobs = stmt
        .query_map([], |row| {
            Ok(QueueJob {
                id: row.get(0)?,
                filename: row.get(1)?,
                filepath: row.get(2)?,
                destination: row.get(3)?,
                size_bytes: row.get(4)?,
                media_type: row.get(5)?,
                status: row.get(6)?,
                progress: row.get(7)?,
                error_message: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    Ok(jobs)
}

pub fn get_job_by_id(conn: &Connection, id: &str) -> Result<Option<QueueJob>> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, filepath, destination, size_bytes, media_type, status,
                progress, error_message, created_at, updated_at
         FROM queue_jobs WHERE id = ?1",
    )?;

    let mut rows = stmt.query_map([id], |row| {
        Ok(QueueJob {
            id: row.get(0)?,
            filename: row.get(1)?,
            filepath: row.get(2)?,
            destination: row.get(3)?,
            size_bytes: row.get(4)?,
            media_type: row.get(5)?,
            status: row.get(6)?,
            progress: row.get(7)?,
            error_message: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    })?;

    rows.next().transpose()
}

pub fn update_job_status(conn: &Connection, id: &str, status: &str) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE queue_jobs SET status = ?1, updated_at = ?2 WHERE id = ?3",
        params![status, now, id],
    )?;
    Ok(())
}

pub fn update_job_error(conn: &Connection, id: &str, message: &str) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE queue_jobs SET status = 'error', error_message = ?1, updated_at = ?2 WHERE id = ?3",
        params![message, now, id],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::run_migrations;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        conn
    }

    #[test]
    fn test_get_job_by_id_returns_inserted_job() {
        let conn = setup();
        let job = insert_job(&conn, "/tmp/a.mp3", "a.mp3", 1024, "audio").unwrap();
        let found = get_job_by_id(&conn, &job.id).unwrap().unwrap();
        assert_eq!(found.id, job.id);
        assert_eq!(found.progress, 0);
        assert!(found.error_message.is_none());
    }

    #[test]
    fn test_get_job_by_id_returns_none_for_unknown_id() {
        let conn = setup();
        let found = get_job_by_id(&conn, "nonexistent-id").unwrap();
        assert!(found.is_none());
    }

    #[test]
    fn test_update_job_status_changes_status() {
        let conn = setup();
        let job = insert_job(&conn, "/tmp/b.mp3", "b.mp3", 512, "audio").unwrap();
        update_job_status(&conn, &job.id, "processing").unwrap();
        let jobs = get_all_jobs(&conn).unwrap();
        assert_eq!(jobs[0].status, "processing");
    }

    #[test]
    fn test_update_job_error_sets_status_and_message() {
        let conn = setup();
        let job = insert_job(&conn, "/tmp/c.mp3", "c.mp3", 256, "audio").unwrap();
        update_job_error(&conn, &job.id, "model not loaded").unwrap();
        let jobs = get_all_jobs(&conn).unwrap();
        assert_eq!(jobs[0].status, "error");
        assert_eq!(jobs[0].error_message.as_deref(), Some("model not loaded"));
    }
}
```

- [ ] **Step 2: Run tests — expect FAIL (functions compile but migration table missing new columns)**

```powershell
cd src-tauri
cargo test --lib 2>&1 | Select-Object -First 40
```

Expected: Compile error because `db::migrations::run_migrations` doesn't yet create `progress` and `error_message` columns, causing SELECT to fail at runtime. Tests run but fail.

- [ ] **Step 3: Update migrations.rs to add the new columns**

Replace `src-tauri/src/db/migrations.rs`:

```rust
use rusqlite::{Connection, Result};

pub fn run_migrations(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS queue_jobs (
            id            TEXT    PRIMARY KEY NOT NULL,
            filename      TEXT    NOT NULL,
            filepath      TEXT    NOT NULL,
            destination   TEXT    NOT NULL DEFAULT '',
            size_bytes    INTEGER NOT NULL DEFAULT 0,
            media_type    TEXT    NOT NULL DEFAULT 'audio',
            status        TEXT    NOT NULL DEFAULT 'pending',
            progress      INTEGER NOT NULL DEFAULT 0,
            error_message TEXT,
            created_at    TEXT    NOT NULL,
            updated_at    TEXT    NOT NULL
        );",
    )?;
    // Idempotent column additions for databases created before Phase 2
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN error_message TEXT;",
    );
    Ok(())
}
```

- [ ] **Step 4: Run tests — expect PASS**

```powershell
cargo test --lib 2>&1 | Select-Object -Last 20
```

Expected output:
```
test db::queue::tests::test_get_job_by_id_returns_inserted_job ... ok
test db::queue::tests::test_get_job_by_id_returns_none_for_unknown_id ... ok
test db::queue::tests::test_update_job_status_changes_status ... ok
test db::queue::tests::test_update_job_error_sets_status_and_message ... ok
test result: ok. 4 passed; 0 failed
```

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/src/db/queue.rs src-tauri/src/db/migrations.rs
git commit -m "feat: add progress/error_message columns and DB helper functions"
```

---

## Task 3: Rust — Callback server (callback/mod.rs)

**Files:**
- Create: `src-tauri/src/callback/mod.rs`

- [ ] **Step 1: Create the callback module directory and file**

Create `src-tauri/src/callback/mod.rs`:

```rust
use std::sync::{Arc, Mutex};

use axum::{extract::State, routing::post, Json, Router};
use rusqlite::Connection;
use serde::Deserialize;
use serde_json::json;
use tauri::{AppHandle, Emitter};

use crate::db::queue as db_queue;

#[derive(Clone)]
pub struct CallbackState {
    pub app: AppHandle,
    pub db: Arc<Mutex<Connection>>,
}

#[derive(Deserialize)]
pub struct ProgressPayload {
    pub job_id: String,
    pub percent: u8,
}

#[derive(Deserialize)]
pub struct StatusPayload {
    pub job_id: String,
    pub status: String,
    pub error_message: Option<String>,
}

#[derive(Deserialize)]
pub struct WizardPayload {
    #[serde(rename = "type")]
    pub kind: String,
    pub percent: Option<u8>,
    pub message: Option<String>,
}

pub fn build_router(state: CallbackState) -> Router {
    Router::new()
        .route("/callback/progress", post(handle_progress))
        .route("/callback/status", post(handle_status))
        .route("/callback/wizard", post(handle_wizard))
        .with_state(state)
}

async fn handle_progress(State(s): State<CallbackState>, Json(p): Json<ProgressPayload>) {
    let _ = s.app.emit(
        "queue://progress",
        json!({ "jobId": p.job_id, "percent": p.percent }),
    );
}

async fn handle_status(State(s): State<CallbackState>, Json(p): Json<StatusPayload>) {
    {
        let conn = s.db.lock().unwrap();
        if p.status == "error" {
            let msg = p.error_message.as_deref().unwrap_or("Unknown error");
            let _ = db_queue::update_job_error(&conn, &p.job_id, msg);
        } else {
            let _ = db_queue::update_job_status(&conn, &p.job_id, &p.status);
        }
    }
    let _ = s.app.emit(
        "queue://status-change",
        json!({ "jobId": p.job_id, "status": p.status }),
    );
}

async fn handle_wizard(State(s): State<CallbackState>, Json(p): Json<WizardPayload>) {
    match p.kind.as_str() {
        "progress" => {
            let _ = s.app.emit(
                "wizard://progress",
                json!({ "percent": p.percent.unwrap_or(0) }),
            );
        }
        "complete" => {
            let _ = s.app.emit("wizard://complete", json!({}));
        }
        "error" => {
            let _ = s.app.emit(
                "wizard://error",
                json!({ "message": p.message.unwrap_or_default() }),
            );
        }
        _ => {}
    }
}
```

- [ ] **Step 2: Verify module compiles in isolation (will be wired in Task 4)**

No test run yet — the module is not referenced from `lib.rs`. Proceed to Task 4.

---

## Task 4: Rust — lib.rs + sidecar/manager.rs wiring

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/sidecar/manager.rs`

- [ ] **Step 1: Update sidecar/manager.rs to accept and pass CALLBACK_PORT**

Replace `src-tauri/src/sidecar/manager.rs`:

```rust
use std::net::TcpListener;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

pub fn available_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .unwrap_or(8765)
}

pub fn spawn(
    app: &AppHandle,
    port: u16,
    callback_port: u16,
) -> Result<(), Box<dyn std::error::Error>> {
    app.shell()
        .sidecar("backend")
        .map_err(|e| e.to_string())?
        .env("BACKEND_PORT", port.to_string())
        .env("CALLBACK_PORT", callback_port.to_string())
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

- [ ] **Step 2: Replace lib.rs with the full Phase 2 wiring**

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

            // Bind callback server to a random OS-assigned port
            let cb_listener = std::net::TcpListener::bind("127.0.0.1:0")
                .map_err(|e| e.to_string())?;
            cb_listener.set_nonblocking(true).map_err(|e| e.to_string())?;
            let callback_port = cb_listener.local_addr().unwrap().port();

            // Spawn axum callback server in Tauri's async runtime
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Create stub commands so cargo check passes**

Create `src-tauri/src/commands/process.rs` (stub — full impl in Task 5):

```rust
use tauri::{AppHandle, State};
use crate::AppState;
use crate::commands::IpcResponse;

#[tauri::command]
pub async fn process_queue(
    _state: State<'_, AppState>,
    _app_handle: AppHandle,
    _job_ids: Vec<String>,
) -> IpcResponse<()> {
    IpcResponse { success: true, data: Some(()), error: None }
}
```

Create `src-tauri/src/commands/download.rs` (stub — full impl in Task 5):

```rust
use tauri::State;
use crate::AppState;
use crate::commands::IpcResponse;

#[tauri::command]
pub async fn start_model_download(_state: State<'_, AppState>) -> IpcResponse<()> {
    IpcResponse { success: true, data: Some(()), error: None }
}
```

Update `src-tauri/src/commands/mod.rs`:

```rust
pub mod download;
pub mod process;
pub mod queue;
pub mod settings;

use serde::Serialize;

#[derive(Serialize)]
pub struct IpcResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}
```

- [ ] **Step 4: cargo check — must pass clean**

```powershell
cargo check 2>&1 | Select-Object -Last 15
```

Expected: `Finished` with no errors. Warnings about unused imports are acceptable.

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/src/lib.rs src-tauri/src/sidecar/manager.rs `
        src-tauri/src/callback/mod.rs src-tauri/src/commands/mod.rs `
        src-tauri/src/commands/process.rs src-tauri/src/commands/download.rs
git commit -m "feat: wire axum callback server and register Phase 2 command stubs"
```

---

## Task 5: Rust — Full process_queue and start_model_download commands

**Files:**
- Modify: `src-tauri/src/commands/process.rs`
- Modify: `src-tauri/src/commands/download.rs`

- [ ] **Step 1: Replace process.rs stub with full implementation**

Replace `src-tauri/src/commands/process.rs`:

```rust
use serde_json::json;
use tauri::{AppHandle, Emitter, State};

use crate::commands::IpcResponse;
use crate::db::queue as db_queue;
use crate::AppState;

#[tauri::command]
pub async fn process_queue(
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

    // Update all selected jobs to 'processing' and collect their IDs while holding the lock.
    // Drop the lock before any await points.
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
    }; // db lock released here

    // Emit status-change for every updated job
    for id in &updated_ids {
        let _ = app_handle.emit(
            "queue://status-change",
            json!({ "jobId": id, "status": "processing" }),
        );
    }

    // Fire-and-forget to Python — Python processes jobs serially and calls back
    let payload = json!({
        "job_ids": updated_ids,
        "callback_url": format!("http://127.0.0.1:{}", callback_port),
    });

    tauri::async_runtime::spawn(async move {
        let url = format!("http://127.0.0.1:{}/enhance", backend_port);
        let _ = reqwest::Client::new().post(&url).json(&payload).send().await;
    });

    IpcResponse {
        success: true,
        data: Some(()),
        error: None,
    }
}
```

- [ ] **Step 2: Replace download.rs stub with full implementation**

Replace `src-tauri/src/commands/download.rs`:

```rust
use tauri::State;

use crate::commands::IpcResponse;
use crate::AppState;

#[tauri::command]
pub async fn start_model_download(state: State<'_, AppState>) -> IpcResponse<()> {
    let backend_port = state.backend_port;
    let callback_port = state.callback_port;

    let payload = serde_json::json!({
        "callback_url": format!("http://127.0.0.1:{}", callback_port),
    });

    tauri::async_runtime::spawn(async move {
        let url = format!("http://127.0.0.1:{}/wizard/download", backend_port);
        let _ = reqwest::Client::new().post(&url).json(&payload).send().await;
    });

    IpcResponse {
        success: true,
        data: Some(()),
        error: None,
    }
}
```

- [ ] **Step 3: cargo check — must pass clean**

```powershell
cargo check 2>&1 | Select-Object -Last 10
```

Expected: `Finished` with no errors.

- [ ] **Step 4: Run all Rust tests**

```powershell
cargo test --lib 2>&1 | Select-Object -Last 15
```

Expected: 4 DB tests pass, 0 failed.

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/src/commands/process.rs src-tauri/src/commands/download.rs
git commit -m "feat: implement process_queue and start_model_download commands"
```

---

## Task 6: Python — requirements.txt + tests/conftest.py

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Update requirements.txt**

Replace `backend/requirements.txt`:

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
deepfilternet>=0.5.6
torch>=2.0.0
torchaudio>=2.0.0
httpx>=0.27.0
```

Note: `httpx` is already in `requirements-dev.txt`. Moving it to the main `requirements.txt` because `routers/enhance.py` and `routers/wizard.py` use it at runtime.

- [ ] **Step 2: Create tests/conftest.py to mock heavy AI dependencies**

Create `backend/tests/conftest.py`:

```python
"""
Session-wide mocks for torch, torchaudio, and deepfilternet.
These packages are large and not installed in the dev/CI test environment.
Individual tests can override specific mock behaviour via patch.dict(sys.modules, ...).
"""
import sys
from unittest.mock import MagicMock

_mock_df_state = MagicMock()
_mock_df_state.sr.return_value = 48000

_mock_model = MagicMock()
_mock_model.to.return_value = _mock_model

_mock_df_enhance = MagicMock()
_mock_df_enhance.init_df.return_value = (_mock_model, _mock_df_state, None)
_mock_df_enhance.load_audio.return_value = (MagicMock(), 48000)
_mock_df_enhance.enhance.return_value = MagicMock()
_mock_df_enhance.save_audio = MagicMock()

_mock_torch = MagicMock()
_mock_torch.cuda.is_available.return_value = False

for _mod, _mock in [
    ("torch", _mock_torch),
    ("torchaudio", MagicMock()),
    ("df", MagicMock(enhance=_mock_df_enhance)),
    ("df.enhance", _mock_df_enhance),
]:
    sys.modules.setdefault(_mod, _mock)
```

- [ ] **Step 3: Verify existing tests still pass with conftest in place**

```powershell
cd backend
pytest tests/test_health.py -v
```

Expected:
```
PASSED tests/test_health.py::test_health_returns_ok
PASSED tests/test_health.py::test_process_returns_501
2 passed
```

- [ ] **Step 4: Commit**

```powershell
git add backend/requirements.txt backend/tests/conftest.py
git commit -m "chore: add AI runtime deps and test conftest mocks for heavy dependencies"
```

---

## Task 7: Python — enhance_speech processor + unit tests

**Files:**
- Create: `backend/processors/__init__.py`
- Create: `backend/processors/enhance_speech.py`
- Create: `backend/tests/test_enhance_speech.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_enhance_speech.py`:

```python
import sys
import pytest
from unittest.mock import MagicMock


@pytest.fixture(autouse=True)
def reset_model_cache():
    """Clear module-level model cache between tests."""
    import importlib
    mod = sys.modules.get("processors.enhance_speech")
    if mod:
        mod._model = None
        mod._df_state = None
    yield
    mod = sys.modules.get("processors.enhance_speech")
    if mod:
        mod._model = None
        mod._df_state = None


def test_progress_callbacks_are_called_in_order():
    """enhance_file calls progress_cb at increasing values ending at 100."""
    from processors.enhance_speech import enhance_file

    calls = []
    enhance_file("/tmp/in.wav", "/tmp/out.wav", calls.append)

    assert calls[-1] == 100
    assert calls == sorted(calls), "progress must be monotonically increasing"


def test_progress_includes_start_and_end_milestones():
    """progress_cb is called at 10 and 100 at minimum."""
    from processors.enhance_speech import enhance_file

    calls = []
    enhance_file("/tmp/in.wav", "/tmp/out.wav", calls.append)

    assert 10 in calls
    assert 100 in calls


def test_save_audio_called_with_correct_output_path():
    """save_audio receives the output_path argument that was passed in."""
    from processors.enhance_speech import enhance_file

    enhance_file("/tmp/in.wav", "/tmp/out_enhanced.wav", lambda _: None)

    save_mock = sys.modules["df.enhance"].save_audio
    called_output_path = save_mock.call_args[0][0]
    assert called_output_path == "/tmp/out_enhanced.wav"


def test_model_is_loaded_lazily_not_at_import():
    """Importing the module does NOT call init_df; only enhance_file does."""
    # Reset so the module is freshly imported
    sys.modules.pop("processors.enhance_speech", None)
    init_df_mock = sys.modules["df.enhance"].init_df

    import processors.enhance_speech  # noqa: F401 — intentional bare import

    init_df_mock.assert_not_called()
```

- [ ] **Step 2: Run tests — expect FAIL (module does not exist yet)**

```powershell
pytest tests/test_enhance_speech.py -v 2>&1 | Select-Object -Last 10
```

Expected: `ModuleNotFoundError: No module named 'processors'`

- [ ] **Step 3: Create processors package**

Create `backend/processors/__init__.py` (empty):

```python
```

- [ ] **Step 4: Create enhance_speech.py**

Create `backend/processors/enhance_speech.py`:

```python
import os
import pathlib
from typing import Callable

# Module-level cache — loaded once per sidecar lifetime, never per-job.
_model = None
_df_state = None


def _get_device() -> str:
    import torch
    return "cuda" if torch.cuda.is_available() else "cpu"


def _load_model():
    global _model, _df_state
    if _model is not None:
        return _model, _df_state

    from df.enhance import init_df

    appdata = os.environ.get("APPDATA", str(pathlib.Path.home()))
    models_dir = pathlib.Path(appdata) / "enhance-audio-pro" / "models" / "deepfilter"
    os.environ.setdefault("DFHOME", str(models_dir))

    _model, _df_state, _ = init_df()
    _model = _model.to(_get_device())
    return _model, _df_state


def enhance_file(
    input_path: str,
    output_path: str,
    progress_cb: Callable[[int], None],
) -> None:
    """Remove noise from input_path using DeepFilterNet3, write result to output_path."""
    from df.enhance import enhance, load_audio, save_audio

    model, df_state = _load_model()

    progress_cb(10)
    audio, _ = load_audio(input_path, sr=df_state.sr())

    progress_cb(30)
    enhanced = enhance(model, df_state, audio)

    progress_cb(90)
    save_audio(output_path, enhanced, df_state.sr())

    progress_cb(100)
```

- [ ] **Step 5: Run tests — expect PASS**

```powershell
pytest tests/test_enhance_speech.py -v
```

Expected:
```
PASSED tests/test_enhance_speech.py::test_progress_callbacks_are_called_in_order
PASSED tests/test_enhance_speech.py::test_progress_includes_start_and_end_milestones
PASSED tests/test_enhance_speech.py::test_save_audio_called_with_correct_output_path
PASSED tests/test_enhance_speech.py::test_model_is_loaded_lazily_not_at_import
4 passed
```

- [ ] **Step 6: Commit**

```powershell
git add backend/processors/__init__.py backend/processors/enhance_speech.py `
        backend/tests/test_enhance_speech.py
git commit -m "feat: add DeepFilterNet3 enhance_speech processor with lazy model loading"
```

---

## Task 8: Python — enhance router + endpoint tests

**Files:**
- Create: `backend/routers/enhance.py`
- Create: `backend/tests/test_enhance_endpoint.py`

- [ ] **Step 1: Write failing endpoint tests**

Create `backend/tests/test_enhance_endpoint.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport


async def test_enhance_returns_202():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/enhance", json={
            "job_ids": ["test-job-1"],
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.status_code == 202


async def test_enhance_returns_processing_started_detail():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/enhance", json={
            "job_ids": ["test-job-1"],
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.json()["detail"] == "Processing started."


async def test_enhance_with_empty_job_ids_returns_202():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/enhance", json={
            "job_ids": [],
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.status_code == 202
```

- [ ] **Step 2: Run tests — expect FAIL (route does not exist)**

```powershell
pytest tests/test_enhance_endpoint.py -v 2>&1 | Select-Object -Last 10
```

Expected: Tests fail with 404 or import error — route `/enhance` not yet registered.

- [ ] **Step 3: Create routers/enhance.py**

Create `backend/routers/enhance.py`:

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

from processors.enhance_speech import enhance_file

router = APIRouter()


class EnhanceRequest(BaseModel):
    job_ids: List[str]
    callback_url: str


@router.post("/enhance")
async def enhance_jobs(
    req: EnhanceRequest, background_tasks: BackgroundTasks
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
            stem = pathlib.Path(filename).stem
            suffix = pathlib.Path(filename).suffix
            out_dir = (
                pathlib.Path(destination)
                if destination
                else pathlib.Path(filepath).parent
            )
            output_path = str(out_dir / f"{stem}_enhanced{suffix}")

            def _sync_enhance(out: str) -> None:
                def _progress(pct: int) -> None:
                    httpx.post(
                        f"{callback_url}/callback/progress",
                        json={"job_id": job_id, "percent": pct},
                        timeout=5,
                    )

                enhance_file(filepath, out, _progress)

            await loop.run_in_executor(None, lambda: _sync_enhance(output_path))

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

- [ ] **Step 4: Register router in main.py (temporary — will be finalised in Task 12)**

Edit `backend/main.py` to add the enhance router:

```python
import os
import uvicorn
from fastapi import FastAPI
from routers import health, queue, enhance

app = FastAPI(title="Enhance Audio Pro Backend", version="0.1.0")
app.include_router(health.router)
app.include_router(queue.router)
app.include_router(enhance.router)

if __name__ == "__main__":
    port = int(os.environ.get("BACKEND_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
```

- [ ] **Step 5: Run tests — expect PASS**

```powershell
pytest tests/test_enhance_endpoint.py -v
```

Expected:
```
PASSED tests/test_enhance_endpoint.py::test_enhance_returns_202
PASSED tests/test_enhance_endpoint.py::test_enhance_returns_processing_started_detail
PASSED tests/test_enhance_endpoint.py::test_enhance_with_empty_job_ids_returns_202
3 passed
```

- [ ] **Step 6: Commit**

```powershell
git add backend/routers/enhance.py backend/tests/test_enhance_endpoint.py backend/main.py
git commit -m "feat: add /enhance endpoint with BackgroundTask job processing"
```

---

## Task 9: Python — wizard router + endpoint tests

**Files:**
- Create: `backend/routers/wizard.py`
- Create: `backend/tests/test_wizard_endpoint.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_wizard_endpoint.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport


async def test_wizard_download_returns_202():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/wizard/download", json={
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.status_code == 202


async def test_wizard_download_returns_download_started_detail():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/wizard/download", json={
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.json()["detail"] == "Download started."
```

- [ ] **Step 2: Run tests — expect FAIL (404)**

```powershell
pytest tests/test_wizard_endpoint.py -v 2>&1 | Select-Object -Last 5
```

Expected: 404 — route not yet registered.

- [ ] **Step 3: Create routers/wizard.py**

Create `backend/routers/wizard.py`:

```python
import os
import pathlib

import httpx
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/wizard")

DEEPFILTER_REPO = "rikorose/DeepFilterNet3"
DEEPFILTER_FILES = [
    ("config.ini", 1),
    ("checkpoints/model.ckpt", 99),
]


class DownloadRequest(BaseModel):
    callback_url: str


@router.post("/download")
async def download_models(
    req: DownloadRequest, background_tasks: BackgroundTasks
) -> JSONResponse:
    background_tasks.add_task(_download_deepfilter, req.callback_url)
    return JSONResponse(status_code=202, content={"detail": "Download started."})


async def _download_deepfilter(callback_url: str) -> None:
    appdata = os.environ.get("APPDATA", str(pathlib.Path.home()))
    models_dir = pathlib.Path(appdata) / "enhance-audio-pro" / "models" / "deepfilter"
    models_dir.mkdir(parents=True, exist_ok=True)
    (models_dir / "checkpoints").mkdir(exist_ok=True)

    base_url = f"https://huggingface.co/{DEEPFILTER_REPO}/resolve/main"
    accumulated = 0

    async with httpx.AsyncClient(follow_redirects=True, timeout=600) as dl:
        async with httpx.AsyncClient(timeout=10) as cb:
            try:
                for filename, weight in DEEPFILTER_FILES:
                    dest = models_dir / filename
                    if dest.exists():
                        accumulated += weight
                        await cb.post(
                            f"{callback_url}/callback/wizard",
                            json={"type": "progress", "percent": min(accumulated, 99)},
                        )
                        continue

                    url = f"{base_url}/{filename}"
                    async with dl.stream("GET", url) as resp:
                        total = int(resp.headers.get("content-length", 0))
                        got = 0
                        with open(dest, "wb") as f:
                            async for chunk in resp.aiter_bytes(65536):
                                f.write(chunk)
                                got += len(chunk)
                                if total:
                                    pct = min(
                                        accumulated + int(got / total * weight), 99
                                    )
                                    await cb.post(
                                        f"{callback_url}/callback/wizard",
                                        json={"type": "progress", "percent": pct},
                                    )
                    accumulated += weight

                await cb.post(
                    f"{callback_url}/callback/wizard", json={"type": "complete"}
                )

            except Exception as exc:
                await cb.post(
                    f"{callback_url}/callback/wizard",
                    json={"type": "error", "message": str(exc)},
                )
```

- [ ] **Step 4: Run tests — expect PASS**

```powershell
pytest tests/test_wizard_endpoint.py -v
```

Expected:
```
PASSED tests/test_wizard_endpoint.py::test_wizard_download_returns_202
PASSED tests/test_wizard_endpoint.py::test_wizard_download_returns_download_started_detail
2 passed
```

- [ ] **Step 5: Commit**

```powershell
git add backend/routers/wizard.py backend/tests/test_wizard_endpoint.py
git commit -m "feat: add /wizard/download endpoint with streaming HuggingFace download"
```

---

## Task 10: Python — main.py final update + full test suite

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add wizard router to main.py**

Replace `backend/main.py`:

```python
import os
import uvicorn
from fastapi import FastAPI
from routers import enhance, health, queue, wizard

app = FastAPI(title="Enhance Audio Pro Backend", version="0.1.0")
app.include_router(health.router)
app.include_router(queue.router)
app.include_router(enhance.router)
app.include_router(wizard.router)

if __name__ == "__main__":
    port = int(os.environ.get("BACKEND_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
```

- [ ] **Step 2: Run full Python test suite**

```powershell
pytest tests/ -v
```

Expected:
```
PASSED tests/test_health.py::test_health_returns_ok
PASSED tests/test_health.py::test_process_returns_501
PASSED tests/test_enhance_speech.py::test_progress_callbacks_are_called_in_order
PASSED tests/test_enhance_speech.py::test_progress_includes_start_and_end_milestones
PASSED tests/test_enhance_speech.py::test_save_audio_called_with_correct_output_path
PASSED tests/test_enhance_speech.py::test_model_is_loaded_lazily_not_at_import
PASSED tests/test_enhance_endpoint.py::test_enhance_returns_202
PASSED tests/test_enhance_endpoint.py::test_enhance_returns_processing_started_detail
PASSED tests/test_enhance_endpoint.py::test_enhance_with_empty_job_ids_returns_202
PASSED tests/test_wizard_endpoint.py::test_wizard_download_returns_202
PASSED tests/test_wizard_endpoint.py::test_wizard_download_returns_download_started_detail
11 passed
```

- [ ] **Step 3: Commit**

```powershell
git add backend/main.py
git commit -m "feat: register all Phase 2 routers — Python backend complete"
```

---

## Task 11: Frontend — QueueJob type + useQueueStore + tests

**Files:**
- Modify: `src/types/queue.ts`
- Modify: `src/stores/useQueueStore.ts`
- Modify: `src/stores/__tests__/useQueueStore.test.ts`

- [ ] **Step 1: Write failing store tests**

Add to the bottom of `src/stores/__tests__/useQueueStore.test.ts`:

```typescript
// Add progress and error_message to makeJob helper — update the existing helper:
// (Replace the existing makeJob function with this expanded version)
const makeJob = (overrides: Partial<QueueJob> = {}): QueueJob => ({
  id: 'test-id',
  filename: 'test.mp3',
  filepath: '/tmp/test.mp3',
  destination: '',
  size_bytes: 1024,
  media_type: 'audio',
  status: 'pending',
  progress: 0,
  error_message: null,
  created_at: '2026-05-20T00:00:00Z',
  updated_at: '2026-05-20T00:00:00Z',
  ...overrides,
});

// Add these tests at the bottom of the describe block:
it('setProgress updates the correct job progress', () => {
  useQueueStore.setState({
    jobs: [makeJob({ id: 'j1' }), makeJob({ id: 'j2' })],
  });
  useQueueStore.getState().setProgress('j1', 45);
  const jobs = useQueueStore.getState().jobs;
  expect(jobs.find((j) => j.id === 'j1')!.progress).toBe(45);
  expect(jobs.find((j) => j.id === 'j2')!.progress).toBe(0);
});

it('setStatus updates the correct job status', () => {
  useQueueStore.setState({
    jobs: [makeJob({ id: 'j1' }), makeJob({ id: 'j2' })],
  });
  useQueueStore.getState().setStatus('j1', 'processing');
  const jobs = useQueueStore.getState().jobs;
  expect(jobs.find((j) => j.id === 'j1')!.status).toBe('processing');
  expect(jobs.find((j) => j.id === 'j2')!.status).toBe('pending');
});

it('setProgress does not affect other jobs', () => {
  useQueueStore.setState({
    jobs: [makeJob({ id: 'a', status: 'done' }), makeJob({ id: 'b', status: 'pending' })],
  });
  useQueueStore.getState().setProgress('a', 100);
  expect(useQueueStore.getState().jobs.find((j) => j.id === 'b')!.status).toBe('pending');
});
```

The full replacement for `src/stores/__tests__/useQueueStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useQueueStore } from '../useQueueStore';
import type { QueueJob } from '@/types/queue';

const makeJob = (overrides: Partial<QueueJob> = {}): QueueJob => ({
  id: 'test-id',
  filename: 'test.mp3',
  filepath: '/tmp/test.mp3',
  destination: '',
  size_bytes: 1024,
  media_type: 'audio',
  status: 'pending',
  progress: 0,
  error_message: null,
  created_at: '2026-05-20T00:00:00Z',
  updated_at: '2026-05-20T00:00:00Z',
  ...overrides,
});

describe('useQueueStore', () => {
  beforeEach(() => {
    useQueueStore.setState({ jobs: [], filter: 'all', searchQuery: '' });
  });

  it('adds jobs', () => {
    useQueueStore.getState().addJobs([makeJob()]);
    expect(useQueueStore.getState().jobs).toHaveLength(1);
  });

  it('filters by status', () => {
    useQueueStore.setState({
      jobs: [makeJob({ id: '1', status: 'pending' }), makeJob({ id: '2', status: 'done' })],
      filter: 'done',
    });
    const results = useQueueStore.getState().filteredJobs();
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('done');
  });

  it('filters by search query', () => {
    useQueueStore.setState({
      jobs: [makeJob({ id: '1', filename: 'podcast.mp3' }), makeJob({ id: '2', filename: 'music.wav' })],
      searchQuery: 'podcast',
    });
    expect(useQueueStore.getState().filteredJobs()).toHaveLength(1);
  });

  it('clears queue', () => {
    useQueueStore.setState({ jobs: [makeJob()] });
    useQueueStore.getState().clearQueue();
    expect(useQueueStore.getState().jobs).toHaveLength(0);
  });

  it('setProgress updates the correct job progress', () => {
    useQueueStore.setState({
      jobs: [makeJob({ id: 'j1' }), makeJob({ id: 'j2' })],
    });
    useQueueStore.getState().setProgress('j1', 45);
    const jobs = useQueueStore.getState().jobs;
    expect(jobs.find((j) => j.id === 'j1')!.progress).toBe(45);
    expect(jobs.find((j) => j.id === 'j2')!.progress).toBe(0);
  });

  it('setStatus updates the correct job status', () => {
    useQueueStore.setState({
      jobs: [makeJob({ id: 'j1' }), makeJob({ id: 'j2' })],
    });
    useQueueStore.getState().setStatus('j1', 'processing');
    const jobs = useQueueStore.getState().jobs;
    expect(jobs.find((j) => j.id === 'j1')!.status).toBe('processing');
    expect(jobs.find((j) => j.id === 'j2')!.status).toBe('pending');
  });

  it('setProgress does not affect other jobs', () => {
    useQueueStore.setState({
      jobs: [makeJob({ id: 'a', status: 'done' }), makeJob({ id: 'b', status: 'pending' })],
    });
    useQueueStore.getState().setProgress('a', 100);
    expect(useQueueStore.getState().jobs.find((j) => j.id === 'b')!.status).toBe('pending');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (setProgress / setStatus not defined)**

```powershell
cd ..   # back to project root
npm test -- --reporter=verbose 2>&1 | Select-Object -Last 20
```

Expected: Type errors and runtime errors because `setProgress` / `setStatus` don't exist yet, and `QueueJob` is missing `progress` / `error_message`.

- [ ] **Step 3: Update src/types/queue.ts**

Replace `src/types/queue.ts`:

```typescript
export type MediaType = 'audio' | 'video';
export type JobStatus = 'pending' | 'processing' | 'done' | 'error';

export interface QueueJob {
  id: string;
  filename: string;
  filepath: string;
  destination: string;
  size_bytes: number;
  media_type: MediaType;
  status: JobStatus;
  progress: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: Update src/stores/useQueueStore.ts**

Replace `src/stores/useQueueStore.ts`:

```typescript
import { create } from 'zustand';
import type { QueueJob, JobStatus } from '@/types/queue';

interface QueueState {
  jobs: QueueJob[];
  filter: string;
  searchQuery: string;
  setJobs: (jobs: QueueJob[]) => void;
  addJobs: (jobs: QueueJob[]) => void;
  setFilter: (filter: string) => void;
  setSearchQuery: (query: string) => void;
  clearQueue: () => void;
  setProgress: (jobId: string, percent: number) => void;
  setStatus: (jobId: string, status: JobStatus) => void;
  filteredJobs: () => QueueJob[];
}

export const useQueueStore = create<QueueState>((set, get) => ({
  jobs: [],
  filter: 'all',
  searchQuery: '',
  setJobs: (jobs) => set({ jobs }),
  addJobs: (newJobs) => set((s) => ({ jobs: [...s.jobs, ...newJobs] })),
  setFilter: (filter) => set({ filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  clearQueue: () => set({ jobs: [] }),
  setProgress: (jobId, percent) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === jobId ? { ...j, progress: percent } : j)),
    })),
  setStatus: (jobId, status) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === jobId ? { ...j, status } : j)),
    })),
  filteredJobs: () => {
    const { jobs, filter, searchQuery } = get();
    return jobs
      .filter((j) => filter === 'all' || j.status === filter)
      .filter(
        (j) => !searchQuery || j.filename.toLowerCase().includes(searchQuery.toLowerCase()),
      );
  },
}));
```

- [ ] **Step 5: Run tests — expect PASS (all 7 store tests)**

```powershell
npm test -- --reporter=verbose 2>&1 | Select-Object -Last 20
```

Expected: All previous 4 tests + 3 new tests = 7 passing.

- [ ] **Step 6: Commit**

```powershell
git add src/types/queue.ts src/stores/useQueueStore.ts `
        src/stores/__tests__/useQueueStore.test.ts
git commit -m "feat: add progress/error_message to QueueJob and setProgress/setStatus store actions"
```

---

## Task 12: Frontend — IPC wrappers

**Files:**
- Modify: `src/lib/ipc.ts`

- [ ] **Step 1: Add two new invoke wrappers**

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
```

- [ ] **Step 2: Run tests — expect all pass (no test change needed, just type-check)**

```powershell
npm test 2>&1 | Select-Object -Last 10
```

Expected: Same passing count as before. No type errors.

- [ ] **Step 3: Commit**

```powershell
git add src/lib/ipc.ts
git commit -m "feat: add invokeProcessQueue and invokeStartModelDownload IPC wrappers"
```

---

## Task 13: Frontend — QueueGrid progress bar + event subscriptions

**Files:**
- Modify: `src/components/QueueGrid.tsx`

- [ ] **Step 1: Replace QueueGrid.tsx with progress bar and event wiring**

Replace `src/components/QueueGrid.tsx`:

```typescript
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { listen } from '@tauri-apps/api/event';
import { clsx } from 'clsx';
import { useQueueStore } from '@/stores/useQueueStore';
import type { QueueJob, JobStatus } from '@/types/queue';

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: 'text-yellow-400',
  processing: 'text-blue-400',
  done: 'text-green-400',
  error: 'text-red-400',
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function ProgressBar({ percent }: { percent: number }): JSX.Element {
  return (
    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full bg-blue-400 rounded-full transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function JobRow({ job, index }: { job: QueueJob; index: number }): JSX.Element {
  return (
    <motion.tr
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: index * 0.03 }}
      className="border-b border-white/5 hover:bg-white/5 transition-colors"
    >
      <td className="px-4 py-2 text-white/30 text-xs w-10">{index + 1}</td>
      <td className="px-4 py-2 text-sm text-white truncate max-w-[200px]">{job.filename}</td>
      <td className="px-4 py-2 text-xs text-white/50 truncate max-w-[140px]">
        {job.destination || '—'}
      </td>
      <td className="px-4 py-2 text-xs text-white/50 w-24">{formatBytes(job.size_bytes)}</td>
      <td className="px-4 py-2 text-xs uppercase text-white/40 w-16">{job.media_type}</td>
      <td className="px-4 py-2 w-32">
        {job.status === 'processing' ? (
          <ProgressBar percent={job.progress} />
        ) : (
          <span className={clsx('text-xs font-medium capitalize', STATUS_COLORS[job.status])}>
            {job.status}
          </span>
        )}
      </td>
    </motion.tr>
  );
}

export default function QueueGrid(): JSX.Element {
  const jobs = useQueueStore((s) => s.filteredJobs());
  const { setProgress, setStatus } = useQueueStore();

  useEffect(() => {
    const unlistenProgress = listen<{ jobId: string; percent: number }>(
      'queue://progress',
      (e) => setProgress(e.payload.jobId, e.payload.percent),
    );
    const unlistenStatus = listen<{ jobId: string; status: JobStatus }>(
      'queue://status-change',
      (e) => setStatus(e.payload.jobId, e.payload.status),
    );

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenStatus.then((fn) => fn());
    };
  }, [setProgress, setStatus]);

  return (
    <div className="flex-1 overflow-auto rounded-xl bg-white/5">
      <table className="w-full text-left table-fixed">
        <thead>
          <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-wider sticky top-0 bg-neutral-900/80 backdrop-blur">
            <th className="px-4 py-2 w-10">#</th>
            <th className="px-4 py-2">Filename</th>
            <th className="px-4 py-2">Destination</th>
            <th className="px-4 py-2 w-24">Size</th>
            <th className="px-4 py-2 w-16">Type</th>
            <th className="px-4 py-2 w-32">Status</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-white/30 text-sm">
                  No files in queue. Drop audio or video files above to get started.
                </td>
              </tr>
            ) : (
              jobs.map((job, i) => <JobRow key={job.id} job={job} index={i} />)
            )}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Run tests**

```powershell
npm test 2>&1 | Select-Object -Last 10
```

Expected: All tests pass (no regressions).

- [ ] **Step 3: Commit**

```powershell
git add src/components/QueueGrid.tsx
git commit -m "feat: add progress bar column and queue event subscriptions to QueueGrid"
```

---

## Task 14: Frontend — QueueToolbar Process button

**Files:**
- Modify: `src/components/QueueToolbar.tsx`

- [ ] **Step 1: Replace QueueToolbar.tsx with Process button**

Replace `src/components/QueueToolbar.tsx`:

```typescript
import { useState } from 'react';
import { Play, Search, Trash2 } from 'lucide-react';
import { useQueueStore } from '@/stores/useQueueStore';
import { invokeProcessQueue } from '@/lib/ipc';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'done', label: 'Done' },
  { value: 'error', label: 'Error' },
];

export default function QueueToolbar(): JSX.Element {
  const { filter, searchQuery, setFilter, setSearchQuery, clearQueue, jobs } = useQueueStore();
  const [processing, setProcessing] = useState(false);

  const pendingIds = jobs.filter((j) => j.status === 'pending').map((j) => j.id);

  const handleProcess = async (): Promise<void> => {
    if (pendingIds.length === 0) return;
    setProcessing(true);
    await invokeProcessQueue(pendingIds);
    setProcessing(false);
  };

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
          <option key={f.value} value={f.value} className="bg-neutral-800">
            {f.label}
          </option>
        ))}
      </select>
      <button
        onClick={handleProcess}
        disabled={pendingIds.length === 0 || processing}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
      >
        <Play size={14} />
        {processing ? 'Processing…' : 'Process'}
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

- [ ] **Step 2: Run tests**

```powershell
npm test 2>&1 | Select-Object -Last 10
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```powershell
git add src/components/QueueToolbar.tsx
git commit -m "feat: add Process button to QueueToolbar — dispatches pending jobs to Python"
```

---

## Task 15: Frontend — SetupWizard download wiring

**Files:**
- Modify: `src/components/SetupWizard.tsx`

- [ ] **Step 1: Replace SetupWizard.tsx with real download event wiring**

Replace `src/components/SetupWizard.tsx`:

```typescript
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wand2 } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { invokeSaveSettings, invokeStartModelDownload } from '@/lib/ipc';

export default function SetupWizard(): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const store = useSettingsStore();

  const handleStart = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setProgress(0);

    const unlistenProgress = await listen<{ percent: number }>('wizard://progress', (e) => {
      setProgress(e.payload.percent);
    });

    const unlistenComplete = await listen<Record<string, never>>('wizard://complete', async () => {
      unlistenProgress();
      unlistenComplete();
      store.markSetupComplete();
      await invokeSaveSettings({
        theme: store.theme,
        outputFolder: store.outputFolder,
        language: store.language,
        setupComplete: true,
      });
      setLoading(false);
    });

    const unlistenError = await listen<{ message: string }>('wizard://error', (e) => {
      unlistenProgress();
      unlistenComplete();
      unlistenError();
      setError(e.payload.message);
      setLoading(false);
    });

    const result = await invokeStartModelDownload();
    if (!result.success) {
      unlistenProgress();
      unlistenComplete();
      unlistenError();
      setError(result.error ?? 'Failed to start download.');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-neutral-900 text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6 max-w-sm w-full text-center px-4"
      >
        <div className="p-4 rounded-2xl bg-violet-600/20">
          <Wand2 size={40} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2">Welcome to Enhance Audio Pro</h1>
          <p className="text-white/50 text-sm">AI-powered audio enhancement — fully offline.</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 w-full text-left">
          <h3 className="text-sm font-semibold mb-3">Required AI Models</h3>
          <div className="flex flex-col gap-2 text-xs text-white/60">
            <div className="flex justify-between">
              <span>DeepFilterNet3 (noise removal)</span>
              <span>~65 MB</span>
            </div>
          </div>
          {loading && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-white/40 mb-1">
                <span>Downloading…</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <motion.div
                  className="h-full bg-violet-500 rounded-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}
          {error && (
            <p className="text-xs text-red-400 mt-3">{error}</p>
          )}
        </div>
        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {loading ? 'Setting up…' : 'Get Started'}
        </button>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Run full frontend test suite**

```powershell
npm test 2>&1 | Select-Object -Last 15
```

Expected: All 16+ tests pass, 0 failed.

- [ ] **Step 3: Commit**

```powershell
git add src/components/SetupWizard.tsx
git commit -m "feat: wire SetupWizard to real model download with live progress bar"
```

---

## Task 16: Final integration — run all tests + push

- [ ] **Step 1: Run full Rust test suite**

```powershell
cd src-tauri
cargo test --lib 2>&1 | Select-Object -Last 10
```

Expected: 4 passed, 0 failed.

- [ ] **Step 2: Run full Python test suite**

```powershell
cd ..\backend
pytest tests/ -v 2>&1 | Select-Object -Last 15
```

Expected: 11 passed, 0 failed.

- [ ] **Step 3: Run full frontend test suite**

```powershell
cd ..
npm test 2>&1 | Select-Object -Last 10
```

Expected: All tests pass.

- [ ] **Step 4: Update CLAUDE.md Phase 2 progress section**

In `CLAUDE.md`, update section 13 (Features Progress) — add under "Phase 2":

```markdown
# Phase 2 — Completed Tasks (2026-05-21)
- [x] Task 1: Cargo.toml — add axum 0.7, tokio-net, reqwest 0.12
- [x] Task 2: DB layer — progress/error_message migration, get_job_by_id, update_job_status, update_job_error (4 Rust unit tests)
- [x] Task 3: Rust callback server — axum, 3 POST handlers (progress, status, wizard)
- [x] Task 4: lib.rs + sidecar wiring — AppState gains callback_port, callback server spawned, CALLBACK_PORT passed to Python
- [x] Task 5: process_queue + start_model_download commands — fire-and-forget to Python backend
- [x] Task 6: Python requirements + test conftest (mocks torch/df)
- [x] Task 7: enhance_speech.py — lazy DeepFilterNet3 loader, CUDA→CPU fallback (4 pytest tests)
- [x] Task 8: /enhance endpoint — BackgroundTask serial job processing (3 pytest tests)
- [x] Task 9: /wizard/download endpoint — streaming HuggingFace download (2 pytest tests)
- [x] Task 10: main.py — all Phase 2 routers registered; 11/11 pytest passing
- [x] Task 11: QueueJob type (progress, error_message) + useQueueStore (setProgress, setStatus) — 7/7 Vitest tests
- [x] Task 12: IPC wrappers — invokeProcessQueue, invokeStartModelDownload
- [x] Task 13: QueueGrid — progress bar column, queue://progress and queue://status-change subscriptions
- [x] Task 14: QueueToolbar — Process button dispatches pending jobs
- [x] Task 15: SetupWizard — wired to real download with progress bar and error recovery
```

- [ ] **Step 5: Final commit and push**

```powershell
git add CLAUDE.md
git commit -m "chore: mark Phase 2 complete in CLAUDE.md"
git push origin master
```

---

## Self-Review

**Spec coverage check:**

| Spec deliverable | Task |
|---|---|
| Rust callback server (axum) | Task 3, 4 |
| CALLBACK_PORT env var to sidecar | Task 4 |
| `process_queue` Tauri command | Task 4 (stub), 5 (full) |
| `start_model_download` Tauri command | Task 4 (stub), 5 (full) |
| SQLite migration: progress, error_message | Task 2 |
| enhance_speech.py (DeepFilterNet3, CUDA→CPU) | Task 7 |
| /enhance endpoint | Task 8 |
| /wizard/download + HuggingFace download | Task 9 |
| requirements.txt updated | Task 6 |
| useQueueStore setProgress, setStatus | Task 11 |
| QueueGrid progress bar + event subscriptions | Task 13 |
| QueueToolbar Process button | Task 14 |
| SetupWizard download wiring | Task 15 |
| All tests passing | Task 16 |

All 13 spec deliverables covered. ✓

**Placeholder scan:** No TBD, TODO, or "similar to" references found. Every step contains exact code. ✓

**Type consistency:**
- `QueueJob.progress: number` (TS) ↔ `QueueJob.progress: i64` (Rust) ↔ `progress INTEGER` (SQLite) ✓
- `QueueJob.error_message: string | null` (TS) ↔ `Option<String>` (Rust) ↔ `TEXT` nullable (SQLite) ✓
- `invokeProcessQueue(jobIds: string[])` in ipc.ts ↔ `process_queue(job_ids: Vec<String>)` in Rust ✓
- `invokeStartModelDownload()` in ipc.ts ↔ `start_model_download()` in Rust ✓
- `queue://progress { jobId, percent }` in callback/mod.rs ↔ `listen<{ jobId; percent }>` in QueueGrid.tsx ✓
- `queue://status-change { jobId, status }` ↔ `listen<{ jobId; status: JobStatus }>` in QueueGrid.tsx ✓
- `wizard://progress { percent }` ↔ `listen<{ percent }>` in SetupWizard.tsx ✓
- `wizard://complete {}` / `wizard://error { message }` ↔ SetupWizard.tsx listeners ✓
