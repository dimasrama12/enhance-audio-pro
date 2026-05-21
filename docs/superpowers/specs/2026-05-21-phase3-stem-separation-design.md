# Phase 3 — Stem Separation Design Spec

**Date:** 2026-05-21
**Status:** Approved
**Author:** Claude Code (autopilot)

---

## Goal

Add AI-powered stem separation to the Enhance Audio Pro queue pipeline using Facebook's Demucs (`htdemucs_ft`). Users drop files into the queue and click **Separate Stems** to extract vocals, drums, bass, and other tracks as individual `.wav` files.

---

## Architecture

Mirrors Phase 2 (speech enhancement) exactly:

```
React UI
  QueueToolbar → [Enhance Speech] [Separate Stems]  ← new button
      ↓ invokeSeaparateStems(pendingIds)
Rust: commands/separate.rs
  separate_stems(job_ids) → fire-and-forget POST /separate to Python
Python: routers/separate.py
  POST /separate → BackgroundTasks → _process_jobs()
      ↓ reads job from SQLite
      ↓ calls separate_file(input, output_dir, progress_cb)
Python: processors/separate_stems.py
  htdemucs_ft model (lazy-loaded via torch.hub, CUDA → CPU fallback)
  outputs: {stem}_{filename}.wav for each of [vocals, drums, bass, other]
      ↓ progress POSTs to Rust callback server (existing /callback/progress, /callback/status)
Rust: callback/mod.rs  ← unchanged, reused
React: QueueGrid ← unchanged, existing progress bar already handles queue://progress events
```

---

## Model

| Property | Value |
|---|---|
| Model | `htdemucs_ft` (fine-tuned hybrid transformer) |
| Stems | 4: vocals, drums, bass, other |
| Size | ~300 MB (downloaded once on first use) |
| Storage | `%APPDATA%\enhance-audio-pro\models\torch` via `TORCH_HOME` env var |
| Download | Demucs `torch.hub` auto-downloads on first `separate_file()` call |
| Fallback | `torch.cuda.is_available()` → GPU if available, CPU otherwise |

No wizard changes needed — Demucs manages its own model download transparently.

---

## Data Flow

1. User drops files into queue (existing Phase 1/2 flow)
2. User clicks **Separate Stems** in QueueToolbar
3. Frontend calls `invokeSeprateStems(pendingJobIds)`
4. Rust `separate_stems` command:
   - Sets each job to `processing` in SQLite
   - Emits `queue://status-change` for each job
   - Fires `POST /separate { job_ids, callback_url }` to Python (fire-and-forget)
5. Python processes jobs serially in BackgroundTask:
   - Reads `filepath`, `destination`, `filename` from SQLite
   - Computes `output_dir = destination || filepath.parent / "{stem}_{filename}.wav"`
   - Calls `separate_file(input_path, output_dir, progress_cb)`
   - POSTs progress (10→90%) and final status (`done` | `error`) to Rust callback
6. Rust callback emits `queue://progress` and `queue://status-change` Tauri events
7. QueueGrid progress bar updates in real time (existing Phase 2 code, no changes needed)

---

## Output Files

For input `podcast.mp3`, output files (in same dir or `destination`):
```
vocals_podcast.wav
drums_podcast.wav
bass_podcast.wav
other_podcast.wav
```

---

## New Files

### Python
| File | Purpose |
|---|---|
| `backend/processors/separate_stems.py` | Lazy Demucs loader + `separate_file()` |
| `backend/routers/separate.py` | `POST /separate` endpoint |
| `backend/tests/test_separate_stems.py` | 4 unit tests (TDD) |
| `backend/tests/test_separate_endpoint.py` | 3 endpoint tests (TDD) |

### Rust
| File | Purpose |
|---|---|
| `src-tauri/src/commands/separate.rs` | `separate_stems` Tauri command |

### Modified Files
| File | Change |
|---|---|
| `backend/requirements.txt` | Add `demucs>=4.0.0` |
| `backend/main.py` | Include separate router |
| `src-tauri/src/commands/mod.rs` | Add `pub mod separate` |
| `src-tauri/src/lib.rs` | Register `separate_stems` in invoke_handler |
| `src/lib/ipc.ts` | Add `invokeSeparateStems` |
| `src/components/QueueToolbar.tsx` | Add Separate Stems button |

---

## Testing Strategy

### Python (TDD — write tests first)

**test_separate_stems.py (4 tests):**
- `test_progress_callbacks_called_in_order` — callbacks monotonically increase, end at 100
- `test_progress_includes_start_and_end_milestones` — 10 and 100 present
- `test_separate_called_with_correct_output_dir` — demucs `apply_model` receives correct paths
- `test_model_loaded_lazily_not_at_import` — import doesn't call `get_model`

**test_separate_endpoint.py (3 tests):**
- `test_separate_returns_202`
- `test_separate_returns_processing_started_detail`
- `test_separate_with_empty_job_ids_returns_202`

### Rust
- `cargo check` (no unit tests for commands — follows Phase 2 pattern)

### Frontend
- 2 new Vitest tests for QueueToolbar (Separate Stems button disabled when no pending jobs)

### Mocking
- `conftest.py` extended to mock `demucs`, `demucs.pretrained`, `demucs.apply` modules

---

## Test Mocking Strategy

Extend `backend/tests/conftest.py` to add demucs stubs alongside existing torch/df mocks:

```python
_mock_demucs_model = MagicMock()
_mock_demucs_pretrained = MagicMock()
_mock_demucs_pretrained.get_model.return_value = _mock_demucs_model
_mock_demucs_apply = MagicMock()

for _mod, _mock in [
    ("demucs", MagicMock()),
    ("demucs.pretrained", _mock_demucs_pretrained),
    ("demucs.apply", _mock_demucs_apply),
    ("demucs.audio", MagicMock()),
]:
    sys.modules.setdefault(_mod, _mock)
```

---

## Error Handling

- If Demucs fails (OOM, corrupted file), Python catches the exception and POSTs `status=error` with the exception message to the Rust callback, which writes it to SQLite `error_message` and emits `queue://status-change`.
- Frontend displays `error` status in red (existing Phase 2 `STATUS_COLORS` map already covers this).

---

## No DB Schema Changes

`queue_jobs` table already has `progress`, `error_message`, `status` from Phase 2. No migration needed.

---

## Constraints

- Do not modify original input file — output stems go to destination or input file's directory.
- `TORCH_HOME` must be set before any `torch.hub` call in `separate_file()`.
- All `demucs`/`torch` imports must be inside functions (lazy), not at module level, to avoid import-time crash when model not yet downloaded.

---

## Success Criteria

- All 7 new Python tests pass (4 unit + 3 endpoint)
- `cargo check` passes clean
- 2 new Vitest tests pass (no regressions in existing 19)
- QueueToolbar shows "Separate Stems" button, disabled when no pending jobs
- End-to-end: clicking Separate Stems on a pending job triggers progress bar and status update in QueueGrid
