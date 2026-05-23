# Phase 8 — Quality, Recording & PRD Completion Design Spec

**Date:** 2026-05-22
**Status:** Approved / Implemented
**Phase:** 8 of 9

---

## Objective

Complete the PRD feature list with queue status visibility, per-job audio quality controls, custom filename templates, editing state reset, in-app microphone recording, customizable keyboard shortcuts, and queue grouping by format.

---

## Features

### 1. QueueStatusBar (`src/components/QueueStatusBar.tsx`)

Live pill counters rendered between toolbar and grid:

| Pill | Colour | Count source |
|---|---|---|
| Total | neutral | `jobs.length` |
| Pending | amber | jobs where status = 'pending' |
| Processing | blue (pulse) | status = 'processing' |
| Done | green | status = 'done' |
| Error | red | status = 'error' |

Hidden when queue is empty.

### 2. Sample Rate Selector Per Job

- `sample_rate TEXT DEFAULT '44100'` column added to SQLite (idempotent migration)
- `update_job_sample_rate` in `db/queue.rs`
- `set_sample_rate` Tauri command in `commands/convert.rs`
- `setSampleRate(jobId, rate)` action in `useQueueStore`
- `invokeSetSampleRate` IPC wrapper
- `SampleRateSelect` component in `QueueGrid` — options: Auto / 22050 / 44100 / 48000 / 96000 Hz
- Python `routers/convert.py` reads `sample_rate` from DB, passes `-ar` flag to ffmpeg

### 3. Custom Output Filename Template

- `filenameTemplate: string` in `AppSettings`, default `'{name}'`
- `setFilenameTemplate` action + persisted in `useSettingsStore` partialize
- SettingsPanel input field with token hints: `{name}`, `{date}`, `{format}`
- Python `routers/convert.py` applies template when building output filename
- `filename_template` passed from Rust `convert_files` command to Python payload

### 4. Reset All Editing Button

- Button in ManipulationPanel header: "Reset All"
- Resets all 11 manipulation state values to defaults in a single click:
  - trimStart=0, trimEnd=0, speed=1.0, pitch=0, volume=0
  - fadeIn=0, fadeOut=0, mergeJobIds=[], loopCount=1, eqGains=[0×11], eqPreset='flat'

### 5. In-App Audio Recording (`src/components/RecordButton.tsx`)

- `MediaRecorder` API captures mic audio → `Blob` → `Uint8Array`
- `invokeSaveRecording(bytes: number[]) → string` (returns temp file path)
- `save_recording` Rust command: writes bytes to OS temp dir, returns path
- On stop: calls `invokeAddFiles([path])` to add recording to queue
- UI: red pulsing button in QueueToolbar while recording active

### 6. Keyboard Shortcuts Customization

- `KeyboardShortcutMap` type: `Record<string, string>` (action → key combo)
- `keyboardShortcuts: KeyboardShortcutMap` in `AppSettings`
- `KeyboardShortcutsPanel.tsx` — editable table of all shortcuts, click-to-rebind
- `useKeyboardShortcuts` hook reads bindings from `useSettingsStore.keyboardShortcuts`
- `KeyboardShortcutsPanel` embedded in SettingsPanel

### 7. Queue Format Grouping

- `groupByFormat: boolean` in `useQueueStore`
- `setGroupByFormat(v: boolean)` action (persisted via localStorage)
- Toggle button in QueueToolbar
- `QueueGrid` conditional rendering: grouped sections when enabled (one section per unique `output_format`)

---

## DB Schema Additions

```sql
ALTER TABLE queue_jobs ADD COLUMN sample_rate TEXT NOT NULL DEFAULT '44100';
```

---

## Testing

| Layer | Count |
|---|---|
| Vitest | 38 total (up from 33) |
| Pytest | 65 total (up from 56) |

**Result:** 38/38 Vitest · 65/65 Pytest · cargo check clean
