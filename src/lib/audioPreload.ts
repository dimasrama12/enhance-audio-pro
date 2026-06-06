import { invoke } from '@tauri-apps/api/core';

function getMimeType(filepath: string): string {
  const ext = filepath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac',
    aac: 'audio/aac', ogg: 'audio/ogg', opus: 'audio/opus',
    m4a: 'audio/mp4', wma: 'audio/x-ms-wma', aiff: 'audio/aiff',
  };
  return map[ext] ?? 'audio/mpeg';
}

// Blob URLs created during preload, keyed by original filepath
const prewarmCache = new Map<string, string>();
const inFlight = new Set<string>();

/**
 * Kick off a background read of the audio file so the Blob URL is ready
 * when WaveformPlayer opens. Also gives the Python sidecar extra startup
 * time after a cold launch.
 */
export function prewarmAudio(filepath: string): void {
  if (prewarmCache.has(filepath) || inFlight.has(filepath)) return;
  inFlight.add(filepath);

  void (async () => {
    try {
      const rawData = await invoke<unknown>('read_audio_file', { path: filepath });
      let bufferSource: unknown = rawData;
      if (rawData && typeof rawData === 'object' && 'body' in rawData) {
        bufferSource = (rawData as Record<string, unknown>).body;
      }
      if (!(bufferSource instanceof ArrayBuffer) && !ArrayBuffer.isView(bufferSource)) return;
      const blob = new Blob([bufferSource as BlobPart], { type: getMimeType(filepath) });
      prewarmCache.set(filepath, URL.createObjectURL(blob));
    } catch {
      // Silently ignore — preload failure must not block anything
    } finally {
      inFlight.delete(filepath);
    }
  })();
}

/** Return the prewarmed Blob URL for a filepath if it is ready, or null. */
export function getPrewarmedBlobUrl(filepath: string): string | null {
  return prewarmCache.get(filepath) ?? null;
}

/** Remove a cached entry and revoke its Blob URL. */
export function evictPrewarm(filepath: string): void {
  const url = prewarmCache.get(filepath);
  if (url) {
    URL.revokeObjectURL(url);
    prewarmCache.delete(filepath);
  }
}
