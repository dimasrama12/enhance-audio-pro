# Phase 5 Design Spec — Audio Manipulation Tools
**Date:** 2026-05-22
**Status:** Approved

---

## Objective
Extend Enhance Audio Pro with a full suite of non-destructive audio manipulation tools accessible from a collapsible panel that slides up when the user selects a queue job.

---

## Scope

| Feature | Backend | Rust | Frontend |
|---|---|---|---|
| Trim / Cut | `manipulate_audio.py::trim_audio` | `commands/manipulate.rs::manipulate_audio` | ManipulationPanel › Trim tab |
| Speed Change | `manipulate_audio.py::speed_audio` | same | ManipulationPanel › Speed tab |
| Pitch Shift | `manipulate_audio.py::pitch_audio` | same | ManipulationPanel › Pitch tab |
| Volume / dB Boost | `manipulate_audio.py::volume_audio` | same | ManipulationPanel › Volume tab |
| Auto Fade | `manipulate_audio.py::fade_audio` | same | ManipulationPanel › Fade tab |
| Merge + Crossfade | `merge_audio.py::merge_files` | `commands/manipulate.rs::merge_audio` | ManipulationPanel › Merge tab |
| Audio Loop | `merge_audio.py::loop_audio` | `commands/manipulate.rs::loop_audio` | ManipulationPanel › Loop tab |
| Advanced EQ | `equalizer.py::apply_eq` (17 presets) | `commands/manipulate.rs::apply_eq` | ManipulationPanel › EQ tab (EQPanel component) |

---

## Backend Architecture

### Processors
- `backend/processors/manipulate_audio.py` — ffmpeg subprocess wrapper for trim/speed/pitch/volume/fade
- `backend/processors/merge_audio.py` — ffmpeg concat/acrossfade/stream_loop
- `backend/processors/equalizer.py` — ffmpeg parametric EQ + 18 presets

### Router
- `backend/routers/manipulate.py` — 4 endpoints: `/manipulate`, `/merge`, `/loop`, `/eq`
- All endpoints return 202 immediately; background tasks push progress/status via callback URL

### Data Flow
```
Frontend invoke → Rust command (sync + fire-and-forget)
  → HTTP POST to Python FastAPI /manipulate|/merge|/loop|/eq
  → Background task: ffmpeg subprocess
  → httpx POST to Rust callback server /callback/progress + /callback/status
  → Tauri emit queue://progress + queue://status-change
  → React store update → UI re-render
```

---

## Frontend Architecture

### Job Selection
- `useQueueStore.selectedJobId: string | null`
- `QueueGrid` rows are clickable; click selects/deselects
- `ManipulationPanel` reads `selectedJobId` and renders conditionally

### ManipulationPanel
- Fixed height (240px) panel below QueueGrid
- Slides up with AnimatePresence when a job is selected
- 8 tabs: Trim | Speed | Pitch | Volume | Fade | Merge | Loop | EQ
- Each tab renders controls + an Apply button that calls the relevant IPC wrapper
- EQ tab embeds `EQPanel` component (11-band sliders + 18 preset selector)

### State
- Tab state: local `useState` (no persistence needed)
- EQ gains: local `useState` in ManipulationPanel, reset on job change
- Merge job IDs: selected from all jobs in queue (multi-select within Merge tab)

---

## Excluded from Phase 5
- Waveform / spectrogram visualization (WaveSurfer.js deferred to Phase 6)
- Real-time playback preview (deferred)
- Enhancement strength slider (deferred)

---

## Testing Strategy
- Backend: Pytest mocking subprocess.run — 7+6+6=13 unit tests per processor module + 6 endpoint tests
- Frontend: Vitest — ManipulationPanel renders, tab switching, Apply button callbacks
- Rust: `cargo check` (no unit tests due to Windows API Set DLL issue documented in CLAUDE.md §18.13)
