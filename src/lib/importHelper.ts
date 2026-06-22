import { validateFile, getFilename } from '@/lib/fileValidation';
import { invokeAddFiles, invokeSetDestination, invokeSetOutputFormat } from '@/lib/ipc';
import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';
import { prewarmAudio } from '@/lib/audioPreload';

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}

export async function handleImportFiles(paths: string[]): Promise<void> {
  const ui = useUIStore.getState();
  ui.setIsImporting(true);
  try {
    const tab = ui.audioSubTab;
    let valid = paths.filter((p) => validateFile(getFilename(p)).valid);
    if (tab === 'convert') {
      valid = valid.filter((p) => {
        const ext = getFilename(p).split('.').pop()?.toLowerCase() ?? '';
        return ext === 'mp3' || ext === 'wav';
      });
    }
    const skipped = paths.length - valid.length;

    if (valid.length === 0) {
      if (tab === 'convert') {
        ui.setImportError('Only MP3 and WAV files are supported in Convert tab.');
      } else {
        ui.setImportError('No supported audio or video files found.');
      }
      setTimeout(() => ui.setImportError(null), 3000);
      ui.setIsImporting(false);
      return;
    }

    const capped = valid;

    // Duplicate detection against the ACTIVE tab's queue only
    const existingPaths = new Set(
      useQueueStore.getState().tabQueues[tab].map((j) => normalizePath(j.filepath)),
    );
    const uniquePaths = capped.filter((p) => !existingPaths.has(normalizePath(p)));
    const duplicateNames = capped
      .filter((p) => existingPaths.has(normalizePath(p)))
      .map((p) => getFilename(p));

    if (duplicateNames.length > 0) {
      ui.setDuplicatePending({
        newPaths: capped,
        uniquePaths,
        duplicateNames,
        skippedInvalid: skipped,
      });
      ui.setIsImporting(false);
      return;
    }

    await submitAddFilesDirect(capped, skipped);
  } catch (err) {
    console.error('Import files failed:', err);
    ui.setIsImporting(false);
  }
}

export async function submitAddFilesDirect(
  paths: string[],
  skippedInvalid: number,
): Promise<void> {
  const ui = useUIStore.getState();
  ui.setIsImporting(true);
  try {
    const capped = paths;
    if (capped.length === 0) return;

    const res = await invokeAddFiles(capped);
    if (res.success && res.data) {
      // Route to the currently active sub-tab
      const tab = useUIStore.getState().audioSubTab;
      useQueueStore.getState().addJobs(res.data, tab);

      if (tab === 'convert') {
        for (const job of res.data) {
          const currentFmt = job.output_format?.toLowerCase();
          if (currentFmt !== 'wav' && currentFmt !== 'mp3') {
            useQueueStore.getState().setOutputFormat(job.id, 'wav');
            void invokeSetOutputFormat(job.id, 'wav');
          }
        }
      }

      for (const job of res.data) {
        prewarmAudio(job.filepath);
      }

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
        ui.setImportError(`${skippedInvalid} unsupported file(s) skipped.`);
        setTimeout(() => ui.setImportError(null), 3000);
      }
    } else {
      ui.setImportError(res.error ?? 'Failed to add files.');
      setTimeout(() => ui.setImportError(null), 3000);
    }
    if (res.success && res.error) {
      ui.setImportLimitWarning(res.error);
      setTimeout(() => ui.setImportLimitWarning(null), 5000);
    }
  } catch (err) {
    console.error('submitAddFilesDirect failed:', err);
  } finally {
    ui.setIsImporting(false);
  }
}
