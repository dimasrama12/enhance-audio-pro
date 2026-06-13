# Convert Feature — Full Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the queue file-count cap, make Convert All sequential (one job processing / rest queued), add a per-row Enhance/Convert mode dropdown, reorder toolbar buttons, wire a completion toast with "Download All" action, and rebuild the binary.

**Architecture:** A `jobOperationTypes: Record<string, 'enhance'|'convert'>` Zustand map (not persisted, no DB change) tracks which operation each queued job should run. The existing auto-advance listener in `QueueGrid` reads this map to dispatch `invokeProcessQueue` or `invokeConvertFiles` for the next queued job. `handleConvert` in the toolbar now mirrors `handleProcess` exactly — mark all pending as `queued`, kick the first, let auto-advance chain the rest. A `useEffect` fires a bottom-right action toast when the last convert job settles.

**Tech Stack:** React/TypeScript (Zustand, Framer Motion, Tailwind, lucide-react), Rust/Tauri v2, Python FastAPI (asyncio lock), `@tauri-apps/plugin-dialog`

---

## File Map

| File | What changes |
|---|---|
| `src/lib/importHelper.ts` | Remove `MAX_QUEUE_JOBS` constant + capacity-check block entirely |
| `src/stores/useToastStore.ts` | Add `ToastAction` type; extend `ToastEntry` with optional `action?` + `duration?`; update `addToast` signature |
| `src/components/ToastContainer.tsx` | Render `toast.action` as an inline button; honor `toast.duration` for auto-dismiss |
| `src/stores/useQueueStore.ts` | Add `jobOperationTypes: Record<string, 'enhance'\|'convert'>` + `setJobOperationMode` action |
| `src/components/QueueGrid.tsx` | Add `ToolModeSelect` + `ConvertRowButton` components; update TOOLS column; fix auto-advance to check `jobOperationTypes`; add `invokeConvertFiles` import |
| `src/components/QueueToolbar.tsx` | Reorder buttons (Enhance All → Convert All → Separate → Record); replace `handleConvert` with sequential pattern; add completion toast + Download All helper; add missing imports |
| `src/hooks/useKeyboardShortcuts.ts` | Fix `C` shortcut handler to use the sequential queue pattern |
| `backend/routers/convert.py` | Add `_convert_lock = asyncio.Lock()` + per-job "processing" heartbeat callback |

---

## Task 1 — Remove queue file-count limit

**Files:** Modify `src/lib/importHelper.ts`

- [ ] **Step 1 — Delete the constant and the cap-check block**

  Open `src/lib/importHelper.ts`. Remove lines 8 and 29–48 exactly as shown.

  **Before (lines 8, 29–48):**
  ```typescript
  export const MAX_QUEUE_JOBS = 150;

  // ... (inside handleImportFiles, after valid.length === 0 check)

  // Enforce queue capacity limit
  const currentCount = useQueueStore.getState().jobs.length;
  const remaining = MAX_QUEUE_JOBS - currentCount;

  if (remaining <= 0) {
    ui.setImportLimitWarning(`Queue is full (${MAX_QUEUE_JOBS} files max). Remove items to add more.`);
    setTimeout(() => ui.setImportLimitWarning(null), 5000);
    ui.setIsImporting(false);
    return;
  }

  const capped = remaining < valid.length ? valid.slice(0, remaining) : valid;
  const trimmedByLimit = valid.length - capped.length;

  if (trimmedByLimit > 0) {
    ui.setImportLimitWarning(
      `Queue limit reached: only ${capped.length} of ${valid.length} files added (max ${MAX_QUEUE_JOBS}).`
    );
    setTimeout(() => ui.setImportLimitWarning(null), 5000);
  }
  ```

  **After** — replace that entire block with just the `capped` assignment (no limit, use all valid files):
  ```typescript
  const capped = valid;
  ```

  The constant `MAX_QUEUE_JOBS` export is removed entirely. Any file that imports it will produce a compile error — fix those by removing the import.

- [ ] **Step 2 — Verify no remaining `MAX_QUEUE_JOBS` references**

  ```powershell
  Select-String -Path "src\lib\importHelper.ts" -Pattern "MAX_QUEUE_JOBS"
  ```
  Expected: no output.

- [ ] **Step 3 — TypeScript check**

  ```powershell
  cd "D:\vibe coding\app enhance audio pro"; npx tsc --noEmit 2>&1 | Select-Object -First 20
  ```
  Expected: no output (zero errors).

- [ ] **Step 4 — Commit**

  ```powershell
  git add src/lib/importHelper.ts
  git commit -m "feat: remove queue file-count limit — accept unlimited audio files"
  ```

---

## Task 2 — Extend toast store with action + duration support

**Files:** Modify `src/stores/useToastStore.ts`

- [ ] **Step 1 — Replace the entire file**

  ```typescript
  import { create } from 'zustand';

  export type ToastType = 'success' | 'error' | 'info';

  export interface ToastAction {
    label: string;
    onClick: () => void;
  }

  export interface ToastEntry {
    id: string;
    message: string;
    type: ToastType;
    action?: ToastAction;
    duration?: number; // ms; defaults to 3500
  }

  interface ToastState {
    toasts: ToastEntry[];
    addToast: (message: string, type: ToastType, action?: ToastAction, duration?: number) => void;
    dismissToast: (id: string) => void;
  }

  export const useToastStore = create<ToastState>((set) => ({
    toasts: [],

    addToast: (message, type, action, duration = 3500) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      set((s) => ({ toasts: [...s.toasts, { id, message, type, action, duration }] }));
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    },

    dismissToast: (id) => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },
  }));
  ```

- [ ] **Step 2 — TypeScript check**

  ```powershell
  npx tsc --noEmit 2>&1 | Select-Object -First 20
  ```
  Expected: no output. (All existing `addToast(msg, type)` callers still work — new params are optional.)

- [ ] **Step 3 — Commit**

  ```powershell
  git add src/stores/useToastStore.ts
  git commit -m "feat: extend toast store with optional action button and custom duration"
  ```

---

## Task 3 — Render action button in ToastContainer

**Files:** Modify `src/components/ToastContainer.tsx`

- [ ] **Step 1 — Replace the entire file**

  ```tsx
  import { AnimatePresence, motion } from 'framer-motion';
  import { CheckCircle, XCircle, Info, X, Download } from 'lucide-react';
  import { useToastStore } from '@/stores/useToastStore';

  const TOAST_STYLES = {
    success: {
      wrap: 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200',
      icon: <CheckCircle size={16} className="shrink-0 mt-0.5 text-emerald-500 dark:text-emerald-400" />,
    },
    error: {
      wrap: 'bg-red-50 dark:bg-red-950/80 border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-200',
      icon: <XCircle size={16} className="shrink-0 mt-0.5 text-red-500 dark:text-red-400" />,
    },
    info: {
      wrap: 'bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800/60 text-blue-800 dark:text-blue-200',
      icon: <Info size={16} className="shrink-0 mt-0.5 text-blue-500 dark:text-blue-400" />,
    },
  };

  export default function ToastContainer(): JSX.Element {
    const { toasts, dismissToast } = useToastStore();

    return (
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const style = TOAST_STYLES[toast.type];
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 60, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.9 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={[
                  'pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm max-w-xs',
                  'border backdrop-blur-sm',
                  style.wrap,
                ].join(' ')}
              >
                {style.icon}
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <span className="leading-snug">{toast.message}</span>
                  {toast.action && (
                    <button
                      onClick={() => {
                        toast.action!.onClick();
                        dismissToast(toast.id);
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity self-start"
                    >
                      <Download size={11} />
                      {toast.action.label}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => dismissToast(toast.id)}
                  className="shrink-0 opacity-50 hover:opacity-100 transition-opacity mt-0.5"
                  aria-label="Dismiss"
                >
                  <X size={13} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    );
  }
  ```

- [ ] **Step 2 — TypeScript check**

  ```powershell
  npx tsc --noEmit 2>&1 | Select-Object -First 20
  ```
  Expected: no output.

- [ ] **Step 3 — Commit**

  ```powershell
  git add src/components/ToastContainer.tsx
  git commit -m "feat: render action button in toast for download-all notification"
  ```

---

## Task 4 — Add jobOperationTypes map to Zustand queue store

**Files:** Modify `src/stores/useQueueStore.ts`

- [ ] **Step 1 — Add the type + field to the interface**

  In `src/stores/useQueueStore.ts`, find the `interface QueueState` block and add two lines after the `setDownloadPath` line:

  ```typescript
  // Operation type tracking (not persisted — UI only)
  jobOperationTypes: Record<string, 'enhance' | 'convert'>;
  setJobOperationMode: (id: string, mode: 'enhance' | 'convert') => void;
  ```

- [ ] **Step 2 — Add the initial state value inside the `(set, get) =>` object**

  Directly after `groupByFormat: false,` add:

  ```typescript
  jobOperationTypes: {},
  ```

- [ ] **Step 3 — Add the action implementation**

  Directly after the `setDownloadPath` implementation add:

  ```typescript
  setJobOperationMode: (id, mode) =>
    set((s) => ({ jobOperationTypes: { ...s.jobOperationTypes, [id]: mode } })),
  ```

- [ ] **Step 4 — Ensure it is NOT persisted**

  The existing `partialize` option in the `persist` call is:
  ```typescript
  partialize: (state) => ({ filter: state.filter, viewMode: state.viewMode, groupByFormat: state.groupByFormat }),
  ```
  `jobOperationTypes` is not listed here — it will not be persisted. No change needed.

- [ ] **Step 5 — TypeScript check**

  ```powershell
  npx tsc --noEmit 2>&1 | Select-Object -First 20
  ```
  Expected: no output.

- [ ] **Step 6 — Commit**

  ```powershell
  git add src/stores/useQueueStore.ts
  git commit -m "feat: add jobOperationTypes map to queue store for enhance/convert dispatch"
  ```

---

## Task 5 — Add ToolModeSelect + ConvertRowButton to QueueGrid

**Files:** Modify `src/components/QueueGrid.tsx`

- [ ] **Step 1 — Add `invokeConvertFiles` and `RefreshCw` to imports**

  Find the import line (around line 5) that has `GripVertical, Play, Lock, ChevronRight, Trash2, Wand2, Download` and add `RefreshCw`:
  ```tsx
  import { GripVertical, Play, Lock, ChevronRight, Trash2, Wand2, Download, RefreshCw } from 'lucide-react';
  ```

  Find the IPC import line (around line 33) and add `invokeConvertFiles`:
  ```tsx
  import { invokeSetOutputFormat, invokeSetBitrate, invokeSetSampleRate, invokeArchiveJobs, invokeProcessQueue, invokeCancelJobs, invokeSetJobStatus, invokeCopyEnhancedFile, invokeConvertFiles } from '@/lib/ipc';
  ```

- [ ] **Step 2 — Add the `ToolModeSelect` component**

  Paste this block immediately before the `// ─── Per-row enhance button` comment:

  ```tsx
  // ─── Per-row tool mode selector ───────────────────────────────────────────────

  function ToolModeSelect({ jobId }: { jobId: string }): JSX.Element {
    const mode = useQueueStore((s) => s.jobOperationTypes[jobId] ?? 'enhance');
    const setJobOperationMode = useQueueStore((s) => s.setJobOperationMode);

    return (
      <select
        value={mode}
        onChange={(e) => {
          e.stopPropagation();
          setJobOperationMode(jobId, e.target.value as 'enhance' | 'convert');
        }}
        onClick={(e) => e.stopPropagation()}
        title="Toggle action mode for this row"
        className="bg-slate-100 dark:bg-white/[0.07] text-slate-700 dark:text-white text-[10px] rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-violet-500 border border-slate-200 dark:border-white/[0.06] cursor-pointer"
      >
        <option value="enhance" className="bg-white dark:bg-[#111827]">Enh</option>
        <option value="convert" className="bg-white dark:bg-[#111827]">Conv</option>
      </select>
    );
  }
  ```

- [ ] **Step 3 — Add the `ConvertRowButton` component**

  Paste this block immediately after the closing `}` of `EnhanceRowButton` (before the `// ─── Per-row download button` comment):

  ```tsx
  // ─── Per-row convert button ────────────────────────────────────────────────────

  function ConvertRowButton({ job }: { job: QueueJob }): JSX.Element | null {
    const filenameTemplate = useSettingsStore((s) => s.filenameTemplate);
    const { addToast } = useToastStore();
    const isProcessing = job.status === 'processing';
    const isQueued = job.status === 'queued';
    const canCancel = isProcessing || isQueued;

    if (job.status === 'done') return null;

    async function handleClick(e: React.MouseEvent): Promise<void> {
      e.stopPropagation();
      if (canCancel) {
        try {
          await invokeCancelJobs([job.id]);
          addToast(`Cancelled "${job.filename}"`, 'info');
        } catch (err) {
          console.error('Failed to cancel', err);
        }
        return;
      }
      const { jobs } = useQueueStore.getState();
      const hasActive = jobs.some((j) => j.status === 'processing');
      if (hasActive) {
        const { setStatus, setJobOperationMode } = useQueueStore.getState();
        setJobOperationMode(job.id, 'convert');
        setStatus(job.id, 'queued');
        await invokeSetJobStatus(job.id, 'queued');
        addToast(`Queued "${job.filename}" for conversion`, 'info');
      } else {
        useQueueStore.getState().setJobOperationMode(job.id, 'convert');
        await invokeConvertFiles([job.id], filenameTemplate);
      }
    }

    return (
      <button
        onClick={handleClick}
        title={canCancel ? 'Cancel' : job.status === 'error' ? 'Retry conversion' : 'Convert this file'}
        className={clsx(
          'flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150',
          canCancel
            ? 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
            : job.status === 'error'
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20',
        )}
      >
        {canCancel ? <Trash2 size={10} /> : <RefreshCw size={10} />}
        {canCancel ? 'Cancel' : job.status === 'error' ? 'Retry' : 'Convert'}
      </button>
    );
  }
  ```

- [ ] **Step 4 — Update the TOOLS `<td>` inside `SortableJobRow`**

  Find the TOOLS td (currently `className="px-3 py-2 w-28"`). Replace the entire `<td>` block:

  ```tsx
  <td className="px-3 py-2 w-40">
    <div className="flex items-center gap-1.5 flex-wrap">
      {job.status !== 'done' && job.status !== 'processing' && job.status !== 'queued' && (
        <ToolModeSelect jobId={job.id} />
      )}
      {(useQueueStore((s) => s.jobOperationTypes[job.id] ?? 'enhance') === 'enhance')
        ? <EnhanceRowButton job={job} />
        : <ConvertRowButton job={job} />}
      <DownloadJobButton job={job} />
    </div>
  </td>
  ```

  **Note:** Reading Zustand state via a hook inside JSX of a function component that is NOT itself a hook causes a React rules violation. Replace the inline `useQueueStore` call with a proper variable at the top of `SortableJobRow`. After the existing two `useState` lines at the top of `SortableJobRow`, add:

  ```tsx
  const rowToolMode = useQueueStore((s) => s.jobOperationTypes[job.id] ?? 'enhance');
  ```

  Then the TOOLS td becomes:

  ```tsx
  <td className="px-3 py-2 w-40">
    <div className="flex items-center gap-1.5 flex-wrap">
      {job.status !== 'done' && job.status !== 'processing' && job.status !== 'queued' && (
        <ToolModeSelect jobId={job.id} />
      )}
      {rowToolMode === 'enhance'
        ? <EnhanceRowButton job={job} />
        : <ConvertRowButton job={job} />}
      <DownloadJobButton job={job} />
    </div>
  </td>
  ```

- [ ] **Step 5 — Update the TOOLS `<th>` in the table header**

  Find `<th className="px-3 py-2.5 w-28">TOOLS</th>` and change `w-28` to `w-40`:

  ```tsx
  <th className="px-3 py-2.5 w-40">TOOLS</th>
  ```

- [ ] **Step 6 — TypeScript check**

  ```powershell
  npx tsc --noEmit 2>&1 | Select-Object -First 20
  ```
  Expected: no output.

- [ ] **Step 7 — Commit**

  ```powershell
  git add src/components/QueueGrid.tsx
  git commit -m "feat: add ToolModeSelect + ConvertRowButton per-row in TOOLS column"
  ```

---

## Task 6 — Fix auto-advance to dispatch correct IPC based on operation type

**Files:** Modify `src/components/QueueGrid.tsx`

- [ ] **Step 1 — Find the auto-advance block in the `queue://status-change` useEffect**

  Locate this code inside the `queue://status-change` listener callback (around line 840–850 after previous edits):

  ```typescript
  // Auto-run next queued job if active one settles
  if (status === 'done' || status === 'error' || status === 'pending') {
    setTimeout(() => {
      const { jobs } = useQueueStore.getState();
      const isAnyProcessing = jobs.some((j) => j.status === 'processing');
      if (!isAnyProcessing) {
        const nextQueuedJob = jobs.find((j) => j.status === 'queued');
        if (nextQueuedJob) {
          const { aiModel, enhancementStrength } = useSettingsStore.getState();
          invokeProcessQueue([nextQueuedJob.id], enhancementStrength, aiModel).catch((err) => {
            console.error('Failed to auto-start queued job', err);
          });
        }
      }
    }, 100);
  }
  ```

- [ ] **Step 2 — Replace that block with the operation-type–aware version**

  ```typescript
  // Auto-run next queued job if active one settles
  if (status === 'done' || status === 'error' || status === 'pending') {
    setTimeout(() => {
      const { jobs, jobOperationTypes } = useQueueStore.getState();
      const isAnyProcessing = jobs.some((j) => j.status === 'processing');
      if (!isAnyProcessing) {
        const nextQueuedJob = jobs.find((j) => j.status === 'queued');
        if (nextQueuedJob) {
          const opType = jobOperationTypes[nextQueuedJob.id] ?? 'enhance';
          const { aiModel, enhancementStrength, filenameTemplate } = useSettingsStore.getState();
          if (opType === 'enhance') {
            invokeProcessQueue([nextQueuedJob.id], enhancementStrength, aiModel).catch((err) => {
              console.error('Failed to auto-start queued enhance job', err);
            });
          } else {
            invokeConvertFiles([nextQueuedJob.id], filenameTemplate).catch((err) => {
              console.error('Failed to auto-start queued convert job', err);
            });
          }
        }
      }
    }, 100);
  }
  ```

- [ ] **Step 3 — TypeScript check**

  ```powershell
  npx tsc --noEmit 2>&1 | Select-Object -First 20
  ```
  Expected: no output.

- [ ] **Step 4 — Commit**

  ```powershell
  git add src/components/QueueGrid.tsx
  git commit -m "fix: auto-advance dispatches invokeConvertFiles for convert-typed queued jobs"
  ```

---

## Task 7 — Fix Convert All: sequential pattern + toolbar reorder + completion toast

**Files:** Modify `src/components/QueueToolbar.tsx`

- [ ] **Step 1 — Add missing imports**

  Add to the existing `@tauri-apps/plugin-dialog` import (currently not present in QueueToolbar — add it):
  ```typescript
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  ```

  Add to the IPC import line:
  ```typescript
  import {
    invokeProcessQueue,
    invokeSeparateStems,
    invokeConvertFiles,
    invokeSetOutputFormat,
    invokeArchiveJobs,
    invokeCancelJobs,
    invokeSetJobStatus,
    invokeCopyEnhancedFile,
  } from '@/lib/ipc';
  ```

  Add the `QueueJob` type import:
  ```typescript
  import type { QueueJob } from '@/types/queue';
  ```

  (The `ViewMode` import already exists; add `QueueJob` on the same line or a separate `import type`.)

- [ ] **Step 2 — Add `jobOperationTypes` selector + `isAnyConverting` derivation**

  Inside `QueueToolbar`, after the existing selectors, add:

  ```typescript
  const jobOperationTypes = useQueueStore((s) => s.jobOperationTypes);
  const isAnyConverting = jobs.some(
    (j) => (j.status === 'processing' || j.status === 'queued') && jobOperationTypes[j.id] === 'convert',
  );
  ```

- [ ] **Step 3 — Add a `prevIsAnyConvertingRef` and completion-toast useEffect**

  After the `abortProcessRef` line:
  ```typescript
  const prevIsAnyConvertingRef = useRef(false);
  ```

  After the existing `useEffect(() => { if (focusSearchTick > 0) ... })` block, add:

  ```typescript
  useEffect(() => {
    if (prevIsAnyConvertingRef.current && !isAnyConverting) {
      const { jobs: freshJobs, jobOperationTypes: freshTypes } = useQueueStore.getState();
      const convertDoneJobs = freshJobs.filter(
        (j) => j.status === 'done' && !!j.output_filepath && freshTypes[j.id] === 'convert',
      );
      if (convertDoneJobs.length > 0) {
        addToast(
          `${convertDoneJobs.length} file${convertDoneJobs.length > 1 ? 's' : ''} converted`,
          'success',
          {
            label: 'Download All',
            onClick: () => void triggerConvertDownloadAll(convertDoneJobs),
          },
          8000,
        );
      }
    }
    prevIsAnyConvertingRef.current = isAnyConverting;
  }, [isAnyConverting]);
  ```

- [ ] **Step 4 — Add the `triggerConvertDownloadAll` helper**

  Add this function inside `QueueToolbar` (before the `return` statement):

  ```typescript
  async function triggerConvertDownloadAll(doneJobs: QueueJob[]): Promise<void> {
    const folder = await openDialog({ directory: true, multiple: false, title: 'Select Download Folder' });
    if (typeof folder !== 'string' || !folder) return;
    const sep = folder.includes('\\') ? '\\' : '/';
    let count = 0;
    for (const job of doneJobs) {
      if (!job.output_filepath) continue;
      const filename = job.output_filepath.replace(/\\/g, '/').split('/').pop() ?? job.filename;
      const destPath = `${folder}${sep}${filename}`;
      const res = await invokeCopyEnhancedFile(job.id, job.output_filepath, destPath);
      if (res.success) {
        useQueueStore.getState().setDownloadPath(job.id, destPath);
        count++;
      }
    }
    addToast(`Downloaded ${count} converted file${count !== 1 ? 's' : ''} to ${folder}`, 'success');
  }
  ```

- [ ] **Step 5 — Replace `handleConvert` with the sequential pattern**

  Find and replace the entire `handleConvert` function:

  ```typescript
  async function handleConvert(): Promise<void> {
    if (!canConvert) return;
    abortProcessRef.current = false;
    const { setStatus, setJobOperationMode } = useQueueStore.getState();
    log.info(`Convert All: queuing ${pendingIds.length} job(s)`);
    for (const id of pendingIds) {
      setJobOperationMode(id, 'convert');
      setStatus(id, 'queued');
      await invokeSetJobStatus(id, 'queued');
    }
    const freshJobs = useQueueStore.getState().jobs;
    const isAnyProcessing = freshJobs.some((j) => j.status === 'processing');
    if (!isAnyProcessing) {
      const nextQueuedJob = freshJobs.find((j) => j.status === 'queued');
      if (nextQueuedJob) {
        invokeConvertFiles([nextQueuedJob.id], filenameTemplate).catch((err) => {
          console.error('Failed to auto-start convert job', err);
        });
      }
    }
  }
  ```

  Also remove the `[isSeparating, setIsSeparating]` and `[isConverting, setIsConverting]` useState hooks and the `runSequentially` function if they are no longer used. Check: `handleSeparate` still uses `runSequentially` and `isSeparating`, so keep those. Remove only `isConverting`/`setIsConverting` since `handleConvert` no longer uses them. Also remove the `canConvert` dependency on `!isConverting` — replace with:

  ```typescript
  const canConvert = pendingIds.length > 0 && !isAnyConverting && !isAnyEnhancing;
  ```

- [ ] **Step 6 — Reorder toolbar buttons**

  Find the left button group in the JSX. The current order is:
  `Enhance All → Separate → Convert All → Record`

  Reorder to:
  `Enhance All → Convert All → Separate → Record`

  Move the Convert All `<button>` JSX block to immediately after the Enhance All button and before the Separate button. The final order in JSX:

  ```tsx
  {/* Enhance All */}
  <button
    onClick={handleProcess}
    disabled={!canEnhance}
    title="Enhance speech [E]"
    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium h-[28px] shrink-0 transition-all duration-150 bg-violet-600 hover:bg-violet-500 text-white shadow-glow-violet-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
  >
    {isAnyEnhancing ? 'Enhancing…' : 'Enhance All'}
  </button>

  {/* Convert All */}
  <button
    onClick={handleConvert}
    disabled={!canConvert}
    title="Convert format [C]"
    className={`${ghostBtn} h-[28px]`}
  >
    {isAnyConverting ? 'Converting…' : 'Convert All'}
  </button>

  {/* Separate */}
  <button
    onClick={handleSeparate}
    disabled={!canSeparate}
    title="Separate stems [S]"
    className={`${ghostBtn} h-[28px]`}
  >
    {isSeparating ? 'Separating…' : 'Separate'}
  </button>

  {activeTab === 'audio' && <RecordButton />}
  ```

- [ ] **Step 7 — TypeScript check**

  ```powershell
  npx tsc --noEmit 2>&1 | Select-Object -First 20
  ```
  Expected: no output.

- [ ] **Step 8 — Commit**

  ```powershell
  git add src/components/QueueToolbar.tsx
  git commit -m "feat: sequential Convert All, reorder toolbar buttons, completion toast with Download All"
  ```

---

## Task 8 — Fix C keyboard shortcut to use sequential pattern

**Files:** Modify `src/hooks/useKeyboardShortcuts.ts`

- [ ] **Step 1 — Find and replace the `sc.convert` handler**

  Current handler (around line 137):
  ```typescript
  if (matches(e, sc.convert)) {
    const ids = q.jobs.filter((j) => j.status === 'pending').map((j) => j.id);
    if (ids.length) invokeConvertFiles(ids, s.filenameTemplate);
    return;
  }
  ```

  Replace with:
  ```typescript
  if (matches(e, sc.convert)) {
    const ids = q.jobs.filter((j) => j.status === 'pending').map((j) => j.id);
    const isAnyActive = q.jobs.some((j) => j.status === 'processing' || j.status === 'queued');
    if (!ids.length || isAnyActive) return;
    for (const id of ids) {
      q.setJobOperationMode(id, 'convert');
      q.setStatus(id, 'queued');
      await invokeSetJobStatus(id, 'queued');
    }
    const freshJobs = useQueueStore.getState().jobs;
    const nextQueued = freshJobs.find((j) => j.status === 'queued');
    if (nextQueued) {
      invokeConvertFiles([nextQueued.id], s.filenameTemplate).catch((err) => {
        console.error('Failed to auto-start convert job from shortcut', err);
      });
    }
    return;
  }
  ```

- [ ] **Step 2 — TypeScript check**

  ```powershell
  npx tsc --noEmit 2>&1 | Select-Object -First 20
  ```
  Expected: no output.

- [ ] **Step 3 — Commit**

  ```powershell
  git add src/hooks/useKeyboardShortcuts.ts
  git commit -m "fix: C shortcut dispatches sequential convert queue instead of all-at-once"
  ```

---

## Task 9 — Add asyncio lock and per-job processing heartbeat to Python convert router

**Files:** Modify `backend/routers/convert.py`

- [ ] **Step 1 — Replace the entire file**

  ```python
  import asyncio
  import os
  import pathlib
  import sqlite3
  from datetime import date
  from typing import List

  import httpx
  from fastapi import APIRouter, BackgroundTasks
  from fastapi.responses import JSONResponse
  from pydantic import BaseModel

  from processors.convert_audio import convert_file

  router = APIRouter()

  _convert_lock = asyncio.Lock()


  class ConvertRequest(BaseModel):
      job_ids: List[str]
      callback_url: str
      filename_template: str = ""


  def apply_filename_template(template: str, stem: str, fmt: str) -> str:
      """Replace {name}, {date}, {format} tokens; falls back to stem_converted."""
      if not template:
          return f"{stem}_converted"
      result = template.replace("{name}", stem)
      result = result.replace("{date}", date.today().isoformat())
      result = result.replace("{format}", fmt)
      return result or f"{stem}_converted"


  @router.post("/convert")
  async def convert_jobs(req: ConvertRequest, background_tasks: BackgroundTasks) -> JSONResponse:
      if req.job_ids:
          background_tasks.add_task(_process_jobs, req.job_ids, req.callback_url, req.filename_template)
      return JSONResponse(status_code=202, content={"detail": "Processing started."})


  async def _process_jobs(job_ids: List[str], callback_url: str, filename_template: str = "") -> None:
      async with _convert_lock:
          loop = asyncio.get_running_loop()
          db_path_env = os.environ.get("DATABASE_PATH")
          if db_path_env:
              db_path = pathlib.Path(db_path_env)
          else:
              appdata = os.environ.get("APPDATA", str(pathlib.Path.home()))
              db_path = pathlib.Path(appdata) / "enhance-audio-pro" / "app.db"

          for job_id in job_ids:
              try:
                  # Heartbeat: confirm "processing" before starting work
                  try:
                      async with httpx.AsyncClient(timeout=5) as client:
                          await client.post(
                              f"{callback_url}/callback/status",
                              json={"job_id": job_id, "status": "processing"},
                          )
                  except Exception:
                      pass

                  conn = sqlite3.connect(str(db_path))
                  row = conn.execute(
                      "SELECT filepath, destination, filename, output_format, bitrate, sample_rate FROM queue_jobs WHERE id = ?",
                      (job_id,),
                  ).fetchone()
                  conn.close()

                  if row is None:
                      continue

                  filepath, destination, filename, output_format, bitrate, sample_rate = row
                  output_format = output_format or "wav"
                  bitrate = bitrate or ""
                  sample_rate = sample_rate or ""
                  stem = pathlib.Path(filename).stem
                  out_dir = pathlib.Path(destination) if destination else pathlib.Path(filepath).parent
                  out_dir.mkdir(parents=True, exist_ok=True)
                  out_stem = apply_filename_template(filename_template, stem, output_format)
                  out_path = out_dir / f"{out_stem}.{output_format}"

                  def _sync_convert(src: str, dst: str, jid: str, br: str, sr: str) -> None:
                      def _cb(pct: int) -> None:
                          httpx.post(
                              f"{callback_url}/callback/progress",
                              json={"job_id": jid, "percent": pct},
                              timeout=5,
                          )
                      convert_file(src, dst, _cb, bitrate=br, sample_rate=sr)

                  await loop.run_in_executor(
                      None,
                      lambda fp=filepath, op=str(out_path), jid=job_id, br=bitrate, sr=sample_rate: _sync_convert(fp, op, jid, br, sr),
                  )

                  async with httpx.AsyncClient(timeout=5) as client:
                      await client.post(
                          f"{callback_url}/callback/status",
                          json={"job_id": job_id, "status": "done", "output_filepath": str(out_path)},
                      )

              except Exception as exc:
                  try:
                      async with httpx.AsyncClient(timeout=5) as client:
                          await client.post(
                              f"{callback_url}/callback/status",
                              json={"job_id": job_id, "status": "error", "error_message": str(exc)},
                          )
                  except Exception:
                      pass
  ```

- [ ] **Step 2 — Commit**

  ```powershell
  git add backend/routers/convert.py
  git commit -m "fix: add asyncio lock and processing heartbeat to Python convert router"
  ```

---

## Task 10 — Rebuild Tauri release binary

**Files:** `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe`

- [ ] **Step 1 — Final TypeScript check before build**

  ```powershell
  cd "D:\vibe coding\app enhance audio pro"; npx tsc --noEmit 2>&1 | Select-Object -First 20
  ```
  Expected: no output.

- [ ] **Step 2 — Build the release binary**

  ```powershell
  $env:CARGO_TARGET_DIR='D:\cargo_build\enhance-audio-pro'; npm run tauri build -- --no-bundle
  ```

  Expected last lines:
  ```
  Finished `release` profile [optimized] target(s) in ...
  Built application at: D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe
  ```

- [ ] **Step 3 — Verify binary timestamp**

  ```powershell
  (Get-Item "D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe").LastWriteTime
  ```
  Expected: timestamp from today.

- [ ] **Step 4 — Commit and push**

  ```powershell
  git add -A
  git commit -m "feat: task 74 — unlimited queue, sequential Convert All, per-row Enh/Conv toggle, completion toast, binary rebuild"
  git push origin master
  ```

---

## Task 11 — Remove Rust queue limit and constrain column resizing to screen boundaries ✅

**Files:** `src-tauri/src/commands/queue.rs`, `src/components/QueueGrid.tsx`

- [x] **Step 1 — Remove queue limit check in Rust `add_files` command**
  Removed the limits check and error warning in `src-tauri/src/commands/queue.rs`.

- [x] **Step 2 — Set table layout to fixed**
  Add `table-fixed` class to the main `<table>` in `src/components/QueueGrid.tsx` to prevent the columns from expanding the table width.

- [x] **Step 3 — Update `adjustWidth` function to keep table width within screen boundaries**
  Balance column resize width changes (delta) against the destination column width so that the total width stays constant.

---

## Task 12 — Narrow STATUS and TOOLS columns, disable horizontal scrolling, and adjust initial column calculation 🚀 [NEW] ✅

**Files:** `src/components/QueueGrid.tsx`

- [x] **Step 1 — Update column widths in table header (`thead`)**
  Change the column widths to tighten up column allocation:
  - `FORMAT` (output): change from `w-24` (96px) to `w-18` (72px)
  - `BITRATE`: change from `w-24` (96px) to `w-18` (72px)
  - `SAMPLE HZ`: change from `w-28` (112px) to `w-20` (80px)
  - `STATUS`: change from `w-32` (128px) to `w-20` (80px)
  - `TOOLS`: change from `w-40` (160px) to `w-32` (128px)

- [x] **Step 2 — Align cell widths in table rows (`SortableJobRow`)**
  Ensure the cells match the header column widths:
  - FormatSelect td: change from `w-24` to `w-18`
  - BitrateSelect td: change from `w-24` to `w-18`
  - SampleRateSelect td: change from `w-24` to `w-20` (also update the wrapper class to `w-20`)
  - Status td: change from `w-32` to `w-20`
  - Tools td: change from `w-40` to `w-32` and set flex container to `flex-nowrap gap-1`

- [x] **Step 3 — Update `ResizeObserver` fixed columns calculation**
  Update `FIXED_COLS` constant in the observer from `600` to `568` (sum of new fixed column widths) to avoid over-allocating initial filename/destination/size widths.

- [x] **Step 4 — Disable horizontal scrolling on table container**
  Change the table container wrapper `div` classes from `overflow-auto` to `overflow-y-auto overflow-x-hidden` so that the user never has a horizontal scrollbar.

---

## Task 13 — Dynamic scaling of flexible columns on window resize and precise column locking 🚀 [NEW]

**Files:** `src/components/QueueGrid.tsx`

- [x] **Step 1 — Keep `ResizeObserver` active to scale flexible columns dynamically**
  Update the `ResizeObserver` inside `QueueGrid.tsx` to not disconnect after the first trigger. Implement proportional scaling of `filename`, `destination`, and `size` whenever `container.clientWidth` changes.

- [x] **Step 2 — Lock column widths and cell horizontal paddings**
  Update header `thead` and cell `SortableJobRow` styles for:
  - Grip handle (`w-6` / 24px)
  - `#` index (`w-6` / 24px)
  - `FORMAT` (`w-14` / 56px, `px-1`)
  - `BITRATE` (`w-14` / 56px, `px-1`)
  - `SAMPLE HZ` (`w-18` / 72px, `px-1.5`)
  - `STATUS` (`w-18` / 72px, `px-1.5`)
  - `TOOLS` (`w-28` / 112px, `px-1.5`)
  - `Lock` column (`w-8` / 32px, `px-1`)
  - `Clear` column (`w-10` / 40px, `px-1`)

- [x] **Step 3 — Set `FIXED_COLS` to 488**
  Update the `FIXED_COLS` constant in the `ResizeObserver` to `488px` (the sum of the locked columns).

---

## Self-Review Checklist

| Requirement | Covered by |
|---|---|
| Remove 30-file (150) queue limit | Task 1 |
| Per-row dropdown Enhance↔Convert toggle | Task 5 (ToolModeSelect) |
| Convert All sequential: active=processing, others=queued | Tasks 7 + 6 (auto-advance) |
| Convert All button right of Enhance All | Task 7 Step 6 |
| C shortcut triggers sequential convert | Task 8 |
| Bottom-right completion popup with download icon | Tasks 2 + 3 + 7 |
| "Download All" identical to enhance behavior | Task 7 (triggerConvertDownloadAll) |
| Rebuild binary | Task 10 |
| No existing features broken | `invokeConvertFiles` already in IPC; toast store change is backwards-compatible; `partialize` unchanged |

**Type consistency check:**
- `ToastAction` defined in Task 2 → used in Task 3 (`toast.action`) and Task 7 (`addToast(..., action, 8000)`) ✓
- `setJobOperationMode(id, mode)` defined in Task 4 → used in Tasks 5, 7, 8 ✓
- `jobOperationTypes` field defined in Task 4 → read in Tasks 5, 6, 7 ✓
- `invokeConvertFiles([id], filenameTemplate)` signature unchanged ✓
- `QueueJob` type import added to QueueToolbar in Task 7 Step 1 ✓

