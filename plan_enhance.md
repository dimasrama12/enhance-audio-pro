# Enhance Feature — Complete Fix & Implementation Plan

> **Status:** Active  
> **Focus:** Speech enhancement (noise removal via DeepFilterNet3) — backend stability, full pipeline reliability, and UI/UX completeness.

---

## Executive Summary

The enhance pipeline is fully wired end-to-end: React → Tauri Rust command → Python FastAPI → Callback server → Tauri events → React store. Two gaps existed that prevented it from working correctly:

1. **torchaudio v2.x incompatibilities** (root causes A/B/C below) — **now fixed** via a soundfile monkeypatch shim.
2. **Several silent failure modes** in the frontend loop and backend error handling that caused jobs to hang or fail invisibly.

This document is the authoritative reference for all enhance-related changes. It merges `enhance_feature_fix_plan.md` (backend compat fix) and `plan_enhance_feature.md` (UI improvements) and adds new edge cases discovered during code review.

---

## Part A — torchaudio Compatibility Shim

### Status: COMPLETE ✅

### Root Cause Analysis

Three distinct failures were caused by upgrading to `torchaudio` v2.x:

| # | Error | Root Cause |
|---|-------|-----------|
| A | `AttributeError: module 'torchaudio' has no attribute 'info'` | `torchaudio.info` removed from public namespace in v2.x; DeepFilterNet's `df/io.py` calls it directly |
| B | `ImportError: TorchCodec is required for load_with_torchcodec` | `torchaudio.load()` now delegates to the `torchcodec` package which is not installed; incompatible with Windows bundling |
| C | `ImportError: cannot import name 'AudioMetaData' from 'torchaudio.backend.common'` | `torchaudio.backend` submodule removed in v2.x; this error occurred in dev mode only since the PyInstaller rthook ran too late |

**Why not downgrade torchaudio?** Downgrading would conflict with Demucs' dependency requirements and potentially break stem separation.

### Solution: soundfile Monkeypatch Shim

The shim in `backend/rthooks/pyi_rth_torchaudio_compat.py` patches torchaudio at import time using `soundfile` (already installed, stable on Windows):

- `torchaudio.info` → reimplemented via `sf.info()`, returns an `AudioMetaData` dataclass
- `torchaudio.load` → reimplemented via `sf.read()`, returns `(torch.Tensor, sample_rate)`
- `torchaudio.save` → reimplemented via `sf.write()`
- `torchaudio.backend` / `torchaudio.backend.common` → injected as synthetic modules before any DeepFilterNet imports

The shim is now imported at the **very top** of `backend/main.py` (before all other imports), so it is active in both dev mode and the PyInstaller production build.

**Files changed:**
- `backend/rthooks/pyi_rth_torchaudio_compat.py` — full shim implementation
- `backend/main.py` — early import of the shim module

---

## Part B — Backend Edge Cases & Reliability Fixes

### B1: MP3 / Unsupported Format Fallback

**Problem:** `soundfile` cannot read MP3, M4A, WMA, or other compressed formats on most Windows installations (requires a libsndfile build with MPEG support, which is not standard). If a user queues an MP3 file for enhancement, `sf.read()` raises an `OSError` and the job fails with a cryptic error.

**Fix in `backend/processors/enhance_speech.py`:**

Add a format detection helper at the top of `enhance_file()`. For unsupported formats, pre-convert to a temporary WAV using `ffmpeg` (bundled with the app via the convert pipeline), process the WAV, then delete the temp file.

```
Supported natively by soundfile: .wav, .flac, .ogg, .aiff, .aif
Everything else: ffmpeg → temp .wav → process → cleanup
```

**Edge cases handled:**
- `ffmpeg` subprocess failure → raises `subprocess.CalledProcessError` with stderr captured, propagates to the error callback with a readable message
- Temp file cleanup runs in a `finally` block so it always executes even if enhancement fails midway
- Output filename still derives from the original file name, not the temp WAV name

### B2: DeepFilterNet RNN State Reset Between Files

**Problem:** `_df_state` is a module-level singleton. The DeepFilterNet model uses an RNN whose hidden state is intentionally carried forward across chunks of a *single* file (correct behavior). But when processing multiple files sequentially, the hidden state from the last chunk of file N becomes the *initial* state for file N+1. This can cause audible artifacts at the beginning of subsequent files — the model's "memory" contains information from an entirely different recording.

**Fix in `backend/processors/enhance_speech.py`:**

Modify `_load_model()` to cache only the model weights (`_model`), and call `init_df()` on every invocation to obtain a fresh `df_state`. This is cheap — `init_df()` with a cached model simply re-creates the state object without reloading weights from disk.

```python
# Before: both _model and _df_state cached globally (df_state bleeds between files)
# After: only _model cached; df_state created fresh per enhance_file() call
```

### B3: Model Loading Progress Signal

**Problem:** On first use, `init_df()` loads DeepFilterNet3 weights from disk (5–15 seconds on cold start). During this time, the frontend shows a job in "processing" state with 0% progress — the user sees no movement and may think the app has frozen.

**Fix in `backend/processors/enhance_speech.py`:**

Emit `progress_cb(5)` immediately at the start of `enhance_file()`, *before* calling `_load_model()`. This causes the progress bar to immediately show 5%, signaling that the job has been received and is starting.

### B4: Callback POST Silent Failures (Existing Known Issue)

**Current state:** If the callback HTTP POST from Python to the Rust callback server fails (timeout, connection refused), the exception is silently swallowed. This causes jobs to stick in "processing" state forever from the frontend's perspective.

**Recommendation (logged, not yet fixed in this release):** Add structured logging for all failed callback POSTs so they appear in the sidecar console. A future fix should add a retry mechanism (1–2 retries with backoff) for the status callback.

---

## Part C — UI/UX Improvements

### C1: Toolbar Label Changes

| Before | After |
|--------|-------|
| `Enhance` | `Enhance All` |
| `Convert` | `Convert All` |

**File:** `src/components/QueueToolbar.tsx`

Rationale: These buttons operate on *all* pending files in the queue. The "All" suffix clarifies this at a glance, especially now that per-row single-file enhance is also available (see C2).

### C2: TOOLS Column — Per-Row Single-File Enhance

**File:** `src/components/QueueGrid.tsx`

A new `TOOLS` column is added to the queue table, replacing the `TYPE` column (which showed "audio" / "video" — redundant information that cluttered the layout).

Each row in the TOOLS column contains an **Enhance** button:
- `Pending` row: button is enabled, clicking triggers `invokeProcessQueue([job.id], enhancementStrength)`
- `Processing` row: button is disabled (job is actively running)
- `Done` row: button is disabled (job has already been enhanced; use the AB toggle to compare)
- `Error` row: button is re-enabled (allow retry after a failed job)

The Rust `process_queue` command immediately updates the DB status to `processing` and emits the status-change event, so the button disables itself reactively without any additional local state needed.

### C3: Toast Notifications

A lightweight toast system using Framer Motion's `AnimatePresence` provides non-blocking feedback when jobs complete:

- **Success toast:** `"filename.wav" enhanced successfully` (green, auto-dismisses after 3.5 s)
- **Error toast:** `Error enhancing "filename.wav"` (red, auto-dismisses after 3.5 s)

**New files:**
- `src/stores/useToastStore.ts` — Zustand store with `addToast` / `dismissToast`
- `src/components/ToastContainer.tsx` — fixed bottom-right, Framer Motion slide-in

### C4: STATUS Column — "Enhanced" Indicator (Already Implemented)

When a job completes with an `output_filepath`, the STATUS cell already shows the **Enhanced** / **Original** A/B toggle buttons (not the generic "done" badge). This was implemented in a prior session and is correct behavior. No changes needed.

### C5: runSequentially Hang Fix

**File:** `src/components/QueueToolbar.tsx`

**Problem:** The per-job `Promise` in `runSequentially` has no timeout. If a job never emits a `done` or `error` status (Python sidecar crash, failed callback POST, DB error), the loop waits indefinitely. All subsequent jobs in the queue are silently blocked.

**Fix:** Add a 5-minute per-job timeout (`300_000 ms`). When it fires, the promise resolves and the loop advances to the next job. The stuck job remains in its last known state (likely `processing`); the user can see it and manually delete it.

---

## Part D — WaveformPlayer AB Toggle (Already Implemented ✅)

The WaveformPlayer already has a fully working Original/Enhanced toggle:

- A `showOutput` boolean state controls which file is loaded (`filepath` vs `outputFilepath`)
- Toggle button appears at top-right of the player header, only when `outputFilepath` is present
- Uses `ToggleLeft` / `ToggleRight` icons with "Original" / "Enhanced" labels
- File label in the header updates to show `"(enhanced)"` suffix when in enhanced mode

No changes needed here.

**Save button (deferred):** Adding a Save button to persist volume-adjusted audio requires a new backend command to apply gain and write a new file. This is a Phase 2 enhancement and is deferred from the current scope.

---

## Part E — Verification Checklist

### Backend tests
- [ ] Run `backend\.venv\Scripts\pytest tests/` — all tests pass
- [ ] Manually run `python backend/manual_test_load_audio.py` on a `.wav` file — no errors
- [ ] Manually run test on an `.mp3` file — ffmpeg fallback triggers, output WAV produced

### Frontend tests
- [ ] `npx tsc --noEmit` — 0 TypeScript errors

### Integration tests
- [ ] Add `.wav` to queue → click "Enhance All" → progress bar animates 5%→90%→done → Enhanced/Original toggle appears → toast "enhanced successfully"
- [ ] Add `.mp3` to queue → enhance → verify no crash (ffmpeg path taken), output file produced
- [ ] Add 3 files → enhance → toast appears for each completion in sequence
- [ ] Add one file → click "Enhance" in TOOLS column → only that file processes, others remain pending
- [ ] Open WaveformPlayer on a done+enhanced file → verify AB toggle switches waveform and audio
- [ ] Kill sidecar mid-job → verify queue unblocks after ~5 minutes (runSequentially timeout)

### Build
- [ ] `npm run build:backend` — sidecar builds without errors, copied to `src-tauri/binaries/`
- [ ] `CARGO_TARGET_DIR=D:\cargo_build\enhance-audio-pro npm run tauri build -- --no-bundle`
- [ ] Verify `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe` exists and launches

---

## File Change Summary

| File | Type | Change |
|------|------|--------|
| `backend/processors/enhance_speech.py` | Modified | MP3 ffmpeg fallback, df_state reset, early progress signal |
| `backend/rthooks/pyi_rth_torchaudio_compat.py` | Done ✅ | Full soundfile shim |
| `backend/main.py` | Done ✅ | Early shim import |
| `src/components/QueueToolbar.tsx` | Modified | runSequentially timeout, "Enhance All"/"Convert All" labels |
| `src/components/QueueGrid.tsx` | Modified | Remove TYPE col, add TOOLS col, toast on done/error |
| `src/stores/useToastStore.ts` | New | Toast Zustand store with auto-dismiss |
| `src/components/ToastContainer.tsx` | New | Fixed bottom-right toast UI (Framer Motion) |
| `src/App.tsx` | Modified | Render `<ToastContainer />` |
