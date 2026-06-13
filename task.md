# Task List — Enhance Audio Pro UI Overhaul

> **Status:** Planned — not yet started  
> **Target binary:** `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe`  
> **Scope:** Frontend-only unless noted. No new Rust/Python changes except the binary rebuild at the end.

---

## Task 1 — Rename Tab Pill Labels

**File:** `src/components/QueueToolbar.tsx`  
**What:** Change the `SUB_TAB_LABELS` map (line 290–294) so tab pills read "Enhance", "Convert", "Separate" instead of "Enhance All", "Convert All", "Separate".

```ts
// Before
const SUB_TAB_LABELS: Record<AudioSubTab, string> = {
  enhance: 'Enhance All',
  convert: 'Convert All',
  separate: 'Separate',
};

// After
const SUB_TAB_LABELS: Record<AudioSubTab, string> = {
  enhance: 'Enhance',
  convert: 'Convert',
  separate: 'Separate',
};
```

The action buttons at the bottom (Task 5) will carry the "All" qualifier — e.g., "Enhance All", "Convert All", "Separate All".

---

## Task 2 — Per-Tab Independent File Queues (Major Refactor)

**Files affected:**
- `src/stores/useQueueStore.ts`
- `src/lib/importHelper.ts`
- `src/components/QueueGrid.tsx`
- `src/components/QueueToolbar.tsx`
- `src/hooks/useKeyboardShortcuts.ts`
- `src/components/QueueStatusBar.tsx` (if it reads `jobs` directly)

**Goal:** Files added in the Enhance tab must not appear in Convert or Separate, and vice versa. Each tab has a fully isolated file list.

### 2a — Per-tab state in `useQueueStore`

Add a `tabQueues` map and per-tab UI state slices. Replace the flat `jobs` array with tab-keyed arrays. The existing `jobs` getter becomes derived from the active sub-tab.

```ts
// New fields to add to QueueState
tabQueues: Record<AudioSubTab, QueueJob[]>;
tabFilters: Record<AudioSubTab, string>;
tabSearchQueries: Record<AudioSubTab, string>;
tabSelectedJobIds: Record<AudioSubTab, string[]>;
tabLockedJobIds: Record<AudioSubTab, string[]>;
tabViewModes: Record<AudioSubTab, ViewMode>;
tabGroupByFormat: Record<AudioSubTab, boolean>;
tabJobOperationTypes: Record<AudioSubTab, Record<string, 'enhance' | 'convert'>>;

// Computed selector (not persisted, derived from active sub-tab)
getTabJobs: (tab: AudioSubTab) => QueueJob[];
```

All existing actions (`addJobs`, `deleteJobs`, `setStatus`, `setProgress`, etc.) must accept an optional `tab: AudioSubTab` parameter defaulting to the currently active sub-tab read from `useUIStore.getState().audioSubTab`.

Persist `tabQueues` in Zustand `persist()` middleware (replace the old `jobs` key). Drop the old flat `jobs` from persistence.

### 2b — Import routing

In `src/lib/importHelper.ts`, when `addJobs` is called, read the current `audioSubTab` from `useUIStore.getState()` and route the new jobs to `tabQueues[activeTab]` — not to a shared flat array.

### 2c — Component reads

All components that currently read `useQueueStore((s) => s.jobs)` must be updated to read `useQueueStore((s) => s.getTabJobs(activeSubTab))` (or an equivalent selector), where `activeSubTab` comes from `useUIStore`.

### 2d — Isolation checklist (all must be per-tab)

| State | Currently | After |
|-------|-----------|-------|
| `jobs` array | shared | per-tab |
| `filter` | shared | per-tab |
| `searchQuery` | shared | per-tab |
| `selectedJobIds` | shared | per-tab |
| `lockedJobIds` | shared | per-tab |
| `viewMode` | shared | per-tab |
| `groupByFormat` | shared | per-tab |
| `jobOperationTypes` | shared | per-tab |

---

## Task 3 — Move Record Button Left of Search Bar

**File:** `src/components/QueueToolbar.tsx`

**Current location:** Line 354 — `{activeTab === 'audio' && <RecordButton />}` is rendered inside the action-button group next to "Enhance All"/"Convert All"/"Separate".

**New location:** Render `<RecordButton />` immediately to the **left** of the search `<input>` element (currently ~line 362). The Record button must always be visible when `activeTab === 'audio'` regardless of which sub-tab is active.

**Isolation:** `RecordButton` completes recording and calls `handleImportFiles`. After Task 2, `handleImportFiles` routes the recorded file to the **currently active sub-tab's queue only**. No change needed to `RecordButton` itself — the routing happens automatically via `importHelper`.

**Layout sketch (right-side toolbar section):**
```
[RecordButton] [Search Input] [Filter dropdown] [Format picker] [View] [Group] [Delete]
```

---

## Task 4 — Tab Pill Active State Styling

**File:** `src/components/QueueToolbar.tsx` (lines 306–318)

Replace the `bg-violet-600 text-white shadow-sm` active class on tab pills with a neutral style that does not use the violet accent.

**Recommended replacement (light-gray system):**
```ts
// Active pill
isActive
  ? 'bg-white dark:bg-white/[0.12] text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/[0.10]'
  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06]'
```

This gives a "raised card" feel in light mode and a subtle white-glass feel in dark mode, with no purple. The violet accent is reserved exclusively for the primary action button ("Enhance All") at the bottom.

---

## Task 5 — Move Primary Action Buttons to Bottom-Right

### 5a — Remove action buttons from toolbar

**File:** `src/components/QueueToolbar.tsx`

Remove the conditional action-button block (lines 322–356):
```tsx
{/* Action button — only the active sub-tab's button renders */}
<div className="flex items-center gap-1">
  {audioSubTab === 'enhance' && ( ... Enhance All button ... )}
  {audioSubTab === 'convert' && ( ... Convert All button ... )}
  {audioSubTab === 'separate' && ( ... Separate button ... )}
  {activeTab === 'audio' && <RecordButton />}   ← also moved (Task 3)
</div>
```

### 5b — Add bottom action bar below queue

**File:** `src/components/QueueGrid.tsx` (or a new `QueueActionBar.tsx` component if cleaner)

Add a fixed bottom-right action bar that renders below the scrollable queue table but inside the queue container. It shows one button corresponding to the active sub-tab:

| Active tab | Button label | Button color |
|-----------|-------------|-------------|
| `enhance` | Enhance All | Violet (`bg-violet-600 hover:bg-violet-500 text-white`) |
| `convert` | Convert All | Slate/gray (`ghostBtn` style — same as current convert button) |
| `separate` | Separate All | Slate/gray (`ghostBtn` style) |

The button is disabled when there is nothing to process (same `canEnhance`/`canConvert`/`canSeparate` logic as current toolbar buttons).

**Position:** `flex justify-end` inside a `sticky bottom-0` bar with a subtle top border:
```tsx
<div className="sticky bottom-0 flex justify-end px-4 py-3 border-t border-slate-200 dark:border-white/[0.06] bg-white/80 dark:bg-[#0f1117]/80 backdrop-blur-sm">
  {/* active tab's action button */}
</div>
```

Move `handleProcess`, `handleConvert`, `handleSeparate`, and the `isAnyEnhancing`/`isAnyConverting`/`isSeparating` state to wherever this button lives. If the bottom bar is in `QueueGrid.tsx`, these handlers must be lifted or extracted into a shared hook/store action.

---

## Task 6 — Resizable Columns

**File:** `src/components/QueueGrid.tsx`

Bring back a column resize system. The current `COL_WIDTHS` const (line 41–54) becomes the **default** widths, not hardcoded finals.

### 6a — Resize handle component

```tsx
function ResizeHandle({ onMouseDown }: { onMouseDown: React.MouseEventHandler }): JSX.Element {
  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-violet-500/40 active:bg-violet-500/60 transition-colors"
    />
  );
}
```

### 6b — Resize state

```ts
const [colWidths, setColWidths] = useState<typeof COL_WIDTHS>({ ...COL_WIDTHS });
```

`ResizeHandle` on `<th>` cells triggers a `mousedown` → `mousemove` → `mouseup` drag that computes `delta` and updates the relevant column width. Enforce per-column minimums:

```ts
const MIN_COL_WIDTHS: Partial<typeof COL_WIDTHS> = {
  grip: 24, index: 28, filename: 120, destination: 80, size: 48,
  format: 52, bitrate: 52, sampleRate: 56, status: 52, tools: 80, lock: 32, clear: 36,
};
```

### 6c — Width log export

Add a **"Copy Width Log"** button visible only in dev mode (or always, as a small icon in the toolbar). When clicked it copies a JSON summary to clipboard:

```json
{
  "grip": 28, "index": 34, "filename": 208, "destination": 124,
  "size": 65, "format": 75, "bitrate": 72, "sampleRate": 80,
  "status": 70, "tools": 112, "lock": 41, "clear": 46,
  "total": 955
}
```

This allows the user to resize columns to taste and then hardcode the values back into `COL_WIDTHS` if desired.

### 6d — Apply to all tabs

The same resize system applies to the Enhance, Convert, and Separate table views. If per-tab column widths need to differ (e.g., Separate tab shows Bitrate/SampleHz while Enhance does not), maintain a `colWidths` state per sub-tab or reset widths on tab switch.

---

## Task 7 — Keyboard Shortcut Updates

**Files:**
- `src/types/settings.ts` — `KeyboardShortcutMap` type + `DEFAULT_KEYBOARD_SHORTCUTS` + `SHORTCUT_LABELS`
- `src/hooks/useKeyboardShortcuts.ts` — handler logic

### 7a — Change view-toggle shortcuts

| Action | Old binding | New binding |
|--------|------------|-------------|
| Table view | `1` | `shift+1` |
| Grid view | `2` | `shift+2` |

In `settings.ts` update `DEFAULT_KEYBOARD_SHORTCUTS`:
```ts
tableView: 'shift+1',
gridView: 'shift+2',
```

### 7b — Add tab-switch shortcuts

Add three new entries to `KeyboardShortcutMap`, `DEFAULT_KEYBOARD_SHORTCUTS`, and `SHORTCUT_LABELS`:

```ts
// KeyboardShortcutMap (new fields)
tabEnhance: string;
tabConvert: string;
tabSeparate: string;

// DEFAULT_KEYBOARD_SHORTCUTS
tabEnhance: '1',
tabConvert: '2',
tabSeparate: '3',

// SHORTCUT_LABELS
tabEnhance: 'Switch to Enhance Tab',
tabConvert: 'Switch to Convert Tab',
tabSeparate: 'Switch to Separate Tab',
```

### 7c — Wire handlers in `useKeyboardShortcuts.ts`

Add tab-switch handlers after the existing navigation block (~line 217):
```ts
if (matches(e, sc.tabEnhance)) { ui.setAudioSubTab('enhance'); return; }
if (matches(e, sc.tabConvert)) { ui.setAudioSubTab('convert'); return; }
if (matches(e, sc.tabSeparate)) { ui.setAudioSubTab('separate'); return; }
```

Update the view handlers (~line 243):
```ts
if (matches(e, sc.tableView)) { q.setViewMode('table'); return; }  // now shift+1
if (matches(e, sc.gridView))  { q.setViewMode('grid');  return; }  // now shift+2
```

### 7d — Settings panel documentation update

**File:** `src/components/SettingsPanel.tsx`

In the Keyboard Shortcuts section, add the three new tab-switch entries and update the view-toggle rows to show the new `Shift+1` / `Shift+2` bindings. The settings panel already renders `SHORTCUT_LABELS` dynamically so only the type + defaults changes in 7a–7b are strictly required; verify the panel picks them up correctly.

---

## Task 8 — Strict Tab Isolation for All User Actions

After Task 2 sets up per-tab state, audit and update every consumer to ensure tab isolation:

| Consumer | Isolation required |
|----------|-------------------|
| `QueueToolbar` — search input | reads/writes `tabSearchQueries[activeSubTab]` |
| `QueueToolbar` — filter dropdown | reads/writes `tabFilters[activeSubTab]` |
| `QueueGrid` — sort state (if any) | per-tab |
| `QueueGrid` — selected rows | reads/writes `tabSelectedJobIds[activeSubTab]` |
| `QueueGrid` — locked rows | reads/writes `tabLockedJobIds[activeSubTab]` |
| `QueueGrid` — view mode (table/grid) | reads/writes `tabViewModes[activeSubTab]` |
| `QueueGrid` — group by format | reads/writes `tabGroupByFormat[activeSubTab]` |
| `QueueGrid` — delete action | only deletes from `tabQueues[activeSubTab]` |
| `useKeyboardShortcuts` — Ctrl+A (select all) | selects within `tabQueues[activeSubTab]` only |
| `useKeyboardShortcuts` — Delete | deletes from `tabQueues[activeSubTab]` only |
| `useKeyboardShortcuts` — L / lock | locks within `tabQueues[activeSubTab]` only |
| `useKeyboardShortcuts` — Shift+1/2 view toggle | affects `tabViewModes[activeSubTab]` only |
| `useKeyboardShortcuts` — `1`/`2`/`3` tab switch | switches `audioSubTab` in `useUIStore` |
| `QueueStatusBar` | displays count/status for `tabQueues[activeSubTab]` only |
| `RecordButton` | appends to `tabQueues[activeSubTab]` (automatic via `importHelper`) |

---

## Task 9 — TypeScript Validation & Rebuild

After all code changes:

1. Run `npx tsc --noEmit` — must produce **0 errors**.
2. Kill any running `backend.exe` or `enhance-audio-pro.exe` processes before building.
3. Build:
   ```powershell
   $env:CARGO_TARGET_DIR='D:\cargo_build\enhance-audio-pro'
   npm run tauri build
   ```
4. Confirm output at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe`.
5. Update CLAUDE.md section 13 with a summary of all changes made.
6. Commit with message: `feat: per-tab queue isolation, bottom action bar, column resizing, shortcut updates`

---

## Implementation Order

Execute tasks in this order to avoid breakage at each step:

1. **Task 1** — Tab label rename (trivial, isolated)
2. **Task 4** — Tab pill styling (trivial, isolated)
3. **Task 7** — Keyboard shortcut type + default updates (no UI change yet)
4. **Task 2** — Per-tab queue isolation (core refactor — do this before moving buttons)
5. **Task 3** — Record button relocation (depends on Task 2 for routing correctness)
6. **Task 5** — Move action buttons to bottom-right (depends on Task 2 for state reads)
7. **Task 6** — Column resizing (independent, can be done any time after codebase compiles)
8. **Task 8** — Isolation audit (verify after Tasks 2–5 are complete)
9. **Task 9** — TypeScript check + binary rebuild

---

## Notes & Constraints

- **Path with spaces:** Always set `CARGO_TARGET_DIR=D:\cargo_build\enhance-audio-pro` before any `cargo` or `tauri build` command (see CLAUDE.md §18.14).
- **Process lock:** Kill `backend.exe` / `enhance-audio-pro.exe` before rebuilding.
- **Build command:** `npm run tauri build` — NOT plain `cargo build`.
- **Persistence:** `tabQueues` replaces the old flat `jobs` in Zustand `persist`. The old persisted `jobs` key will be ignored on first load after migration — that is acceptable (queue resets to empty on first launch after update).
- **No Python/Rust changes required** for Tasks 1–8. Task 9 rebuilds the binary unchanged except for the frontend bundle swap.
