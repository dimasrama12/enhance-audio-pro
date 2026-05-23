# Phase 6 — Polish, UX & Localization Design Spec

**Date:** 2026-05-22
**Status:** Approved / Implemented
**Phase:** 6 of 9

---

## Objective

Transform the functional app into a polished, production-quality UX with waveform visualization, multi-language support, advanced queue selection, and per-job quality controls.

---

## Features

### 1. WaveformPlayer (`src/components/WaveformPlayer.tsx`)

- WaveSurfer.js v7 waveform bar (56 px height)
- Play / Pause / Stop controls with time display
- A/B toggle (original vs. enhanced) — enabled only when `status === 'done'` and `output_filepath` is set
- Waveform / Spectrogram tab inside ManipulationPanel (Phase 7 adds SpectrogramPlugin)

### 2. Enhancement Strength Slider

- 0–100 range in SettingsPanel
- Maps to DeepFilterNet `atten_lim_db` (0–40 dB) on the Python side
- Persisted in `useSettingsStore.enhancementStrength`
- Python `routers/enhance.py` reads `strength` from request body

### 3. Multi-Select Queue

| Gesture | Behaviour |
|---|---|
| Click | Exclusive select |
| Ctrl+Click | Toggle membership |
| Shift+Click | Range select |

- `selectedJobIds: string[]` in `useQueueStore` replaces `selectedJobId: string \| null`
- `primarySelectedId(): string \| null` computed getter for ManipulationPanel backward compat

### 4. Grid / List View Toggle

- `LayoutGrid` / `LayoutList` lucide icons in QueueToolbar
- Card grid layout (3-column, responsive) when grid mode active
- `viewMode: 'list' | 'grid'` persisted in `useQueueStore`

### 5. Localization — i18next

- `i18next` + `react-i18next` installed
- `src/i18n/index.ts` — initializes with 17 language resources
- `src/i18n/locales/` — JSON files for: `en`, `id`, `zh`, `es`, `de`, `fr`, `ja`, `pt`, `ko`, `ru`, `ar`, `hi`, `it`, `nl`, `pl`, `tr`, `vi`
- SettingsPanel language selector wired to `i18n.changeLanguage(code)`

### 6. Keyboard Shortcuts Hook (`src/hooks/useKeyboardShortcuts.ts`)

| Key | Action |
|---|---|
| Ctrl+A | Select all |
| Escape | Deselect all |
| Delete | Remove selected |
| E | Trigger Enhance |
| S | Trigger Separate Stems |
| C | Trigger Convert |

Reads custom bindings from `useSettingsStore.keyboardShortcuts` (Phase 8).

### 7. HelpPanel (`src/components/HelpPanel.tsx`)

- 7 collapsible sections covering all features
- Triggered from TitleBar `?` icon
- Slides in from right with AnimatePresence

### 8. BitrateSelect Per Row

- Dropdown: Auto / 64k / 96k / 128k / 192k / 256k / 320k
- `bitrate TEXT DEFAULT 'auto'` column in SQLite
- `set_bitrate` Rust command → `update_job_bitrate` in db layer
- Python convert router reads bitrate, passes `-b:a` flag to ffmpeg

### 9. `output_filepath` Tracking

- Python sends `output_filepath` in `done` callback payload
- `StatusPayload.output_filepath: Optional[str]` in Python
- `update_job_output_filepath` in Rust db layer
- `outputFilepath: string | null` on `QueueJob` TypeScript type
- WaveformPlayer uses this path for A/B toggle

---

## Data Layer Changes

```sql
ALTER TABLE queue_jobs ADD COLUMN bitrate TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE queue_jobs ADD COLUMN output_filepath TEXT;
```

---

## Testing

| Layer | Count |
|---|---|
| Vitest | 31 total (up from 20) |
| Pytest | 56 total (up from 51) |

**Result:** 31/31 Vitest · 56/56 Pytest · cargo check clean
