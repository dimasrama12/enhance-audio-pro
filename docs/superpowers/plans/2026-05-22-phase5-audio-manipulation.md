# Phase 5 Implementation Plan — Audio Manipulation Tools
**Date:** 2026-05-22

---

## Task List

### Task 1 — Backend processors (TDD) ✅
- `backend/processors/manipulate_audio.py` — trim, speed, pitch, volume, fade via ffmpeg
- `backend/processors/merge_audio.py` — concat+acrossfade, stream_loop
- `backend/processors/equalizer.py` — parametric EQ + 18 presets
- Tests: `test_manipulate_audio.py` (7), `test_merge_audio.py` (6), `test_equalizer.py` (6)
- Result: 19 tests passing

### Task 2 — FastAPI router (TDD) ✅
- `backend/routers/manipulate.py` — /manipulate, /merge, /loop, /eq
- `backend/main.py` — router registered
- Tests: `test_manipulate_endpoint.py` (6)
- Result: 25 total → 51 total backend tests passing

### Task 3 — Rust IPC layer ✅
- `src-tauri/src/commands/manipulate.rs` — manipulate_audio, merge_audio, loop_audio, apply_eq
- `src-tauri/src/commands/mod.rs` — pub mod manipulate
- `src-tauri/src/lib.rs` — all 4 commands registered in invoke_handler
- Verification: cargo check passes

### Task 4 — Frontend IPC wrappers ✅
- `src/lib/ipc.ts` — invokeManipulateAudio, invokeMergeAudio, invokeLoopAudio, invokeApplyEQ
- `src/stores/useQueueStore.ts` — selectedJobId + setSelectedJob
- `src/components/QueueGrid.tsx` — row click selects/deselects job

### Task 5 — EQPanel component ✅
- `src/components/EQPanel.tsx` — 11-band vertical sliders + 18 preset selector + reset button

### Task 6 — ManipulationPanel component ✅
- `src/components/ManipulationPanel.tsx` — 8-tab panel (Trim/Speed/Pitch/Volume/Fade/Merge/Loop/EQ)
- `src/App.tsx` — panel mounted below QueueGrid with AnimatePresence slide-up
- Vitest tests: ManipulationPanel renders, tab switching, Apply button interactions

### Task 7 — Documentation + CLAUDE.md update ✅
- Phase 5 design spec: `docs/superpowers/specs/2026-05-22-phase5-audio-manipulation-design.md`
- Phase 5 plan: `docs/superpowers/plans/2026-05-22-phase5-audio-manipulation.md`
- CLAUDE.md §13 Phase 5 tasks checked

### Task 8 — Commit + push ✅
- All Phase 5 changes committed with clean message
- Pushed to GitHub remote

---

## File Manifest

| File | Status |
|---|---|
| `backend/processors/manipulate_audio.py` | ✅ new |
| `backend/processors/merge_audio.py` | ✅ new |
| `backend/processors/equalizer.py` | ✅ new |
| `backend/routers/manipulate.py` | ✅ new |
| `backend/tests/test_manipulate_audio.py` | ✅ new |
| `backend/tests/test_merge_audio.py` | ✅ new |
| `backend/tests/test_equalizer.py` | ✅ new |
| `backend/tests/test_manipulate_endpoint.py` | ✅ new |
| `backend/main.py` | ✅ modified |
| `src-tauri/src/commands/manipulate.rs` | ✅ new |
| `src-tauri/src/commands/mod.rs` | ✅ modified |
| `src-tauri/src/lib.rs` | ✅ modified |
| `src/lib/ipc.ts` | ✅ modified |
| `src/stores/useQueueStore.ts` | ✅ modified |
| `src/components/QueueGrid.tsx` | ✅ modified |
| `src/components/EQPanel.tsx` | ✅ new |
| `src/components/ManipulationPanel.tsx` | ✅ new |
| `src/App.tsx` | ✅ modified |
| `package.json` | ✅ modified (wavesurfer.js) |
