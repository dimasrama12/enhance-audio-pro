import { validateFile, getFilename } from '@/lib/fileValidation';
import { invokeAddFiles, invokeSetDestination } from '@/lib/ipc';
import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';

export const MAX_QUEUE_JOBS = 150;

// Normalization function to handle Windows case-insensitivity and backslash differences
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}

export async function handleImportFiles(paths: string[]): Promise<void> {
  const valid = paths.filter((p) => validateFile(getFilename(p)).valid);
  const skipped = paths.length - valid.length;

  if (valid.length === 0) {
    useUIStore.getState().setImportError('No supported audio or video files found.');
    setTimeout(() => useUIStore.getState().setImportError(null), 3000);
    return;
  }

  // Enforce queue capacity limit
  const currentCount = useQueueStore.getState().jobs.length;
  const remaining = MAX_QUEUE_JOBS - currentCount;

  if (remaining <= 0) {
    useUIStore.getState().setImportLimitWarning(`Queue is full (${MAX_QUEUE_JOBS} files max). Remove items to add more.`);
    setTimeout(() => useUIStore.getState().setImportLimitWarning(null), 5000);
    return;
  }

  const capped = remaining < valid.length ? valid.slice(0, remaining) : valid;
  const trimmedByLimit = valid.length - capped.length;

  if (trimmedByLimit > 0) {
    useUIStore.getState().setImportLimitWarning(
      `Queue limit reached: only ${capped.length} of ${valid.length} files added (max ${MAX_QUEUE_JOBS}).`
    );
    setTimeout(() => useUIStore.getState().setImportLimitWarning(null), 5000);
  }

  // Duplicate detection: compare against current queue by normalized filepath
  const existingPaths = new Set(useQueueStore.getState().jobs.map((j) => normalizePath(j.filepath)));
  const uniquePaths = capped.filter((p) => !existingPaths.has(normalizePath(p)));
  const duplicateNames = capped.filter((p) => existingPaths.has(normalizePath(p))).map((p) => getFilename(p));

  if (duplicateNames.length > 0) {
    useUIStore.getState().setDuplicatePending({
      newPaths: capped,
      uniquePaths,
      duplicateNames,
      skippedInvalid: skipped,
    });
    return;
  }

  await submitAddFilesDirect(capped, skipped);
}

export async function submitAddFilesDirect(
  paths: string[],
  skippedInvalid: number
): Promise<void> {
  // Re-check capacity (state may change between drop and duplicate dialog confirmation)
  const currentCount = useQueueStore.getState().jobs.length;
  const remaining = MAX_QUEUE_JOBS - currentCount;
  const capped = remaining < paths.length ? paths.slice(0, remaining) : paths;
  const trimmedByLimit = paths.length - capped.length;

  if (trimmedByLimit > 0) {
    useUIStore.getState().setImportLimitWarning(
      `Queue limit reached: only ${capped.length} of ${paths.length} files added (max ${MAX_QUEUE_JOBS}).`
    );
    setTimeout(() => useUIStore.getState().setImportLimitWarning(null), 5000);
  }

  if (capped.length === 0) return;

  const res = await invokeAddFiles(capped);
  if (res.success && res.data) {
    useQueueStore.getState().addJobs(res.data);
    // Auto-apply settings default output folder to new jobs that have no destination
    const outputFolder = useSettingsStore.getState().outputFolder;
    if (outputFolder) {
      const emptyDestIds = res.data.filter((j) => !j.destination).map((j) => j.id);
      if (emptyDestIds.length > 0) {
        useQueueStore.getState().setDestinationBatch(emptyDestIds, outputFolder);
        for (const id of emptyDestIds) {
          void invokeSetDestination(id, outputFolder);
        }
      }
    }
    if (skippedInvalid > 0) {
      useUIStore.getState().setImportError(`${skippedInvalid} unsupported file(s) skipped.`);
      setTimeout(() => useUIStore.getState().setImportError(null), 3000);
    }
  } else {
    useUIStore.getState().setImportError(res.error ?? 'Failed to add files.');
    setTimeout(() => useUIStore.getState().setImportError(null), 3000);
  }
  if (res.success && res.error) {
    useUIStore.getState().setImportLimitWarning(res.error);
    setTimeout(() => useUIStore.getState().setImportLimitWarning(null), 5000);
  }
}
