# Phase 4 — Packaging, Conversion & Batch Limits Design Spec

**Date:** 2026-05-22
**Status:** Approved / Implemented
**Phase:** 4 of 9

---

## Objective

Add audio format conversion as a first-class queue operation, enforce batch size limits to protect GPU memory, and lay the distributable packaging foundation (PyInstaller spec + Tauri MSI target).

---

## Scope

| Feature | Layer |
|---|---|
| Output format selector per queue row (7 formats) | React + Rust + Python |
| Global format override + Apply All in QueueToolbar | React |
| Convert button (teal) dispatches conversion jobs | React + Rust |
| ffmpeg subprocess wrapper with SUPPORTED_FORMATS | Python |
| POST /convert FastAPI endpoint | Python |
| Batch limits: 30 audio / 10 video enforced in add_files | Rust |
| DropZone rejection warning (5 s) | React |
| PyInstaller one-file spec (`backend/build.spec`) | Python |
| Tauri MSI bundle target in `tauri.conf.json` | Rust/Tauri |

---

## Architecture

### Python — `processors/convert_audio.py`

```python
SUPPORTED_FORMATS = ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'opus', 'webm']

def convert_file(input_path, output_path, output_format, bitrate='auto',
                 sample_rate='auto', progress_cb=None):
    cmd = ['ffmpeg', '-y', '-i', input_path]
    if sample_rate != 'auto':
        cmd += ['-ar', sample_rate]
    if bitrate != 'auto':
        cmd += ['-b:a', bitrate]
    cmd.append(output_path)
    # subprocess.run with progress callback via duration/time parsing
```

### FastAPI — `routers/convert.py`

```
POST /convert
Body: { job_ids, callback_url, filename_template? }
→ BackgroundTasks: for each job_id read DB → convert_file() → POST callbacks
→ returns HTTP 202
```

### Rust — `commands/convert.rs`

```
convert_files(job_ids, filename_template?) → fire-and-forget POST /convert
set_output_format(job_id, format) → UPDATE queue_jobs.output_format
set_bitrate(job_id, bitrate) → UPDATE queue_jobs.bitrate
set_sample_rate(job_id, sample_rate) → UPDATE queue_jobs.sample_rate
```

### DB Schema Additions (idempotent migrations)

```sql
ALTER TABLE queue_jobs ADD COLUMN output_format TEXT NOT NULL DEFAULT 'mp3';
ALTER TABLE queue_jobs ADD COLUMN bitrate TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE queue_jobs ADD COLUMN sample_rate TEXT NOT NULL DEFAULT 'auto';
```

---

## Batch Limits

Enforced in `commands/queue.rs → add_files()`:

| Media type | Max per batch |
|---|---|
| Audio | 30 |
| Video | 10 |

Files exceeding the limit are silently dropped; the count of rejected files is returned in `IpcResponse.data.rejected`. DropZone shows a 5-second amber warning when rejection occurs.

---

## PyInstaller Spec (`backend/build.spec`)

Single-file `.exe` including:
- `torch`, `torchaudio`, `demucs` (collected with `collect_all`)
- `df` (DeepFilterNet), `scipy`, `numpy`
- All uvicorn protocol/loop modules as `hiddenimports`
- Excludes: `tkinter`, `matplotlib`, `IPython`, `jupyter`

Output: `backend/dist/backend.exe` → must be copied to `src-tauri/binaries/backend-x86_64-pc-windows-gnu.exe`.

---

## Tauri Bundle Config

```json
"bundle": {
  "targets": ["msi", "dmg", "app"],
  "externalBin": ["binaries/backend"]
}
```

---

## Testing

| Layer | Tests |
|---|---|
| Python unit | 4 tests: format routing, bitrate flag, sample-rate flag, progress callbacks |
| Python endpoint | 3 tests: /convert returns 202, dispatches background task, empty job_ids |
| Vitest | setOutputFormat store action, QueueGrid format select renders |

**Result:** 20/20 Vitest · 25/25 Pytest · cargo check clean
