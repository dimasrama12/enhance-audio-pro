# Phase 7 — Extended Features Design Spec

**Date:** 2026-05-22
**Status:** Approved / Implemented
**Phase:** 7 of 9

---

## Objective

Add session persistence, spectrogram visualization, complete locale coverage, macOS packaging, a history panel, and drag-to-reorder queue management.

---

## Features

### 1. Auto-Save Project State

- `useQueueStore` wrapped with Zustand `persist` middleware
  - Persists: `filter`, `viewMode`
- `useSettingsStore` wrapped with Zustand `persist` middleware
  - Persists: `theme`, `language`, `enhancementStrength`, `filenameTemplate`, `keyboardShortcuts`
- Storage key: `'queue-ui-cache'` / `'settings-ui-cache'`
- Uses `localStorage` (Tauri WebView provides it)

### 2. Spectrogram View

- `SpectrogramPlugin` from WaveSurfer.js v7 added to `WaveformPlayer.tsx`
- Waveform / Spectrogram tab toggle inside player
- Both containers always in DOM; visibility toggled via CSS `display: none`
- Roseus colormap; 100 px height for spectrogram canvas

### 3. Multi-Language Translations

10 new locale JSON files created in `src/i18n/locales/`:
`pt.json`, `ko.json`, `ru.json`, `ar.json`, `hi.json`, `it.json`, `nl.json`, `pl.json`, `tr.json`, `vi.json`

All 17 languages imported and registered in `src/i18n/index.ts`.

### 4. macOS Packaging

`tauri.conf.json` bundle targets updated:
```json
"targets": ["msi", "dmg", "app"]
```

### 5. Custom Output Folder Picker

- SettingsPanel "Browse" button uses `@tauri-apps/plugin-dialog` `open({ directory: true })`
- Selected path written to `useSettingsStore.outputFolder` + `invokeSaveSettings`

### 6. History / Recent Files Panel (`src/components/HistoryPanel.tsx`)

- Slide-in panel from sidebar (Clock icon trigger)
- Shows last 50 jobs with `status = 'done'` or `status = 'error'`
- Data source: `get_recent_jobs` in `db/queue.rs` (ORDER BY updated_at DESC LIMIT 50)
- New Tauri command: `get_recent_history() → IpcResponse<QueueJob[]>`
- IPC wrapper: `invokeGetRecentHistory()`

### 7. Drag-to-Reorder Queue

- `@dnd-kit/core` + `@dnd-kit/sortable` installed
- `GripVertical` lucide drag handle on every table row and grid card
- `reorderJobs(activeId, overId)` action in `useQueueStore`
- `PointerSensor` with `activationConstraint: { distance: 5 }` (prevents drag on click)

---

## Architecture Notes

- Drag-to-reorder is **UI-only** — does not change SQLite row order (order is ephemeral per session)
- History panel fetches on open; does not auto-refresh
- Spectrogram is lazy-initialized on first tab switch to avoid layout thrash on load

---

## Testing

| Layer | Count |
|---|---|
| Vitest | 33 total (up from 31) |
| Pytest | 56 total (unchanged) |

**Result:** 33/33 Vitest · 56/56 Pytest · cargo check clean
