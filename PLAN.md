# Enhance Audio Pro — Active Development Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two confirmed bugs (queue concurrency + slider locking), then outline the next tier of feature and performance improvements for Enhance Audio Pro v0.2.x.

**Architecture:** Tauri v2 desktop app — React + Zustand frontend, Rust IPC core, Python FastAPI sidecar (DeepFilterNet). All audio processing is strictly offline. Communication is Tauri `invoke` → Rust HTTP → Python asyncio.

**Tech Stack:** TypeScript / React 18 / Zustand / Vitest · Rust / Tauri v2 · Python 3.11 / FastAPI / DeepFilterNet3 / torchaudio

**Spec:** This file is self-contained; see `CLAUDE.md §13` for feature history.

## Global Constraints

- Never process the original file — output always goes to a separate destination path.
- No external network calls for audio processing. All AI is local.
- Build command: `$env:CARGO_TARGET_DIR='D:\cargo_build\enhance-audio-pro'; npm run tauri build -- --target x86_64-pc-windows-gnu`
- Installer lands at: `D:\cargo_build\enhance-audio-pro\x86_64-pc-windows-gnu\release\bundle\nsis\`
- Frontend tests: `npx vitest run` (must be 53/53 green before any commit)
- TypeScript: `npx tsc --noEmit` must report 0 errors before any commit

---

## COMPLETED TASKS (this session, 2026-08-26)

### Task 1 — Queue Concurrency Bug (DONE ✅)

**Root cause (systematic-debugging):** The `queue://status-change` listener in `QueueGrid.tsx` wrapped the auto-advance in `setTimeout(callback, 100)`. This created a 100 ms race window where:
1. Job A's `done` event fires → `setStatus(A, done)` in Zustand → `setTimeout(advance, 100ms)` scheduled
2. A second `done/error/pending` event fires within 100 ms → second `setTimeout(advance, 100ms)` scheduled
3. Both timeouts fire; both read Zustand state; both find job B as `queued` (the backend's `processing` event for B hasn't arrived yet — can take 50–500 ms)
4. Both call `invokeProcessQueue([B])` — B gets dispatched twice and starts processing before A is confirmed done

**Fix applied:**
- `src/lib/queueActions.ts` — added `autoAdvanceQueue(tab)` (extracted, testable) + module-level dispatch guard `_lastDispatchedJobId` that prevents the same job being dispatched twice; `clearDispatchGuard(jobId)` resets the guard when the backend confirms the job started processing
- `src/components/QueueGrid.tsx` — replaced the `setTimeout`-based block with synchronous `autoAdvanceQueue(jobTab)` on `done/error`; added `clearDispatchGuard(jobId)` on `processing`; removed `pending` from the auto-advance trigger (semantically wrong)
- 6 new Vitest tests proving: sequential dispatch, guard blocks double-dispatch, guard clears correctly for next job, convert-mode routing

**Files changed:** `src/lib/queueActions.ts`, `src/components/QueueGrid.tsx`, `src/lib/__tests__/queueActions.test.ts`

---

### Task 2 — Slider Locking During Processing (DONE ✅)

**Root cause:** The Str and HF sliders in `QueueToolbar.tsx` had no awareness of queue state. A user could adjust parameters mid-flight, causing the already-dispatched job to finish with one set of values while the UI showed different values, creating a confusing mismatch.

**Fix applied:**
- `src/components/QueueToolbar.tsx` — added `isProcessing` selector (`tabQueues['enhance'].some(j => j.status === 'processing')`); slider container gets `opacity-45 pointer-events-none cursor-not-allowed` + a small "locked" label when true; both `<input type="range">` elements receive `disabled={isProcessing}` and shift to `accent-slate-400 cursor-not-allowed` styling; tooltip changes to "Locked while processing"

**Design rationale (frontend-design skill):** Fade the entire control group (not just individual sliders) so the lock reads as a single semantic unit. The "locked" micro-label is direct and non-apologetic — it states what state the UI is in. Accent color shifts to neutral gray so the slider thumb itself signals unavailability without requiring an icon.

**Files changed:** `src/components/QueueToolbar.tsx`

---

## COMPLETED IMPROVEMENTS (commit 3fad07d, 2026-08-26)

- **P1-A** ✅ Run snapshot header rows — `EnhanceRun` in types/queue.ts, `enhanceRuns`/`addEnhanceRun` in store, `triggerEnhanceAll` snapshots each batch, `RunHeaderRow` renders in flat table view
- **P1-B** ✅ Cancel in-flight on app close — `lib.rs` queries processing jobs, POSTs `/cancel` (mini tokio thread, 2s timeout + 400ms grace), then kills sidecar
- **P2-C (revised)** ✅ Auto-retry on error — `handleJobError` retries up to 3×, `willRetry` readable by UI; "Retrying…" info toast during retries, error toast only after exhaustion
- **P2-D** ✅ Cross-tab drag — `isDraggingJob`/`crossTabDropTarget` in UIStore; QueueToolbar tracks pointer over inactive pill; QueueGrid moves job(s) + switches tab on drop
- **Skipped per spec** — P1-C (persist queue across restarts), P2-A (batch download)

---

## REMAINING PROPOSALS — NEXT ITERATIONS

### P1 — High Impact, Low Risk

#### ~~P1-A: Batch-enhance parameter snapshot per run~~ (DONE)

#### ~~P1-B: Cancel in-flight enhancement on app close~~ (DONE)

#### P1-C: Persist queue across restarts (opt-in) — SKIPPED per user instruction

---

### P2 — Feature Additions

#### ~~P2-A: Batch download / export folder~~ — SKIPPED per user instruction

#### ~~P2-C (revised): Auto-retry on error~~ (DONE)

#### ~~P2-D: Drag-and-drop between Enhance and Convert tabs~~ (DONE)

---

### ORIGINAL PROPOSALS (not yet implemented)

#### P1-A: Batch-enhance parameter snapshot per run (original for reference)
**Problem:** When a batch of 10 files is enhanced and the user wants to know what settings were used for file 3, they have to look at the Str/HF badges per row — but there's no batch-level summary.  
**Proposal:** When "Enhance All" is triggered, snapshot `{ enhancementStrength, hfDeHissDb, timestamp }` and store it as a session-level "run record" in Zustand. Display as a collapsed header row above each batch group (e.g. `Run 1 — Str 50, HF −4 dB, Aug 26 10:45`).  
**Files:** `src/stores/useQueueStore.ts` (new `runs` slice), `src/components/QueueGrid.tsx` (run header row)

#### P1-B: Cancel in-flight enhancement on app close
**Problem:** If the user closes the app while a job is processing, the Python sidecar may leave a half-written output file. The cleanup in `lib.rs` only deletes the scratch cache, not the partial output.  
**Proposal:** In `lib.rs::on_window_event(CloseRequested)`, query SQLite for any `processing` jobs; call `cancel_jobs` for each before killing the sidecar. Add a corresponding `DELETE FROM queue_jobs WHERE status='processing'` reset in Python's shutdown handler.  
**Files:** `src-tauri/src/lib.rs`, `backend/routers/enhance.py`

#### P1-C: Persist queue across restarts (opt-in)
**Problem:** Closing and reopening the app clears the queue (by design — `App.tsx` `sessionStorage` gate). Power users processing large overnight batches would benefit from an opt-in "resume queue on restart" toggle in Settings.  
**Proposal:** Add `persistQueueOnRestart: boolean` to `AppSettings`; skip the `clearQueue` gate in `App.tsx` when enabled; on startup, restore queue from SQLite via `invokeGetQueue` and only clear jobs that were `processing` (since they were interrupted) — reset them to `pending`.  
**Files:** `src/types/settings.ts`, `src/stores/useSettingsStore.ts`, `src/App.tsx`, `src-tauri/src/commands/queue.rs`

---

### P2 — Feature Additions

#### P2-A: Batch download / export folder
**Problem:** After enhancing 20 files, the user must click each row's Download button individually to save them.  
**Proposal:** "Save All" button in `QueueActionBar` (enabled when ≥2 done jobs exist); opens a folder picker; iterates `invokeCopyEnhancedFile` for all done jobs into the chosen folder; shows a progress toast.  
**Files:** `src/components/QueueGrid.tsx` (QueueActionBar), `src/lib/ipc.ts` (already has `invokeCopyEnhancedFile`)

#### P2-B: Queue filter memory
**Problem:** Every session the filter resets to "All". Power users who always want to see only "Pending" or "Error" have to reset it every time.  
**Proposal:** Persist `tabFilters` to localStorage (currently not in `partialize` — only `tabQueues`, `tabViewModes`, `tabGroupByFormat`, `tabLockedIds` are persisted). One-line change to `useQueueStore.ts` `partialize`.  
**Files:** `src/stores/useQueueStore.ts`

#### P2-C: Retry All Errors button
**Problem:** If 5 files fail due to a transient CUDA OOM, the user must click Retry on each row individually.  
**Proposal:** In `QueueActionBar`, show a "Retry Errors" button (amber, ghost style) when any error jobs exist in the tab. Clicking it resets all error jobs to `pending` via `invokeSetJobStatus` in batch, then calls `triggerEnhanceAll`.  
**Files:** `src/components/QueueGrid.tsx`, `src/lib/queueActions.ts`

#### P2-D: Drag-and-drop between Enhance and Convert tabs
**Problem:** A file added to the Enhance tab cannot be moved to Convert without deleting and re-adding.  
**Proposal:** On drag-over a tab pill in `QueueToolbar`, highlight the pill; on drop completion (`onDragEnd`), check if the drop target is a different tab, then call `deleteJobs` on the source tab and `addJobs` on the destination tab for the dragged job(s). Keep `status: 'pending'` — reset any in-progress state.  
**Files:** `src/components/QueueToolbar.tsx`, `src/components/QueueGrid.tsx`

---

### P3 — Performance Improvements

#### P3-A: Waveform preload on hover (not on click)
**Current:** WaveformPlayer loads audio only when the user opens it. For large files this can take 1–2 seconds.  
**Proposal:** On row `mouseenter`, begin preloading the WaveSurfer buffer into `audioPreload.ts`'s warm cache. Cancel preload on `mouseleave` if not yet started. Add a 300 ms hover debounce to avoid thrashing during fast scrolling.  
**Files:** `src/components/QueueGrid.tsx` (SortableJobRow), `src/lib/audioPreload.ts`

#### P3-B: Backend model warm-up ping
**Current:** First enhancement after cold start can take 15–30 seconds while DeepFilterNet loads weights from disk.  
**Proposal:** After the sidecar health-check passes in `sidecar/manager.rs`, send a no-op `POST /enhance` with an empty job list to trigger model warm-up asynchronously. The user sees the queue as ready but the first job will be faster.  
**Files:** `src-tauri/src/sidecar/manager.rs`, `backend/routers/enhance.py` (handle empty jobIds gracefully)

#### P3-C: SQLite WAL mode + batch writes
**Current:** Every `invokeSetJobStatus` call is a separate SQLite write. For a 50-job batch, "Enhance All" triggers 50 individual writes.  
**Proposal:** Enable WAL journal mode in `db/migrations.rs` (`PRAGMA journal_mode=WAL`); expose a `batch_set_job_status(ids, status)` Rust command; update `triggerEnhanceAll` and `triggerConvertAll` to use it for the initial `queued` mass-update.  
**Files:** `src-tauri/src/db/migrations.rs`, `src-tauri/src/commands/process.rs`, `src/lib/ipc.ts`, `src/lib/queueActions.ts`

#### P3-D: Frontend virtual list for large queues
**Current:** `QueueGrid` renders all jobs as real DOM nodes. At 500+ files the scroll becomes sluggish.  
**Proposal:** Integrate `@tanstack/react-virtual` (already in the React ecosystem) for the table-view body. Only render ±20 visible rows plus overscan. Card/grid view can stay as-is (CSS grid handles moderate counts well).  
**Files:** `src/components/QueueGrid.tsx`, `package.json`

---

### P4 — Quality & Observability

#### P4-A: Structured error logging to file
**Current:** `logError` in `src/lib/errorLogger.ts` calls `invokeAppendErrorLog` which writes to a plain text file.  
**Proposal:** Switch to JSON-lines format (`{ timestamp, level, context, message, detail }`) so the log is machine-parseable. Add a "View Error Log" button to Settings → General that opens the log file path in Explorer. Cap log file at 500 KB with a rolling truncation.  
**Files:** `src/lib/errorLogger.ts`, `src-tauri/src/commands/` (new `open_log_file` command), `src/components/SettingsPanel.tsx`

#### P4-B: Backend version mismatch detection
**Current:** If the user installs a new version over an old one without uninstalling, the old sidecar binary may still be in `binaries/`. No version check happens.  
**Proposal:** Embed the app version in the Python sidecar's `/health` response (`{ status: 'ok', version: '0.2.4' }`). Rust reads it after the health-check; if `sidecar_version != app_version`, emit a warning toast and log it.  
**Files:** `backend/routers/health.py`, `src-tauri/src/sidecar/manager.rs`

---

## Build & Deploy Reference

```powershell
# Sidecar (Python) — run from backend/ directory
py -3.11 -m PyInstaller build.spec --clean --noconfirm

# Copy to Tauri binaries (both triples required)
cp dist\backend.exe ..\src-tauri\binaries\backend-x86_64-pc-windows-gnu.exe
cp dist\backend.exe ..\src-tauri\binaries\backend-x86_64-pc-windows-msvc.exe

# Full installer (CRITICAL: must use --target flag)
$env:CARGO_TARGET_DIR='D:\cargo_build\enhance-audio-pro'
npm run tauri build -- --target x86_64-pc-windows-gnu

# Output path
# D:\cargo_build\enhance-audio-pro\x86_64-pc-windows-gnu\release\bundle\nsis\Enhance Audio Pro_0.2.4_x64-setup.exe

# Quick no-bundle binary for testing
npm run tauri build -- --no-bundle
```

> **CRITICAL:** Never use plain `npm run tauri build` for the installer. It bundles the stale `backend-x86_64-pc-windows-msvc.exe` (old stub) instead of the current gnu sidecar, producing a ~46 MB installer instead of the correct ~366 MB full build.
