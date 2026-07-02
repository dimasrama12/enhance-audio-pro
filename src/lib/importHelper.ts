import { validateFile, getFilename, isVideoFile } from '@/lib/fileValidation';
import {
  invokeAddFiles,
  invokeSetDestination,
  invokeSetOutputFormat,
  invokeExtractVideoAudio,
} from '@/lib/ipc';
import { useQueueStore } from '@/stores/useQueueStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';
import { prewarmAudio } from '@/lib/audioPreload';

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}

/**
 * Extract audio from each dropped video (background demux → default .mp3) and
 * return the resulting audio paths plus a map of extracted-audio → source-video.
 * Video drops bypass all size/duration limits. Failures (e.g. no audio stream)
 * are counted and reported by the caller.
 */
async function extractVideosToAudio(
  videoPaths: string[],
): Promise<{ audioPaths: string[]; sourceVideoMap: Record<string, string>; failures: number }> {
  const audioPaths: string[] = [];
  const sourceVideoMap: Record<string, string> = {};
  let failures = 0;

  for (const vp of videoPaths) {
    try {
      const res = await invokeExtractVideoAudio(vp, 'mp3');
      if (res.success && res.data) {
        audioPaths.push(res.data.audio_path);
        sourceVideoMap[normalizePath(res.data.audio_path)] = vp;
      } else {
        failures += 1;
      }
    } catch (err) {
      console.error('Video audio extraction failed:', vp, err);
      failures += 1;
    }
  }

  return { audioPaths, sourceVideoMap, failures };
}

export async function handleImportFiles(paths: string[]): Promise<void> {
  const ui = useUIStore.getState();
  ui.setIsImporting(true);
  try {
    const tab = ui.audioSubTab;
    const valid = paths.filter((p) => validateFile(getFilename(p)).valid);

    // Partition by media kind. Videos flow through the extraction pipeline on
    // BOTH tabs; direct audio inputs follow the existing path.
    let videoPaths = valid.filter((p) => isVideoFile(getFilename(p)));
    let audioPaths = valid.filter((p) => !isVideoFile(getFilename(p)));

    // Convert-tab audio inputs stay restricted to mp3/wav; video is always OK
    // (it becomes mp3 after extraction).
    if (tab === 'convert') {
      audioPaths = audioPaths.filter((p) => {
        const ext = getFilename(p).split('.').pop()?.toLowerCase() ?? '';
        return ext === 'mp3' || ext === 'wav';
      });
    }

    // Skip videos already extracted into the active tab (dedupe by source video)
    const existingVideoSources = new Set(
      useQueueStore
        .getState()
        .tabQueues[tab].map((j) => j.source_video_path)
        .filter((p): p is string => !!p)
        .map((p) => normalizePath(p)),
    );
    videoPaths = videoPaths.filter((p) => !existingVideoSources.has(normalizePath(p)));

    const skipped = paths.length - valid.length;

    // Run extraction for videos (may take a while for large files — the
    // importing overlay stays up throughout).
    let sourceVideoMap: Record<string, string> = {};
    let extractedAudioPaths: string[] = [];
    if (videoPaths.length > 0) {
      const result = await extractVideosToAudio(videoPaths);
      extractedAudioPaths = result.audioPaths;
      sourceVideoMap = result.sourceVideoMap;
      if (result.failures > 0) {
        ui.setImportError(
          `${result.failures} video file(s) had no audio track or failed to extract.`,
        );
        setTimeout(() => ui.setImportError(null), 3000);
      }
    }

    const allAudioPaths = [...audioPaths, ...extractedAudioPaths];

    if (allAudioPaths.length === 0) {
      // Only show the generic "unsupported" message when nothing (including
      // failed extractions) produced anything importable.
      if (extractedAudioPaths.length === 0 && videoPaths.length === 0) {
        if (tab === 'convert') {
          ui.setImportError('Only MP3, WAV, or video files are supported in the Convert tab.');
        } else {
          ui.setImportError('No supported audio or video files found.');
        }
        setTimeout(() => ui.setImportError(null), 3000);
      }
      ui.setIsImporting(false);
      return;
    }

    // Duplicate detection against the ACTIVE tab's queue only
    const existingPaths = new Set(
      useQueueStore.getState().tabQueues[tab].map((j) => normalizePath(j.filepath)),
    );
    const uniquePaths = allAudioPaths.filter((p) => !existingPaths.has(normalizePath(p)));
    const duplicateNames = allAudioPaths
      .filter((p) => existingPaths.has(normalizePath(p)))
      .map((p) => getFilename(p));

    if (duplicateNames.length > 0) {
      ui.setDuplicatePending({
        newPaths: allAudioPaths,
        uniquePaths,
        duplicateNames,
        skippedInvalid: skipped,
        sourceVideoMap,
      });
      ui.setIsImporting(false);
      return;
    }

    await submitAddFilesDirect(allAudioPaths, skipped, sourceVideoMap);
  } catch (err) {
    console.error('Import files failed:', err);
    ui.setIsImporting(false);
  }
}

export async function submitAddFilesDirect(
  paths: string[],
  skippedInvalid: number,
  sourceVideoMap: Record<string, string> = {},
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
      // Tag jobs that came from a video extraction with their source video path.
      const jobs = res.data.map((job) => {
        const src = sourceVideoMap[normalizePath(job.filepath)];
        return src ? { ...job, source_video_path: src } : job;
      });
      useQueueStore.getState().addJobs(jobs, tab);

      if (tab === 'convert') {
        for (const job of res.data) {
          const inputExt = job.filename.split('.').pop()?.toLowerCase();
          const targetFmt = inputExt === 'mp3' ? 'wav' : 'mp3';
          useQueueStore.getState().setOutputFormat(job.id, targetFmt);
          void invokeSetOutputFormat(job.id, targetFmt);
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
