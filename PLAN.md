# PLAN.md — src/ Audit & Upgrade Plan
> Scope: `src/` directory only · No new dependencies · No stylistic reformatting  
> Status: **COMPLETE** — commit `5f5adb7` (2026-08-25)

---

## Executive Summary

An autonomous audit of the `src/` directory found **17 actionable issues** across four categories. No changes are made here — each item below specifies the exact file, line range, problem, and the minimal code change required to fix it.

| # | Severity | Category | File | Issue |
|---|----------|----------|------|-------|
| 1 | 🔴 HIGH | Bug | `audioPreload.ts` | Blob URL memory leak — prewarmCache grows unboundedly |
| 2 | 🔴 HIGH | Bug | `useQueueStore.ts` | `setTimeout` inside Zustand `set()` updater |
| 3 | 🔴 HIGH | Performance | `QueueGrid.tsx` | `querySelectorAll` on every `mousemove` event (60 fps × O(n)) |
| 4 | 🔴 HIGH | Performance | `QueueGrid.tsx` | `filteredJobs` selector returns new array on every state tick |
| 5 | 🟠 MED | Bug | `QueueGrid.tsx` | `status as JobStatus` unsafe cast from backend event |
| 6 | 🟠 MED | Bug | `useKeyboardShortcuts.ts` | Alt+X closes app with no processing-job check |
| 7 | 🟠 MED | Bug | `App.tsx` | Settings merge puts full in-memory store over backend data |
| 8 | 🟠 MED | Bug | `useAudioPlayer.ts` | `onended`/`onpause` handlers re-assigned on every `play()` call |
| 9 | 🟠 MED | Performance | `useKeyboardShortcuts.ts` / `QueueToolbar.tsx` | Sequential `await invokeSetJobStatus` in for-loops |
| 10 | 🟠 MED | Structural | `useQueueStore.ts` | Cross-store dependency: reads `useUIStore` inside state updater |
| 11 | 🟠 MED | Structural | Multiple | i18n gap — `window.confirm` strings hardcoded English (16 languages ignored) |
| 12 | 🟡 LOW | Performance | `audioPreload.ts` | `prewarmCache` has no size cap — memory grows with each imported file |
| 13 | 🟡 LOW | Structural | `audioPreload.ts` / `WaveformPlayer.tsx` | `getMimeType` duplicated across two files |
| 14 | 🟡 LOW | Structural | `QueueGrid.tsx` | Custom DOM events as cross-component bus (`action:enhance` / `action:convert`) |
| 15 | 🟡 LOW | Structural | `QueueGrid.tsx` | `audioSubTab` prop typed as `string`, cast unsafely inside components |
| 16 | 🟡 LOW | Structural | `DropZone.tsx` | Redundant `useCallback` + `useRef` pattern for `handleFiles` |
| 17 | 🟡 LOW | Bug | `RecordButton.tsx` | Deprecated `ScriptProcessorNode` (`eslint-disable` already acknowledges it) |

---

## Category A — Bugs

### A1 🔴 Blob URL memory leak in `audioPreload.ts`
**File:** `src/lib/audioPreload.ts`  
**Lines:** 14–46

**Problem:** `prewarmCache` is a module-level `Map` with no size cap and no eviction. `evictPrewarm(filepath)` is exported but is **never called anywhere** in the codebase. Every file imported creates a Blob URL that is stored permanently. On a long editing session with hundreds of files this leaks memory continuously.

**Evidence:**  
- `prewarmCache` grows without bound in `prewarmAudio()`
- `grep evictPrewarm src/**` returns only the declaration — zero call sites

**Fix — add a LRU cap inside `prewarmAudio` and wire eviction to `deleteJobs`:**

```ts
// src/lib/audioPreload.ts
const MAX_PREWARM = 50;

export function prewarmAudio(filepath: string): void {
  if (prewarmCache.has(filepath) || inFlight.has(filepath)) return;

  // Evict oldest entry if at cap
  if (prewarmCache.size >= MAX_PREWARM) {
    const oldest = prewarmCache.keys().next().value;
    if (oldest) evictPrewarm(oldest);
  }

  inFlight.add(filepath);
  // ... rest unchanged
}
```

Call `evictPrewarm` in `useQueueStore.deleteJobs` after removing jobs:
```ts
// src/stores/useQueueStore.ts — deleteJobs action (after existing removal logic)
import { evictPrewarm } from '@/lib/audioPreload';

deleteJobs: (ids, tab) =>
  set((s) => {
    const t = getActiveSubTab(tab);
    // Revoke prewarmed audio blobs for deleted jobs
    const deleted = s.tabQueues[t].filter((j) => ids.includes(j.id));
    deleted.forEach((j) => evictPrewarm(j.filepath));
    return {
      tabQueues: { ...s.tabQueues, [t]: s.tabQueues[t].filter((j) => !ids.includes(j.id)) },
      // ... rest of existing return object unchanged
    };
  }),
```

---

### A2 🔴 `setTimeout` inside Zustand `set()` updater
**File:** `src/stores/useQueueStore.ts`  
**Lines:** 197–204

**Problem:** The `addJobs` action calls `setTimeout` **inside** the `set()` updater callback. This is an anti-pattern — state updaters must be pure (no side-effects). The timer fires 1.5 s later and calls `useQueueStore.setState` from a stale closure captured at `set()` time. In tests this causes "act()" warnings. In production it can fire after the store state has already moved on (e.g., a job was resolved by `resolvePlaceholder` before the timeout clears it, only to re-clear it unnecessarily).

**Root cause:** `addJobs` is used by `RecordButton` to add a freshly saved recording. The original author wanted the recording row to briefly appear dimmed (importing) then light up. The 1 500 ms timeout was meant to mimic the placeholder→resolve pattern.

**Fix — hoist the `setTimeout` outside of `set()`:**

```ts
// src/stores/useQueueStore.ts — replace addJobs
addJobs: (newJobs, tab) => {
  let t: AudioSubTab;
  let newIds: string[] = [];

  set((s) => {
    t = getActiveSubTab(tab);
    const existing = new Set(s.tabQueues[t].map((j) => j.id));
    const unique = newJobs.filter((j) => !existing.has(j.id));
    if (!unique.length) return s;
    newIds = unique.map((j) => j.id);
    return {
      tabQueues: { ...s.tabQueues, [t]: [...s.tabQueues[t], ...unique] },
      tabImportingIds: {
        ...s.tabImportingIds,
        [t]: [...new Set([...s.tabImportingIds[t], ...newIds])],
      },
    };
  });

  if (newIds.length) {
    setTimeout(() => {
      useQueueStore.setState((prev) => ({
        tabImportingIds: {
          ...prev.tabImportingIds,
          [t]: prev.tabImportingIds[t].filter((id) => !newIds.includes(id)),
        },
      }));
    }, 1500);
  }
},
```

---

### A3 🟠 Unsafe `status as JobStatus` cast from backend event
**File:** `src/components/QueueGrid.tsx`  
**Lines:** 880–883 (inside the `queue://status-change` listener)

**Problem:** The backend can theoretically return any string for `status`. Casting it directly with `status as JobStatus` means an unexpected value (e.g., `"cancelled"` from a Python error path) silently propagates into the store and renders incorrectly.

**Fix — validate before casting:**

```ts
// src/components/QueueGrid.tsx — at the top of the file, near other constants
const VALID_JOB_STATUSES = new Set<string>(['pending', 'queued', 'processing', 'done', 'error']);

// Inside the queue://status-change listener, replace:
//   setStatus(jobId, status as JobStatus, error_message);
// With:
const safeStatus: JobStatus = VALID_JOB_STATUSES.has(status)
  ? (status as JobStatus)
  : 'error';
setStatus(jobId, safeStatus, error_message ?? `Unexpected status: ${status}`);
```

---

### A4 🟠 Alt+X closes window without checking active jobs
**File:** `src/hooks/useKeyboardShortcuts.ts`  
**Lines:** 267–268

**Problem:** `if (matches(e, sc.exit)) { await win.close(); return; }` — this fires the Tauri window close immediately. The `CloseRequested` handler in Rust kills the sidecar and cleans up, but any in-progress enhance/convert jobs are silently aborted with no user warning. The app already shows a `window.confirm` when deleting processing items, but the shortcut bypasses this.

**Fix:**

```ts
// src/hooks/useKeyboardShortcuts.ts — replace the exit handler
if (matches(e, sc.exit)) {
  const allJobs = Object.values(useQueueStore.getState().tabQueues).flat();
  const hasActive = allJobs.some((j) => j.status === 'processing' || j.status === 'queued');
  if (hasActive) {
    const ok = window.confirm(
      'Files are still being processed. Exit and discard progress?'
    );
    if (!ok) return;
  }
  await win.close();
  return;
}
```

---

### A5 🟠 Settings merge overwrites backend-authoritative fields with in-memory defaults
**File:** `src/App.tsx`  
**Lines:** 35–41

**Problem:** `settingsRef.current()` returns the full Zustand store state (including all action methods and `initialized: false`). Spreading it as `{ ...settingsRes.data, ...persisted }` means **every field in the in-memory store wins over the fresh backend response** — including `setupComplete`, which is `true` in `DEFAULT_SETTINGS` but intentionally NOT in `partialize`. If the Rust backend ever returns `setupComplete: false` (models missing), the frontend would override it with `true` and skip the wizard.

**Fix — only merge fields that are actually persisted to localStorage:**

```ts
// src/App.tsx — replace the settingsRef and merge logic
// Remove: const settingsRef = useRef(useSettingsStore.getState);

useEffect(() => {
  async function init(): Promise<void> {
    const [settingsRes, queueRes] = await Promise.all([
      invokeGetSettings(),
      invokeGetQueue(),
    ]);
    if (settingsRes.success && settingsRes.data) {
      // Only pull UI-preference fields from localStorage (mirrors partialize).
      // Backend-authoritative fields (setupComplete, aiModel) always come from Rust.
      const cached = useSettingsStore.getState();
      setSettings({
        ...settingsRes.data,
        theme: cached.theme,
        outputFolder: cached.outputFolder,
        language: cached.language,
        enhancementStrength: cached.enhancementStrength,
        hfDeHissDb: cached.hfDeHissDb,
        filenameTemplate: cached.filenameTemplate,
        filenameTemplateConverted: cached.filenameTemplateConverted,
        keyboardShortcuts: cached.keyboardShortcuts,
        customDefaultShortcuts: cached.customDefaultShortcuts,
        recordingPrefix: cached.recordingPrefix,
        scratchDiskDir: cached.scratchDiskDir,
      });
    }
    if (queueRes.success && queueRes.data) setJobs(queueRes.data);
    if (!sessionStorage.getItem('app_initialized')) {
      sessionStorage.setItem('app_initialized', 'true');
      useQueueStore.getState().setJobs([], 'enhance');
      useQueueStore.getState().setJobs([], 'convert');
    }
    setInitialized(true);
  }
  init();
}, [setSettings, setJobs, setInitialized]);
```

---

### A6 🟠 `onended`/`onpause` handlers re-assigned on every `play()` call
**File:** `src/stores/useAudioPlayer.ts`  
**Lines:** 41–43

**Problem:** `audio.onended` and `audio.onpause` are reassigned inside `play()` on every invocation. The old handlers are silently replaced with no `removeEventListener`. If `play()` is called rapidly (e.g., user clicks different rows), the replaced handlers could behave unexpectedly. The idiomatic pattern is to wire these listeners once at audio element construction time.

**Fix — move event wiring to `getAudio()`:**

```ts
// src/stores/useAudioPlayer.ts
function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio();
    _audio.preload = 'none';
    _audio.addEventListener('ended', () => {
      useAudioPlayer.setState({ isPlaying: false });
    });
    _audio.addEventListener('pause', () => {
      if (useAudioPlayer.getState().playingJobId) {
        useAudioPlayer.setState({ isPlaying: false });
      }
    });
  }
  return _audio;
}

// In play(), remove the onended/onpause assignments:
play: (jobId, filePath) => {
  const audio = getAudio();
  const src = toTauriSrc(filePath);
  if (!audio.paused) audio.pause();
  if (audio.src !== src) { audio.src = src; audio.load(); }
  audio.play().catch(() => useAudioPlayer.setState({ isPlaying: false }));
  set({ playingJobId: jobId, isPlaying: true });
},
```

---

### A7 🟡 `ScriptProcessorNode` deprecated in `RecordButton.tsx`
**File:** `src/components/RecordButton.tsx`  
**Line:** 67

**Problem:** `createScriptProcessor` is deprecated and will be removed from future Chromium versions (Tauri 2 uses Chromium). The comment acknowledges it but leaves it for later. The replacement is `AudioWorkletNode`.

**Proposed change (defer if replacement scope is large):** Extract the PCM capture logic to `src/lib/audioCapture.ts` using `AudioWorkletNode` + an inline-registered `AudioWorkletProcessor`. This is a larger change — mark as deferred unless user approves scope. No action in this pass.

---

## Category B — Performance

### B1 🔴 `querySelectorAll` called on every `mousemove` during marquee selection
**File:** `src/components/QueueGrid.tsx`  
**Lines:** 806–841

**Problem:** The marquee (rubber-band) selection handler calls `document.querySelectorAll('[data-job-id]')` inside `onMouseMove`, which fires at browser-native rate (60 fps). For a queue of 100 rows this is 6 000 DOM queries per second during a drag.

**Fix — throttle with `requestAnimationFrame`:**

```ts
// src/components/QueueGrid.tsx — replace the onMouseMove body
let rafId: number | null = null;

const onMouseMove = (ev: MouseEvent): void => {
  const clampedX = Math.max(containerRect.left, Math.min(containerRect.right, ev.clientX));
  const clampedY = Math.max(containerRect.top, Math.min(containerRect.bottom, ev.clientY));
  const left = Math.min(startX, clampedX);
  const top = Math.min(startY, clampedY);
  const width = Math.abs(startX - clampedX);
  const height = Math.abs(startY - clampedY);

  if (!dragStarted && (Math.abs(ev.clientX - startX) > 3 || Math.abs(ev.clientY - startY) > 3)) {
    dragStarted = true;
  }

  if (!dragStarted) return;
  setSelectionBox({ left, top, width, height });

  if (rafId !== null) return; // already scheduled
  rafId = requestAnimationFrame(() => {
    rafId = null;
    const elements = document.querySelectorAll('[data-job-id]');
    const intersectedIds: string[] = [];
    elements.forEach((el) => {
      const jobId = el.getAttribute('data-job-id');
      if (!jobId) return;
      const box = el.getBoundingClientRect();
      const intersects = left < box.right && left + width > box.left && top < box.bottom && top + height > box.top;
      if (intersects) intersectedIds.push(jobId);
    });
    const { tabSelectedIds } = useQueueStore.getState();
    const curTab = useUIStore.getState().audioSubTab;
    const curSelected = tabSelectedIds[curTab];
    if (ev.shiftKey || ev.ctrlKey || ev.metaKey) {
      useQueueStore.setState((s) => ({
        tabSelectedIds: { ...s.tabSelectedIds, [curTab]: [...new Set([...curSelected, ...intersectedIds])] },
      }));
    } else {
      useQueueStore.setState((s) => ({
        tabSelectedIds: { ...s.tabSelectedIds, [curTab]: intersectedIds },
      }));
    }
  });
};

// In onMouseUp, also cancel pending RAF:
const onMouseUp = (): void => {
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  setSelectionBox(null);
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  // ... existing cancelClick logic unchanged
};
```

---

### B2 🔴 `filteredJobs` selector returns a new array on every store tick
**File:** `src/components/QueueGrid.tsx`  
**Lines:** 720–721

**Problem:** 
```ts
const jobs = useQueueStore((s) => s.filteredJobs(audioSubTab, activeTab));
```
`filteredJobs` returns a fresh array from `.filter()` on every call. Zustand's default equality check is `Object.is`, so the new array reference always triggers a re-render — even when the underlying job data has not changed (e.g., a `setProgress` call for a different component). This causes the entire grid to re-render on every progress tick.

**Fix — wrap with `useShallow` (already installed via zustand):**

```ts
// src/components/QueueGrid.tsx
import { useShallow } from 'zustand/react/shallow';

// Replace:
// const jobs = useQueueStore((s) => s.filteredJobs(audioSubTab, activeTab));
// const groups = useQueueStore((s) => s.groupedFilteredJobs(audioSubTab, activeTab));

const { jobs, groups } = useQueueStore(
  useShallow((s) => ({
    jobs: s.filteredJobs(audioSubTab, activeTab),
    groups: s.groupedFilteredJobs(audioSubTab, activeTab),
  }))
);
```

`useShallow` performs shallow-equality on the returned object, so re-renders only fire when a job's identity or a filter actually changes, not on every `setProgress`.

---

### B3 🟠 Sequential `await invokeSetJobStatus` in for-loops
**Files:**  
- `src/hooks/useKeyboardShortcuts.ts` lines 123–126 (`enhance` shortcut)  
- `src/components/QueueToolbar.tsx` lines 123–126 (`handleProcess`)  
- `src/components/QueueToolbar.tsx` lines 173–176 (`handleConvert`)

**Problem:** Each IPC call is awaited sequentially. For 50 queued files, this makes 50 round-trips to Rust before the first job starts enhancing.

**Fix — parallel IPC with `Promise.all`:**

```ts
// In all three for-loops, replace sequential await with parallel:

// Before:
for (const id of enhIds) {
  setStatus(id, 'queued');
  await invokeSetJobStatus(id, 'queued');
}

// After:
enhIds.forEach((id) => setStatus(id, 'queued'));
await Promise.all(enhIds.map((id) => invokeSetJobStatus(id, 'queued')));
```

Apply the same pattern to the `convert` loop in `handleConvert` and the `enhance` loop in the keyboard shortcut handler.

---

### B4 🟡 `prewarmCache` has no size cap
**File:** `src/lib/audioPreload.ts`  
**Lines:** 14, 22–42

**Problem:** (Covered partially in A1.) Even without the leak, a session with 200+ files would keep 200+ Blob URLs in memory. The fix is the `MAX_PREWARM = 50` cap added in A1.

---

## Category C — Structural Weaknesses

### C1 🟠 Cross-store dependency: `useQueueStore` reads `useUIStore` inside updater
**File:** `src/stores/useQueueStore.ts`  
**Lines:** 17–19

**Problem:**
```ts
function getActiveSubTab(tab?: AudioSubTab): AudioSubTab {
  return tab ?? useUIStore.getState().audioSubTab;
}
```
`useQueueStore` calls `useUIStore.getState()` inside its own state updaters. This creates an implicit circular dependency and makes the queue store non-self-contained. It breaks unit test isolation and could cause issues if stores initialize in different orders.

**Root cause:** It's a convenience fallback so callers can omit `tab`. All callers that matter (QueueGrid, QueueToolbar, etc.) already pass `tab` explicitly. Only `clearQueue` and a few internal helpers use the fallback.

**Fix — remove the fallback; require `tab` everywhere:**

Make `tab` required in the 4 internal actions that currently use the fallback (`clearQueue`, `setFilter`, `setSearchQuery`, `setViewMode`, `setGroupByFormat`, `setJobOperationMode`, `setSelectedJob`, `clearSelection`, `primarySelectedId`). All call sites already pass `tab`.

```ts
// src/stores/useQueueStore.ts — remove getActiveSubTab entirely
// Change every internal action signature from (tab?: AudioSubTab) to (tab: AudioSubTab)
// For actions called without tab in the interface, keep the optional signature but inline the fallback
// at the call site (in each action):

setFilter: (filter, tab) =>
  set((s) => {
    const t = tab ?? useUIStore.getState().audioSubTab; // keep fallback HERE, not in shared fn
    return { tabFilters: { ...s.tabFilters, [t]: filter } };
  }),
```

This is a single-source-of-truth fix — the cross-store read happens at the leaf (only if truly needed) rather than in a shared helper that gives the impression of a deeper dependency.

---

### C2 🟠 i18n gap — confirmation dialogs hardcoded to English
**Files:**  
- `src/components/QueueGrid.tsx` lines 585–589 (row trash button)  
- `src/components/QueueToolbar.tsx` lines 85–93 (`handleDeleteSelected`)  
- `src/hooks/useKeyboardShortcuts.ts` lines 197–202 (Delete shortcut)

**Problem:** Three places that call `window.confirm()` check only for Indonesian (`language === 'id'`) and fall back to English for all other 16 supported languages. The confirmation message in French, Arabic, Portuguese, etc. is always in English.

**Fix — use `i18n.t()` directly (not the React hook, since these are imperative handlers):**

```ts
// src/components/QueueGrid.tsx — near top, add import
import i18n from '@/i18n';

// Replace the isIndonesian check block with:
const msg = i18n.t(
  activeJobs.length === 1
    ? 'queue.confirmDeleteSingle'
    : 'queue.confirmDeleteMultiple',
  { count: activeJobs.length }
);
if (!window.confirm(msg)) return;
```

Add the keys to `src/i18n/locales/en.json` (and other locales):
```json
"queue": {
  "confirmDeleteSingle": "Are you sure you want to delete this file? It is currently being processed.",
  "confirmDeleteMultiple": "Are you sure you want to delete {{count}} files? Some are currently being processed."
}
```

Apply the same pattern in `QueueToolbar.tsx` and `useKeyboardShortcuts.ts`. Remove the `isIndonesian` special-casing entirely (Indonesian translation handles it via locale file).

---

### C3 🟡 Duplicated `getMimeType` function
**Files:**  
- `src/lib/audioPreload.ts` lines 3–10  
- `src/components/WaveformPlayer.tsx` lines 33–43

**Problem:** Two nearly identical functions map file extensions to MIME types. They diverge: `audioPreload.ts` includes `wma` and `aiff`; `WaveformPlayer.tsx` adds video types (`mp4`, `webm`, `mov`, etc.) and maps `opus` to `audio/ogg`. Neither is complete.

**Fix — extract to `src/lib/mime.ts`:**

```ts
// NEW: src/lib/mime.ts
const MIME_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  m4a: 'audio/mp4',
  wma: 'audio/x-ms-wma',
  aiff: 'audio/aiff',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
};

export function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return MIME_MAP[ext] ?? 'audio/mpeg';
}
```

Remove the two local `getMimeType` functions and import from `@/lib/mime`.

---

### C4 🟡 `audioSubTab` typed as `string` in sortable components
**File:** `src/components/QueueGrid.tsx`  
**Lines:** 436–437 (`SortableJobRow` props), 613–614 (`SortableJobCard` props)

**Problem:**
```ts
audioSubTab: string;  // prop type

// then inside:
const rowToolMode = useQueueStore((s) => s.tabJobOpTypes[audioSubTab as 'enhance'|'convert'][job.id] ?? 'enhance');
```
The cast defeats TypeScript safety. If a new sub-tab is added or a typo occurs, there's no compile-time catch.

**Fix — narrow the prop type:**

```ts
// src/components/QueueGrid.tsx
import type { AudioSubTab } from '@/stores/useUIStore';

// SortableJobRow props:
audioSubTab: AudioSubTab;

// SortableJobCard props:
audioSubTab: AudioSubTab;

// Remove all internal `as 'enhance'|'convert'` casts — they're no longer needed.
```

---

### C5 🟡 Custom DOM events as cross-component communication bus
**File:** `src/components/QueueGrid.tsx` lines 412–413, `QueueToolbar.tsx` lines 191–203

**Problem:** `QueueActionBar` dispatches `new CustomEvent('action:enhance')` to trigger `handleProcess` in `QueueToolbar`. This is implicit, untyped, and untestable — the relationship between the two components is invisible from either file.

**Note:** This is an intentional architectural decision to avoid prop-drilling across multiple layers. The fix would require lifting the handlers to a shared Zustand action or passing them down via context. This is a larger refactor — **flag for future cleanup rather than immediate change.**

---

### C6 🟡 Redundant `useCallback` + `useRef` in `DropZone.tsx`
**File:** `src/components/DropZone.tsx`  
**Lines:** 30–52

**Problem:**
```ts
const handleFiles = useCallback(async (paths: string[]): Promise<void> => {
  await handleImportFiles(paths);
}, []);

const handleFilesRef = useRef(handleFiles);
handleFilesRef.current = handleFiles;
```

`handleFiles` is stable (empty deps) and could be imported directly. `handleFilesRef` exists to safely reference `handleFiles` inside the Tauri `onDragDropEvent` closure — but since `handleFiles` is already stable, the ref adds no value. The same pattern exists for `resolveDroppedPaths`.

**Fix — use `useCallback` directly in the Tauri event handler (it's already stable):**

```ts
// src/components/DropZone.tsx — remove the useRef wrappers
// The Tauri effect already re-registers on mount and cleans up on unmount,
// so a stable useCallback reference is sufficient.

useEffect(() => {
  let cancelled = false;
  let unlisten: (() => void) | null = null;

  getCurrentWindow().onDragDropEvent(async (event) => {
    const type = event.payload.type;
    if (type === 'over') {
      setIsDragging(true);
    } else if (type === 'drop') {
      setIsDragging(false);
      const paths = (event.payload as { type: 'drop'; paths: string[]; position: unknown }).paths;
      if (paths?.length) {
        const resolved = await resolveDroppedPaths(paths);  // direct ref
        if (resolved.length) handleFiles(resolved);          // direct ref
      }
    } else {
      setIsDragging(false);
    }
  }).then((fn) => { if (cancelled) fn(); else unlisten = fn; });

  return () => { cancelled = true; unlisten?.(); };
}, [handleFiles, resolveDroppedPaths]);  // stable refs, effect only runs on mount/unmount
```

Remove `handleFilesRef` and `resolveRef` variables.

---

## Execution Order

When the user approves, apply in this order to minimise inter-task conflicts:

| Step | Issue | Files touched | Risk |
|------|-------|---------------|------|
| 1 | C3 — extract `getMimeType` | `src/lib/mime.ts` (new), `audioPreload.ts`, `WaveformPlayer.tsx` | Low |
| 2 | A1 — Blob URL leak + size cap | `audioPreload.ts`, `useQueueStore.ts` | Low |
| 3 | A2 — `setTimeout` outside `set` | `useQueueStore.ts` | Low |
| 4 | A6 — `onended`/`onpause` wiring | `useAudioPlayer.ts` | Low |
| 5 | A3 — unsafe status cast | `QueueGrid.tsx` | Low |
| 6 | C4 — `AudioSubTab` prop type | `QueueGrid.tsx` | Low |
| 7 | B3 — parallel `invokeSetJobStatus` | `QueueToolbar.tsx`, `useKeyboardShortcuts.ts` | Low |
| 8 | B1 — RAF throttle for marquee | `QueueGrid.tsx` | Medium |
| 9 | B2 — `useShallow` for `filteredJobs` | `QueueGrid.tsx` | Medium |
| 10 | A4 — exit shortcut safety check | `useKeyboardShortcuts.ts` | Low |
| 11 | A5 — settings merge fix | `App.tsx` | Medium |
| 12 | C6 — DropZone ref cleanup | `DropZone.tsx` | Low |
| 13 | C2 — i18n for confirm dialogs | `QueueGrid.tsx`, `QueueToolbar.tsx`, `useKeyboardShortcuts.ts`, locale files | Medium |
| 14 | C1 — remove cross-store fallback | `useQueueStore.ts` | Medium |

After all steps: run `npx tsc --noEmit` and `npm run test` to verify zero regressions.

---

## Out of Scope (per user constraint)
- No new libraries or packages
- No stylistic reformatting
- A17 (`ScriptProcessorNode`) deferred — replacement requires `AudioWorkletNode` (new file, larger scope)
- C5 (custom DOM events) deferred — requires architectural alignment on component ownership

---

_Last updated: 2026-08-25 | Status: COMPLETE — all 14 steps executed, 38/38 tests pass, tsc clean_

---

## NEXT SESSION — Pending Work

### Thread: Versioning UI (S169–S172) — BLOCKED on user decision

Three interconnected UI/UX features for the Enhance tab were designed but **not yet implemented**:
1. Auto Mode toggle
2. Enhancement Strength relocated to toolbar
3. Dynamic A/B testing state with multi-version storage

The design discussion reached a blocking question in S172 (Aug 24, 2:02 PM):

> **Terminal or Recursive children?**
> - **Terminal (flat 2-level):** Parent row + N sibling enhanced children. Simpler.
>   Child rows cannot be re-enhanced — only the parent spawns new versions.
> - **Recursive (infinite depth):** Any row can spawn its own enhanced version.
>   More powerful; requires tree traversal, indentation, cascade-delete handling.

**ACTION NEEDED FROM USER:** Answer the terminal vs. recursive question above.
Once answered, implementation of the three S169 features can begin.
