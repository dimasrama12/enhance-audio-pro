import { validateFile, getFilename, isVideoFile } from '@/lib/fileValidation';
import {
  invokeAddFiles,
  invokeSetDestination,
  invokeSetOutputFormat,
  invokeExtractVideoAudio,
} from '@/lib/ipc';
import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore, type ImportItem, type AudioSubTab } from '@/stores/useUIStore';
import { useToastStore } from '@/stores/useToastStore';
import { prewarmAudio } from '@/lib/audioPreload';
import { triggerEnhanceAll } from '@/lib/queueActions';
import type { QueueJob } from '@/types/queue';

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}

function toast(message: string, type: 'success' | 'error' | 'info'): void {
  useToastStore.getState().addToast(message, type);
}

// Build a dimmed placeholder row shown immediately while the real audio is
// extracted / verified in the background. The temp id is swapped for the real
// backend job once ready (see resolvePlaceholder). media_type is always 'audio'
// — even for videos, the eventual job is the extracted audio track, and the
// Audio media tab only shows audio rows.
function makePlaceholder(path: string): QueueJob {
  const now = new Date().toISOString();
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id: `placeholder-${rnd}`,
    filename: getFilename(path),
    filepath: path,
    destination: '',
    size_bytes: 0,
    media_type: 'audio',
    status: 'pending',
    progress: 0,
    error_message: null,
    output_format: 'wav',
    bitrate: '',
    output_filepath: null,
    sample_rate: '',
    created_at: now,
    updated_at: now,
    download_path: null,
  };
}

/**
 * Import a single dropped item in the background:
 *   video → extract audio (ffmpeg) → add to DB
 *   audio → add to DB
 * The placeholder row is swapped for the real job on success, or removed (with
 * a toast) on failure. Runs independently per item so each row illuminates the
 * moment its own work finishes.
 */
async function processImportItem(
  item: ImportItem,
  placeholder: QueueJob,
  tab: AudioSubTab,
  outputFolder: string | null,
): Promise<void> {
  const store = useQueueStore.getState();
  try {
    let audioPath = item.path;
    let sourceVideo: string | undefined;

    if (item.isVideo) {
      // Pass the placeholder id so the backend streams extraction progress back
      // as `queue://progress` events that light up this exact row.
      const res = await invokeExtractVideoAudio(item.path, 'mp3', placeholder.id);
      if (!res.success || !res.data) {
        store.removePlaceholder(placeholder.id, tab);
        toast(res.error ?? `Failed to extract audio from "${getFilename(item.path)}".`, 'error');
        return;
      }
      audioPath = res.data.audio_path;
      sourceVideo = item.path;
    }

    const addRes = await invokeAddFiles([audioPath]);
    if (!addRes.success || !addRes.data || addRes.data.length === 0) {
      store.removePlaceholder(placeholder.id, tab);
      toast(addRes.error ?? `Failed to add "${getFilename(item.path)}".`, 'error');
      return;
    }

    const dbJob = addRes.data[0];
    const realJob: QueueJob = sourceVideo ? { ...dbJob, source_video_path: sourceVideo } : dbJob;
    store.resolvePlaceholder(placeholder.id, realJob, tab);

    prewarmAudio(realJob.filepath);

    // Convert tab: pre-select the opposite of the input format (mp3 ⇄ wav).
    if (tab === 'convert') {
      const inputExt = realJob.filename.split('.').pop()?.toLowerCase();
      const targetFmt = inputExt === 'mp3' ? 'wav' : 'mp3';
      store.setOutputFormat(realJob.id, targetFmt);
      void invokeSetOutputFormat(realJob.id, targetFmt);
    }

    // Default destination so the Python side always has a real output folder.
    if (outputFolder && !realJob.destination) {
      store.setDestination(realJob.id, outputFolder);
      void invokeSetDestination(realJob.id, outputFolder);
    }

    if (tab === 'enhance' && useSettingsStore.getState().autoEnhanceOnDrop) {
      await triggerEnhanceAll();
    }
  } catch (err) {
    console.error('Background import failed:', item.path, err);
    store.removePlaceholder(placeholder.id, tab);
    toast(`Failed to import "${getFilename(item.path)}".`, 'error');
  }
}

/**
 * Kick off a non-blocking import: drop placeholder rows in immediately, then
 * process each item in the background. No blocking overlay — the queue fills up
 * instantly with dimmed rows that illuminate one-by-one as work completes.
 */
export function startBackgroundImport(
  items: ImportItem[],
  skippedInvalid: number,
  tab: AudioSubTab,
): void {
  if (items.length === 0) {
    if (skippedInvalid > 0) {
      toast(`${skippedInvalid} unsupported file(s) skipped.`, 'info');
    }
    return;
  }

  const outputFolder = useSettingsStore.getState().outputFolder ?? null;

  const placeholders = items.map((item) => ({
    item,
    ph: makePlaceholder(item.path),
  }));

  useQueueStore.getState().addPlaceholders(
    placeholders.map((p) => p.ph),
    tab,
  );

  if (skippedInvalid > 0) {
    toast(`${skippedInvalid} unsupported file(s) skipped.`, 'info');
  }

  for (const { item, ph } of placeholders) {
    void processImportItem(item, ph, tab, outputFolder);
  }
}

export async function handleImportFiles(paths: string[]): Promise<void> {
  const ui = useUIStore.getState();
  const tab = ui.audioSubTab;

  const valid = paths.filter((p) => validateFile(getFilename(p)).valid);
  const skipped = paths.length - valid.length;

  // Build import items. Videos are always allowed (they become mp3); Convert-tab
  // audio inputs stay restricted to mp3/wav.
  let items: ImportItem[] = valid.map((p) => ({ path: p, isVideo: isVideoFile(getFilename(p)) }));
  if (tab === 'convert') {
    items = items.filter((it) => {
      if (it.isVideo) return true;
      const ext = getFilename(it.path).split('.').pop()?.toLowerCase() ?? '';
      return ext === 'mp3' || ext === 'wav';
    });
  }

  if (items.length === 0) {
    // Nothing importable — either genuinely unsupported files, or valid audio
    // that the Convert tab rejects (only mp3/wav/video allowed there).
    if (skipped > 0 || valid.length > 0) {
      toast(
        tab === 'convert'
          ? 'Only MP3, WAV, or video files are supported in the Convert tab.'
          : 'No supported audio or video files found.',
        'info',
      );
    }
    return;
  }

  // Duplicate detection against the ACTIVE tab's queue. Audio matches by source
  // filepath; video matches by the recorded source_video_path so re-dropping an
  // already-extracted video surfaces the duplicate modal instead of a red error.
  const tabJobs = useQueueStore.getState().tabQueues[tab];
  const existingAudio = new Set(tabJobs.map((j) => normalizePath(j.filepath)));
  const existingVideo = new Set(
    tabJobs
      .map((j) => j.source_video_path)
      .filter((p): p is string => !!p)
      .map(normalizePath),
  );
  const isDuplicate = (it: ImportItem): boolean =>
    it.isVideo
      ? existingVideo.has(normalizePath(it.path))
      : existingAudio.has(normalizePath(it.path));

  const duplicateItems = items.filter(isDuplicate);
  const uniqueItems = items.filter((it) => !isDuplicate(it));

  if (duplicateItems.length > 0) {
    ui.setDuplicatePending({
      allItems: items,
      uniqueItems,
      duplicateNames: duplicateItems.map((it) => getFilename(it.path)),
      skippedInvalid: skipped,
    });
    return;
  }

  startBackgroundImport(items, skipped, tab);
}
