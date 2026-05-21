# Phase 4 — Packaging, ffmpeg Conversion, Batch Limits & Output Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add output format selection (per-file and global), ffmpeg-based audio conversion, batch queue limits (30 audio / 10 video), and PyInstaller + Tauri installer packaging for Windows.

**Architecture:** Four interdependent subsystems sharing one data layer: (1) `output_format` column in SQLite drives a new `/convert` Python endpoint and two new Rust commands; (2) batch limits enforced at `add_files` time via DB count queries; (3) PyInstaller bundles the Python backend into a single `.exe` sidecar; (4) Tauri `bundle` config targets MSI for the Windows installer.

**Tech Stack:** Python `subprocess` (ffmpeg binary), FastAPI BackgroundTasks, httpx, rusqlite ALTER TABLE, Tauri v2 (reqwest, sync commands), React/TypeScript (Zustand, lucide-react), PyInstaller 6.x

---

## File Map

**New files — Python**
- `backend/processors/convert_audio.py` — ffmpeg subprocess wrapper, `convert_file()`
- `backend/routers/convert.py` — `POST /convert` with BackgroundTasks
- `backend/tests/test_convert_audio.py` — 4 unit tests (TDD)
- `backend/tests/test_convert_endpoint.py` — 3 endpoint tests (TDD)
- `backend/build.spec` — PyInstaller one-file spec

**Modified files — Python**
- `backend/main.py` — add convert router (6 total)

**New files — Rust**
- `src-tauri/src/commands/convert.rs` — `convert_files` + `set_output_format`

**Modified files — Rust**
- `src-tauri/src/db/migrations.rs` — idempotent ALTER TABLE for output_format
- `src-tauri/src/db/queue.rs` — output_format in QueueJob, two new DB fns
- `src-tauri/src/commands/mod.rs` — `pub mod convert`
- `src-tauri/src/commands/queue.rs` — batch limit enforcement in add_files
- `src-tauri/src/lib.rs` — register convert_files + set_output_format
- `src-tauri/tauri.conf.json` — bundle targets MSI

**Modified files — Frontend**
- `src/types/queue.ts` — add `output_format: string`
- `src/stores/useQueueStore.ts` — add `setOutputFormat`, fix `JobStatus` import
- `src/lib/ipc.ts` — add `invokeConvertFiles`, `invokeSetOutputFormat`
- `src/components/QueueGrid.tsx` — Output Format column with per-row `<select>`
- `src/components/QueueToolbar.tsx` — global format override + Convert button

**New files — Build**
- `scripts/build-backend.bat` — one-command PyInstaller build + copy to binaries

---

## Task 1: DB + Rust + Frontend types — add output_format

**Files:**
- Modify: `src-tauri/src/db/migrations.rs`
- Modify: `src-tauri/src/db/queue.rs`
- Modify: `src/types/queue.ts`
- Modify: `src/stores/useQueueStore.ts`

- [ ] **Step 1: Update migrations.rs — add output_format column**

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
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN error_message TEXT;",
    );
    // Phase 4: per-job output format selection
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN output_format TEXT NOT NULL DEFAULT 'wav';",
    );
    Ok(())
}
```

- [ ] **Step 2: Update queue.rs — output_format in struct, all queries, two new fns**

Replace `src-tauri/src/db/queue.rs`:

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
    pub output_format: String,
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
            (id, filename, filepath, destination, size_bytes, media_type, status, output_format, created_at, updated_at)
         VALUES (?1, ?2, ?3, '', ?4, ?5, 'pending', 'wav', ?6, ?7)",
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
        output_format: "wav".to_string(),
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn get_all_jobs(conn: &Connection) -> Result<Vec<QueueJob>> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, filepath, destination, size_bytes, media_type, status,
                progress, error_message, output_format, created_at, updated_at
         FROM queue_jobs ORDER BY created_at ASC",
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
                output_format: row.get::<_, Option<String>>(9)?
                    .unwrap_or_else(|| "wav".to_string()),
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    Ok(jobs)
}

pub fn get_job_by_id(conn: &Connection, id: &str) -> Result<Option<QueueJob>> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, filepath, destination, size_bytes, media_type, status,
                progress, error_message, output_format, created_at, updated_at
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
            output_format: row.get::<_, Option<String>>(9)?
                .unwrap_or_else(|| "wav".to_string()),
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
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

pub fn update_job_output_format(conn: &Connection, id: &str, format: &str) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE queue_jobs SET output_format = ?1, updated_at = ?2 WHERE id = ?3",
        params![format, now, id],
    )?;
    Ok(())
}

pub fn count_active_jobs_by_type(conn: &Connection, media_type: &str) -> Result<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM queue_jobs
         WHERE status IN ('pending', 'processing') AND media_type = ?1",
        [media_type],
        |r| r.get(0),
    )
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
        assert_eq!(found.output_format, "wav");
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

    #[test]
    fn test_update_job_output_format() {
        let conn = setup();
        let job = insert_job(&conn, "/tmp/d.wav", "d.wav", 100, "audio").unwrap();
        assert_eq!(job.output_format, "wav");
        update_job_output_format(&conn, &job.id, "mp3").unwrap();
        let found = get_job_by_id(&conn, &job.id).unwrap().unwrap();
        assert_eq!(found.output_format, "mp3");
    }

    #[test]
    fn test_count_active_jobs_by_type() {
        let conn = setup();
        insert_job(&conn, "/tmp/a.mp3", "a.mp3", 100, "audio").unwrap();
        insert_job(&conn, "/tmp/b.mp3", "b.mp3", 100, "audio").unwrap();
        insert_job(&conn, "/tmp/v.mp4", "v.mp4", 100, "video").unwrap();
        let audio = count_active_jobs_by_type(&conn, "audio").unwrap();
        let video = count_active_jobs_by_type(&conn, "video").unwrap();
        assert_eq!(audio, 2);
        assert_eq!(video, 1);
    }
}
```

- [ ] **Step 3: cargo check — must pass clean**

```powershell
cd "D:\vibe coding\app enhance audio pro\src-tauri"
$env:CARGO_TARGET_DIR = "D:\cargo_build\enhance-audio-pro"
cargo check 2>&1 | Select-Object -Last 8
```

Expected: `Finished` with no errors.

- [ ] **Step 4: Update src/types/queue.ts**

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
  output_format: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 5: Update src/stores/useQueueStore.ts — add setOutputFormat + fix import**

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
  filteredJobs: () => QueueJob[];
  setProgress: (id: string, percent: number) => void;
  setStatus: (id: string, status: JobStatus, errorMessage?: string) => void;
  setOutputFormat: (id: string, format: string) => void;
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
  filteredJobs: () => {
    const { jobs, filter, searchQuery } = get();
    return jobs
      .filter((j) => filter === 'all' || j.status === filter)
      .filter((j) => !searchQuery || j.filename.toLowerCase().includes(searchQuery.toLowerCase()));
  },
  setProgress: (id, percent) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, progress: percent } : j)),
    })),
  setStatus: (id, status, errorMessage) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id ? { ...j, status, error_message: errorMessage ?? j.error_message } : j
      ),
    })),
  setOutputFormat: (id, format) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, output_format: format } : j)),
    })),
}));
```

- [ ] **Step 6: Update store test fixture — add output_format to every mock QueueJob**

Open `src/stores/useQueueStore.test.ts`. Find every object literal that satisfies `QueueJob` and add `output_format: 'wav'` to it. Then add one new test after the existing `setStatus` test:

```typescript
it('setOutputFormat updates output_format for the matching job', () => {
  const job: QueueJob = {
    id: 'job-1', filename: 'a.mp3', filepath: '/a.mp3', destination: '',
    size_bytes: 100, media_type: 'audio', status: 'pending', progress: 0,
    error_message: null, output_format: 'wav', created_at: '', updated_at: '',
  };
  useQueueStore.getState().setJobs([job]);
  useQueueStore.getState().setOutputFormat('job-1', 'mp3');
  expect(useQueueStore.getState().jobs[0].output_format).toBe('mp3');
});
```

- [ ] **Step 7: Run frontend tests — all passing**

```powershell
cd "D:\vibe coding\app enhance audio pro"
npm test 2>&1 | Select-Object -Last 8
```

Expected: 20+ passed, 0 failed.

- [ ] **Step 8: Commit**

```powershell
cd "D:\vibe coding\app enhance audio pro"
git add src-tauri/src/db/migrations.rs src-tauri/src/db/queue.rs src/types/queue.ts src/stores/useQueueStore.ts
git commit -m "feat: add output_format to DB, Rust QueueJob, and frontend store with setOutputFormat action"
```

---

## Task 2: Python — ffmpeg conversion processor (TDD)

**Files:**
- Create: `backend/processors/convert_audio.py`
- Create: `backend/tests/test_convert_audio.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_convert_audio.py`:

```python
from unittest.mock import MagicMock, patch
import pytest


@pytest.fixture(autouse=True)
def reload_module():
    import sys
    sys.modules.pop("processors.convert_audio", None)
    yield
    sys.modules.pop("processors.convert_audio", None)


def _ok():
    m = MagicMock()
    m.returncode = 0
    m.stderr = ""
    return m


def _fail():
    m = MagicMock()
    m.returncode = 1
    m.stderr = "No such file or directory"
    return m


def test_progress_cb_called_at_10_and_100(tmp_path):
    with patch("subprocess.run", return_value=_ok()):
        from processors.convert_audio import convert_file
        calls = []
        convert_file("/in.mp3", str(tmp_path / "out.wav"), calls.append)
    assert 10 in calls
    assert 100 in calls
    assert calls[-1] == 100


def test_raises_on_ffmpeg_nonzero_exit(tmp_path):
    with patch("subprocess.run", return_value=_fail()):
        from processors.convert_audio import convert_file
        with pytest.raises(RuntimeError, match="ffmpeg failed"):
            convert_file("/in.mp3", str(tmp_path / "out.wav"), lambda _: None)


def test_ffmpeg_called_with_input_and_output(tmp_path):
    with patch("subprocess.run", return_value=_ok()) as mock_run:
        from processors.convert_audio import convert_file
        out = str(tmp_path / "out.mp3")
        convert_file("/audio/song.wav", out, lambda _: None)
    cmd = mock_run.call_args[0][0]
    assert "/audio/song.wav" in cmd
    assert out in cmd
    assert "-y" in cmd


def test_supported_formats_includes_common_types():
    from processors.convert_audio import SUPPORTED_FORMATS
    for fmt in ["mp3", "wav", "flac", "aac", "ogg", "mp4"]:
        assert fmt in SUPPORTED_FORMATS
```

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
cd "D:\vibe coding\app enhance audio pro\backend"
& ".venv\Scripts\python.exe" -m pytest tests/test_convert_audio.py -v 2>&1 | Select-Object -Last 6
```

Expected: `ModuleNotFoundError: No module named 'processors.convert_audio'`

- [ ] **Step 3: Create backend/processors/convert_audio.py**

```python
import pathlib
import subprocess
import sys
from typing import Callable

SUPPORTED_FORMATS = [
    "mp3", "wav", "flac", "aac", "ogg", "opus", "m4a", "wma",
    "aiff", "mp4", "mkv", "avi", "mov", "webm", "m4v", "flv",
]


def _ffmpeg_exe() -> str:
    if getattr(sys, "frozen", False):
        bundled = pathlib.Path(sys.executable).parent / "ffmpeg.exe"
        if bundled.exists():
            return str(bundled)
    return "ffmpeg"


def convert_file(
    input_path: str,
    output_path: str,
    progress_cb: Callable[[int], None],
) -> None:
    progress_cb(10)
    result = subprocess.run(
        [_ffmpeg_exe(), "-y", "-i", input_path, "-vn", output_path],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.strip()}")
    progress_cb(100)
```

- [ ] **Step 4: Run tests — expect PASS**

```powershell
& ".venv\Scripts\python.exe" -m pytest tests/test_convert_audio.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```powershell
cd "D:\vibe coding\app enhance audio pro"
git add backend/processors/convert_audio.py backend/tests/test_convert_audio.py
git commit -m "feat: add ffmpeg conversion processor with subprocess wrapper (4 tests)"
```

---

## Task 3: Python — /convert endpoint (TDD) + main.py

**Files:**
- Create: `backend/routers/convert.py`
- Create: `backend/tests/test_convert_endpoint.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write failing endpoint tests**

Create `backend/tests/test_convert_endpoint.py`:

```python
async def test_convert_returns_202():
    from main import app
    from httpx import AsyncClient, ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/convert", json={
            "job_ids": ["test-job-1"],
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.status_code == 202


async def test_convert_returns_processing_started_detail():
    from main import app
    from httpx import AsyncClient, ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/convert", json={
            "job_ids": ["test-job-1"],
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.json()["detail"] == "Processing started."


async def test_convert_with_empty_job_ids_returns_202():
    from main import app
    from httpx import AsyncClient, ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/convert", json={
            "job_ids": [],
            "callback_url": "http://127.0.0.1:9999",
        })
    assert resp.status_code == 202
```

- [ ] **Step 2: Run tests — expect FAIL (404)**

```powershell
cd "D:\vibe coding\app enhance audio pro\backend"
& ".venv\Scripts\python.exe" -m pytest tests/test_convert_endpoint.py -v 2>&1 | Select-Object -Last 6
```

Expected: `assert 404 == 202`

- [ ] **Step 3: Create backend/routers/convert.py**

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

from processors.convert_audio import convert_file

router = APIRouter()


class ConvertRequest(BaseModel):
    job_ids: List[str]
    callback_url: str


@router.post("/convert")
async def convert_jobs(req: ConvertRequest, background_tasks: BackgroundTasks) -> JSONResponse:
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
                "SELECT filepath, destination, filename, output_format FROM queue_jobs WHERE id = ?",
                (job_id,),
            ).fetchone()
            conn.close()

            if row is None:
                continue

            filepath, destination, filename, output_format = row
            output_format = output_format or "wav"
            stem = pathlib.Path(filename).stem
            out_dir = pathlib.Path(destination) if destination else pathlib.Path(filepath).parent
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"{stem}_converted.{output_format}"

            def _sync_convert(src: str, dst: str, jid: str) -> None:
                def _cb(pct: int) -> None:
                    httpx.post(
                        f"{callback_url}/callback/progress",
                        json={"job_id": jid, "percent": pct},
                        timeout=5,
                    )
                convert_file(src, dst, _cb)

            await loop.run_in_executor(
                None, lambda: _sync_convert(filepath, str(out_path), job_id)
            )

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
                        json={"job_id": job_id, "status": "error", "error_message": str(exc)},
                    )
            except Exception:
                pass
```

- [ ] **Step 4: Update backend/main.py — add convert router**

Replace `backend/main.py`:

```python
import os
import uvicorn
from fastapi import FastAPI
from routers import convert, enhance, health, queue, separate, wizard

app = FastAPI(title="Enhance Audio Pro Backend", version="0.1.0")
app.include_router(health.router)
app.include_router(queue.router)
app.include_router(enhance.router)
app.include_router(wizard.router)
app.include_router(separate.router)
app.include_router(convert.router)

if __name__ == "__main__":
    port = int(os.environ.get("BACKEND_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
```

- [ ] **Step 5: Run endpoint tests — expect PASS**

```powershell
& ".venv\Scripts\python.exe" -m pytest tests/test_convert_endpoint.py -v
```

Expected: 3 passed.

- [ ] **Step 6: Run full Python suite — expect 25 passed**

```powershell
& ".venv\Scripts\python.exe" -m pytest tests/ -v 2>&1 | Select-Object -Last 10
```

Expected: 25 passed (18 prior + 4 processor + 3 endpoint), 0 failed.

- [ ] **Step 7: Commit**

```powershell
cd "D:\vibe coding\app enhance audio pro"
git add backend/routers/convert.py backend/tests/test_convert_endpoint.py backend/main.py
git commit -m "feat: add /convert endpoint wired to ffmpeg processor (25 pytest passing)"
```

---

## Task 4: Rust — convert_files + set_output_format commands

**Files:**
- Create: `src-tauri/src/commands/convert.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create commands/convert.rs**

Create `src-tauri/src/commands/convert.rs`:

```rust
use serde_json::json;
use tauri::{AppHandle, Emitter, State};

use crate::commands::IpcResponse;
use crate::db::queue as db_queue;
use crate::AppState;

#[tauri::command]
pub fn convert_files(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    job_ids: Vec<String>,
) -> IpcResponse<()> {
    if job_ids.is_empty() {
        return IpcResponse { success: true, data: Some(()), error: None };
    }

    let backend_port = state.backend_port;
    let callback_port = state.callback_port;

    let updated_ids: Vec<String> = {
        let conn = match state.db.lock() {
            Ok(c) => c,
            Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
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
        let url = format!("http://127.0.0.1:{}/convert", backend_port);
        let _ = reqwest::Client::new().post(&url).json(&payload).send().await;
    });

    IpcResponse { success: true, data: Some(()), error: None }
}

#[tauri::command]
pub fn set_output_format(
    state: State<'_, AppState>,
    job_id: String,
    format: String,
) -> IpcResponse<()> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };
    match db_queue::update_job_output_format(&conn, &job_id, &format) {
        Ok(()) => IpcResponse { success: true, data: Some(()), error: None },
        Err(e) => IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    }
}
```

- [ ] **Step 2: Update commands/mod.rs**

Replace `src-tauri/src/commands/mod.rs`:

```rust
pub mod convert;
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

- [ ] **Step 3: Update lib.rs — register both new commands**

Replace `src-tauri/src/lib.rs`:

```rust
use std::sync::{Arc, Mutex};
use tauri::Manager;

mod callback;
mod commands;
mod db;
mod sidecar;

use commands::convert::{convert_files, set_output_format};
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

            app.manage(AppState { db, backend_port, callback_port });

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
            convert_files,
            set_output_format,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: cargo check — must pass clean**

```powershell
cd "D:\vibe coding\app enhance audio pro\src-tauri"
$env:CARGO_TARGET_DIR = "D:\cargo_build\enhance-audio-pro"
cargo check 2>&1 | Select-Object -Last 8
```

Expected: `Finished` with no errors.

- [ ] **Step 5: Commit**

```powershell
cd "D:\vibe coding\app enhance audio pro"
git add src-tauri/src/commands/convert.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add convert_files and set_output_format Tauri commands"
```

---

## Task 5: Frontend — output format selector UI + IPC wrappers

**Files:**
- Modify: `src/lib/ipc.ts`
- Modify: `src/components/QueueGrid.tsx`
- Modify: `src/components/QueueToolbar.tsx`

- [ ] **Step 1: Add IPC wrappers to ipc.ts**

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

export async function invokeConvertFiles(jobIds: string[]): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('convert_files', { jobIds });
}

export async function invokeSetOutputFormat(jobId: string, format: string): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('set_output_format', { jobId, format });
}
```

- [ ] **Step 2: Replace QueueGrid.tsx — add Output Format column**

Replace `src/components/QueueGrid.tsx`:

```typescript
import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useQueueStore } from '@/stores/useQueueStore';
import { invokeSetOutputFormat } from '@/lib/ipc';
import type { QueueJob, JobStatus } from '@/types/queue';

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: 'text-yellow-400',
  processing: 'text-blue-400',
  done: 'text-green-400',
  error: 'text-red-400',
};

const FORMAT_OPTIONS = ['wav', 'mp3', 'flac', 'aac', 'ogg', 'opus', 'm4a'];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function ProgressBar({ percent }: { percent: number }): JSX.Element {
  return (
    <div className="mt-1 h-1 w-full rounded-full bg-white/10 overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-blue-400"
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </div>
  );
}

function FormatSelect({ job }: { job: QueueJob }): JSX.Element {
  const setOutputFormat = useQueueStore((s) => s.setOutputFormat);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>): Promise<void> {
    const fmt = e.target.value;
    setOutputFormat(job.id, fmt);
    await invokeSetOutputFormat(job.id, fmt);
  }

  return (
    <select
      value={job.output_format}
      onChange={handleChange}
      disabled={job.status !== 'pending'}
      className="bg-white/10 text-white text-xs rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-40 transition"
    >
      {FORMAT_OPTIONS.map((f) => (
        <option key={f} value={f} className="bg-neutral-800">
          {f.toUpperCase()}
        </option>
      ))}
    </select>
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
      <td className="px-4 py-2 text-sm text-white truncate max-w-[180px]">{job.filename}</td>
      <td className="px-4 py-2 text-xs text-white/50 truncate max-w-[130px]">{job.destination || '—'}</td>
      <td className="px-4 py-2 text-xs text-white/50 w-20">{formatBytes(job.size_bytes)}</td>
      <td className="px-4 py-2 text-xs uppercase text-white/40 w-16">{job.media_type}</td>
      <td className="px-4 py-2 w-28">
        <FormatSelect job={job} />
      </td>
      <td className={clsx('px-4 py-2 text-xs font-medium capitalize w-36', STATUS_COLORS[job.status])}>
        <span title={job.status === 'error' ? (job.error_message ?? undefined) : undefined}>
          {job.status}
        </span>
        {job.status === 'processing' && <ProgressBar percent={job.progress} />}
      </td>
    </motion.tr>
  );
}

export default function QueueGrid(): JSX.Element {
  const jobs = useQueueStore((s) => s.filteredJobs());
  const setProgress = useQueueStore((s) => s.setProgress);
  const setStatus = useQueueStore((s) => s.setStatus);

  useEffect(() => {
    const unlistenProgress = listen<{ jobId: string; percent: number }>(
      'queue://progress',
      (event) => setProgress(event.payload.jobId, event.payload.percent)
    );
    const unlistenStatus = listen<{ jobId: string; status: string; error_message?: string }>(
      'queue://status-change',
      (event) => {
        const { jobId, status, error_message } = event.payload;
        setStatus(jobId, status as JobStatus, error_message);
      }
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
            <th className="px-4 py-2 w-20">Size</th>
            <th className="px-4 py-2 w-16">Type</th>
            <th className="px-4 py-2 w-28">Output</th>
            <th className="px-4 py-2 w-36">Status</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-white/30 text-sm">
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

- [ ] **Step 3: Replace QueueToolbar.tsx — add global format selector + Convert button**

Replace `src/components/QueueToolbar.tsx`:

```typescript
import { useState } from 'react';
import { Play, Scissors, Search, Trash2, RefreshCw } from 'lucide-react';
import { useQueueStore } from '@/stores/useQueueStore';
import {
  invokeProcessQueue,
  invokeSeparateStems,
  invokeConvertFiles,
  invokeSetOutputFormat,
} from '@/lib/ipc';

const FILTERS = [
  { value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' }, { value: 'done', label: 'Done' },
  { value: 'error', label: 'Error' },
];

const FORMAT_OPTIONS = ['wav', 'mp3', 'flac', 'aac', 'ogg', 'opus', 'm4a'];

export default function QueueToolbar(): JSX.Element {
  const { filter, searchQuery, setFilter, setSearchQuery, clearQueue, jobs, setOutputFormat } =
    useQueueStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSeparating, setIsSeparating] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [globalFormat, setGlobalFormat] = useState('wav');

  const pendingIds = jobs.filter((j) => j.status === 'pending').map((j) => j.id);
  const busy = isProcessing || isSeparating || isConverting;
  const canAct = pendingIds.length > 0 && !busy;

  async function handleProcess(): Promise<void> {
    if (!canAct) return;
    setIsProcessing(true);
    try { await invokeProcessQueue(pendingIds); } finally { setIsProcessing(false); }
  }

  async function handleSeparate(): Promise<void> {
    if (!canAct) return;
    setIsSeparating(true);
    try { await invokeSeparateStems(pendingIds); } finally { setIsSeparating(false); }
  }

  async function handleConvert(): Promise<void> {
    if (!canAct) return;
    setIsConverting(true);
    try { await invokeConvertFiles(pendingIds); } finally { setIsConverting(false); }
  }

  async function handleApplyFormat(): Promise<void> {
    const pendingJobs = jobs.filter((j) => j.status === 'pending');
    await Promise.all(
      pendingJobs.map((j) => {
        setOutputFormat(j.id, globalFormat);
        return invokeSetOutputFormat(j.id, globalFormat);
      })
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0 flex-wrap">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 pr-3 py-1.5 bg-white/10 rounded-lg text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-violet-500 transition w-40"
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
      <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
        <span className="text-white/40 text-xs">All→</span>
        <select
          value={globalFormat}
          onChange={(e) => setGlobalFormat(e.target.value)}
          className="bg-transparent text-white text-xs outline-none"
        >
          {FORMAT_OPTIONS.map((f) => (
            <option key={f} value={f} className="bg-neutral-800">{f.toUpperCase()}</option>
          ))}
        </select>
        <button
          onClick={handleApplyFormat}
          disabled={pendingIds.length === 0}
          title="Apply format to all pending files"
          className="text-white/60 hover:text-white disabled:opacity-40 transition"
        >
          <RefreshCw size={12} />
        </button>
      </div>
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
        onClick={handleConvert}
        disabled={!canAct}
        title="Convert pending files to selected output format"
        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white"
      >
        <RefreshCw size={14} />
        {isConverting ? 'Converting…' : 'Convert'}
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

- [ ] **Step 4: Run frontend tests — all passing**

```powershell
cd "D:\vibe coding\app enhance audio pro"
npm test 2>&1 | Select-Object -Last 8
```

Expected: 20+ passed, 0 failed.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/ipc.ts src/components/QueueGrid.tsx src/components/QueueToolbar.tsx
git commit -m "feat: add output format selector per-file and global batch override with Convert button"
```

---

## Task 6: Batch limits enforcement in add_files

**Files:**
- Modify: `src-tauri/src/commands/queue.rs`

- [ ] **Step 1: Replace queue.rs with batch-limit enforcement**

Replace `src-tauri/src/commands/queue.rs`:

```rust
use std::path::Path;
use tauri::State;

use crate::commands::IpcResponse;
use crate::db::queue::{count_active_jobs_by_type, get_all_jobs, insert_job, QueueJob};
use crate::AppState;

const MAX_AUDIO: i64 = 30;
const MAX_VIDEO: i64 = 10;
const VIDEO_EXTENSIONS: &[&str] = &["mp4", "mov", "avi", "mkv", "webm", "flv", "wmv", "m4v"];

#[tauri::command]
pub fn add_files(state: State<AppState>, paths: Vec<String>) -> IpcResponse<Vec<QueueJob>> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };

    let mut audio_count = count_active_jobs_by_type(&conn, "audio").unwrap_or(0);
    let mut video_count = count_active_jobs_by_type(&conn, "video").unwrap_or(0);

    let mut jobs = Vec::new();
    let mut rejected: usize = 0;

    for path_str in &paths {
        let path = Path::new(path_str);

        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let size_bytes = std::fs::metadata(path).map(|m| m.len() as i64).unwrap_or(0);

        let media_type = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|ext| {
                if VIDEO_EXTENSIONS.contains(&ext.to_lowercase().as_str()) { "video" } else { "audio" }
            })
            .unwrap_or("audio");

        let at_limit = if media_type == "video" {
            video_count >= MAX_VIDEO
        } else {
            audio_count >= MAX_AUDIO
        };

        if at_limit {
            rejected += 1;
            continue;
        }

        match insert_job(&conn, path_str, &filename, size_bytes, media_type) {
            Ok(job) => {
                if media_type == "video" { video_count += 1; } else { audio_count += 1; }
                jobs.push(job);
            }
            Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
        }
    }

    let warning = if rejected > 0 {
        Some(format!(
            "{} file(s) not added — batch limit reached (max {} audio, {} video active at once).",
            rejected, MAX_AUDIO, MAX_VIDEO
        ))
    } else {
        None
    };

    IpcResponse { success: true, data: Some(jobs), error: warning }
}

#[tauri::command]
pub fn get_queue(state: State<AppState>) -> IpcResponse<Vec<QueueJob>> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(e) => return IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    };

    match get_all_jobs(&conn) {
        Ok(jobs) => IpcResponse { success: true, data: Some(jobs), error: None },
        Err(e) => IpcResponse { success: false, data: None, error: Some(e.to_string()) },
    }
}
```

- [ ] **Step 2: cargo check — must pass clean**

```powershell
cd "D:\vibe coding\app enhance audio pro\src-tauri"
$env:CARGO_TARGET_DIR = "D:\cargo_build\enhance-audio-pro"
cargo check 2>&1 | Select-Object -Last 8
```

Expected: `Finished` with no errors.

- [ ] **Step 3: Show rejection warning in DropZone**

Open `src/components/DropZone.tsx`. Find where `invokeAddFiles` is called and `addJobs` receives the result. Add a `limitWarning` state and render it below the drop zone.

Find the `invokeAddFiles` call block and replace it with:

```typescript
const result = await invokeAddFiles(validPaths);
if (result.success && result.data) {
  addJobs(result.data);
}
if (result.error) {
  setLimitWarning(result.error);
  setTimeout(() => setLimitWarning(null), 5000);
}
```

At the top of the component function, add:

```typescript
const [limitWarning, setLimitWarning] = useState<string | null>(null);
```

In the JSX return, add directly after the outermost drop-zone `<div>`:

```tsx
{limitWarning && (
  <p className="mt-2 px-3 py-2 bg-orange-500/20 border border-orange-500/40 rounded-lg text-orange-300 text-xs text-center">
    {limitWarning}
  </p>
)}
```

- [ ] **Step 4: Run frontend tests — all passing**

```powershell
cd "D:\vibe coding\app enhance audio pro"
npm test 2>&1 | Select-Object -Last 8
```

Expected: all prior tests passing, 0 failed.

- [ ] **Step 5: Commit**

```powershell
cd "D:\vibe coding\app enhance audio pro"
git add src-tauri/src/commands/queue.rs src/components/DropZone.tsx
git commit -m "feat: enforce 30 audio / 10 video batch limits in add_files with rejection warning"
```

---

## Task 7: PyInstaller build spec + build script

**Files:**
- Create: `backend/build.spec`
- Create: `scripts/build-backend.bat`

- [ ] **Step 1: Create backend/build.spec**

Create `backend/build.spec`:

```python
# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all, collect_data_files, collect_submodules

torch_datas, torch_binaries, torch_hidden = collect_all('torch')
torchaudio_datas, torchaudio_binaries, torchaudio_hidden = collect_all('torchaudio')
demucs_datas, demucs_binaries, demucs_hidden = collect_all('demucs')

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=torch_binaries + torchaudio_binaries + demucs_binaries,
    datas=(
        torch_datas + torchaudio_datas + demucs_datas
        + collect_data_files('df')
        + collect_data_files('scipy')
    ),
    hiddenimports=(
        torch_hidden + torchaudio_hidden + demucs_hidden
        + collect_submodules('df')
        + collect_submodules('numpy')
        + collect_submodules('scipy')
        + [
            'uvicorn.logging', 'uvicorn.loops', 'uvicorn.loops.auto',
            'uvicorn.protocols', 'uvicorn.protocols.http',
            'uvicorn.protocols.http.auto',
            'uvicorn.protocols.websockets',
            'uvicorn.protocols.websockets.auto',
            'uvicorn.lifespan', 'uvicorn.lifespan.on',
            'multipart', 'python_multipart',
            'einops', 'julius', 'soundfile',
        ]
    ),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'IPython', 'jupyter', 'notebook'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
```

- [ ] **Step 2: Create scripts/ directory and build-backend.bat**

```powershell
New-Item -ItemType Directory -Force "D:\vibe coding\app enhance audio pro\scripts"
```

Create `scripts/build-backend.bat`:

```bat
@echo off
setlocal

set ROOT=%~dp0..
set BACKEND_DIR=%ROOT%\backend
set BINARIES_DIR=%ROOT%\src-tauri\binaries

echo [1/4] Activating Python venv...
call "%BACKEND_DIR%\.venv\Scripts\activate.bat"
if errorlevel 1 (echo ERROR: venv not found at %BACKEND_DIR%\.venv & exit /b 1)

echo [2/4] Installing PyInstaller...
pip install pyinstaller --quiet

echo [3/4] Building backend.exe with PyInstaller...
cd /d "%BACKEND_DIR%"
pyinstaller build.spec --distpath dist --workpath build_work --clean
if errorlevel 1 (echo ERROR: PyInstaller build failed. & exit /b 1)

echo [4/4] Copying to Tauri binaries...
copy /Y "dist\backend.exe" "%BINARIES_DIR%\backend-x86_64-pc-windows-gnu.exe"
if errorlevel 1 (echo ERROR: Copy failed. & exit /b 1)

echo.
echo Build complete. Run 'npm run tauri build' next to produce the MSI installer.
endlocal
```

- [ ] **Step 3: Verify files exist**

```powershell
Get-Item "D:\vibe coding\app enhance audio pro\backend\build.spec"
Get-Item "D:\vibe coding\app enhance audio pro\scripts\build-backend.bat"
```

Expected: both items found.

- [ ] **Step 4: Commit**

```powershell
cd "D:\vibe coding\app enhance audio pro"
git add backend/build.spec scripts/build-backend.bat
git commit -m "feat: add PyInstaller build.spec and build-backend.bat for sidecar packaging"
```

---

## Task 8: Tauri bundle config for MSI

**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Read current bundle section**

```powershell
Get-Content "D:\vibe coding\app enhance audio pro\src-tauri\tauri.conf.json"
```

- [ ] **Step 2: Ensure bundle section targets MSI**

In `src-tauri/tauri.conf.json`, locate the `"bundle"` object and confirm or set the following fields (preserve all other existing fields):

```json
"bundle": {
  "active": true,
  "targets": ["msi"],
  "identifier": "com.enhanceaudiopro.app",
  "externalBin": ["binaries/backend"]
}
```

If `"targets"` already exists and is `"all"` or an array, replace with `["msi"]`.
If `"externalBin"` already has `"binaries/backend"`, do not duplicate it.

- [ ] **Step 3: cargo check — confirm JSON is valid**

```powershell
cd "D:\vibe coding\app enhance audio pro\src-tauri"
$env:CARGO_TARGET_DIR = "D:\cargo_build\enhance-audio-pro"
cargo check 2>&1 | Select-Object -Last 5
```

Expected: `Finished` with no errors. If Tauri rejects the config, fix the JSON syntax and re-run.

- [ ] **Step 4: Commit**

```powershell
cd "D:\vibe coding\app enhance audio pro"
git add src-tauri/tauri.conf.json
git commit -m "chore: set Tauri bundle target to MSI for Windows installer packaging"
```

---

## Task 9: Integration — full suites + CLAUDE.md + PRD + push

**Files:**
- Modify: `CLAUDE.md`
- Modify: `PRD_Enhance_Audio_Pro.txt`

- [ ] **Step 1: Run full Python suite**

```powershell
cd "D:\vibe coding\app enhance audio pro\backend"
& ".venv\Scripts\python.exe" -m pytest tests/ -v 2>&1 | Select-Object -Last 12
```

Expected: 25 passed, 0 failed.

- [ ] **Step 2: Run full frontend suite**

```powershell
cd "D:\vibe coding\app enhance audio pro"
npm test 2>&1 | Select-Object -Last 8
```

Expected: 20+ passed, 0 failed.

- [ ] **Step 3: Final cargo check**

```powershell
cd "D:\vibe coding\app enhance audio pro\src-tauri"
$env:CARGO_TARGET_DIR = "D:\cargo_build\enhance-audio-pro"
cargo check 2>&1 | Select-Object -Last 5
```

Expected: `Finished` with no errors.

- [ ] **Step 4: Update CLAUDE.md — mark Phase 4 complete, add Phase 5/6**

In `CLAUDE.md` section 13, replace the two "Phase 4" blocks with:

```markdown
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
- [x] Rust: tauri.conf.json — bundle targets MSI for Windows
- [x] Frontend: src/types/queue.ts — output_format: string added
- [x] Frontend: useQueueStore.ts — setOutputFormat action; JobStatus import fixed
- [x] Frontend: ipc.ts — invokeConvertFiles + invokeSetOutputFormat wrappers
- [x] Frontend: QueueGrid.tsx — Output Format column with per-row <select> (7 formats)
- [x] Frontend: QueueToolbar.tsx — global format override + Apply All + Convert button (teal)
- [x] Frontend: DropZone.tsx — 5-second rejection warning on batch limit exceeded
- [x] Build: scripts/build-backend.bat — one-command PyInstaller build + copy to binaries
      → 20+ Vitest tests passing
      → Phase 4 COMPLETE ✓

## Phase 5 (next)
- [ ] Audio Manipulation Tools: Trim/Cut, Speed, Pitch, Volume/dB Boost, Auto Fade In/Out
- [ ] Audio Merging & Crossfade — drag-and-drop track timeline
- [ ] Audio Looping — custom loop generator (extend clip to N hours)
- [ ] Advanced EQ — 11-band sliders + 17 presets (Classic, Dance, Rock, etc.)
- [ ] Waveform / Spectrogram visualization
- [ ] Playback controls (real-time preview, A/B original vs enhanced toggle)
- [ ] Enhancement strength slider

## Phase 6
- [ ] Multi-select queue (Ctrl+Click individual, Shift+Click range)
- [ ] Grid View / List View toggle
- [ ] Localization — 17 languages
- [ ] Custom keyboard shortcuts
- [ ] Built-in user guide / documentation panel
- [ ] Auto-save project state
- [ ] Export bitrate/quality options
- [ ] macOS packaging (.dmg / .app)
```

- [ ] **Step 5: Update PRD Phase 4 status**

In `PRD_Enhance_Audio_Pro.txt`, replace:

```
* Phase 4: PyInstaller packaging + ffmpeg conversion + batch limits + output format selector.
```

With:

```
* Phase 4: PyInstaller packaging + ffmpeg conversion + batch limits + output format selector.
  [STATUS: COMPLETE — 2026-05-22]
  [COMPLETED: ffmpeg processor, /convert endpoint, output_format DB column, per-file and global format selectors, 30 audio/10 video batch limits, PyInstaller build.spec, MSI bundle config — 25/25 Pytest + 20+/20+ Vitest passing]
  [PLAN: docs/superpowers/plans/2026-05-22-phase4-packaging-conversion.md]
```

- [ ] **Step 6: Final commit and push**

```powershell
cd "D:\vibe coding\app enhance audio pro"
git add CLAUDE.md PRD_Enhance_Audio_Pro.txt
git commit -m "chore: mark Phase 4 complete in CLAUDE.md and PRD; advance roadmap to Phase 5"
git push origin master
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| PyInstaller build spec | Task 7 |
| One-command build script | Task 7 |
| Tauri MSI bundle config | Task 8 |
| ffmpeg conversion processor (subprocess) | Task 2 |
| `/convert` endpoint + BackgroundTasks | Task 3 |
| `output_format` DB column (idempotent migration) | Task 1 |
| `update_job_output_format` DB fn | Task 1 |
| `count_active_jobs_by_type` DB fn | Task 1 |
| `convert_files` Rust command | Task 4 |
| `set_output_format` Rust command | Task 4 |
| Per-file format selector in QueueGrid | Task 5 |
| Global batch format override in QueueToolbar | Task 5 |
| Apply-all button in QueueToolbar | Task 5 |
| Convert button in QueueToolbar | Task 5 |
| `invokeConvertFiles` IPC wrapper | Task 5 |
| `invokeSetOutputFormat` IPC wrapper | Task 5 |
| 30 audio / 10 video batch limit | Task 6 |
| Rejection warning in DropZone | Task 6 |
| CLAUDE.md + PRD updated | Task 9 |
| GitHub pushed | Task 9 |

All 20 deliverables covered. ✓

**Placeholder scan:** No TBD, TODO, or vague instructions. Every code step is complete. ✓

**Type consistency:**
- `QueueJob.output_format: String` (Rust, Task 1) ↔ `output_format: string` (TypeScript, Task 1) ✓
- `invokeConvertFiles(jobIds: string[])` → `convert_files(job_ids: Vec<String>)` ✓
- `invokeSetOutputFormat(jobId, format)` → `set_output_format(job_id, format)` ✓
- `FormatSelect` reads `job.output_format` (defined Task 1 TS type, used Task 5) ✓
- `count_active_jobs_by_type` defined Task 1 queue.rs, used Task 6 queue command ✓
- `update_job_output_format` defined Task 1 queue.rs, called in Task 4 convert.rs ✓
- All 6 routers in main.py match file names in routers/ directory ✓
