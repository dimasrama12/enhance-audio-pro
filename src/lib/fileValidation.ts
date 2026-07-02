import type { MediaType } from '@/types/queue';

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'aiff', 'ape',
]);

const VIDEO_EXTENSIONS = new Set([
  'mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v', 'ts', 'mts', 'm2ts',
]);

export interface ValidationResult {
  valid: boolean;
  mediaType: MediaType | null;
  error: string | null;
}

export function validateFile(filename: string): ValidationResult {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (AUDIO_EXTENSIONS.has(ext)) return { valid: true, mediaType: 'audio', error: null };
  if (VIDEO_EXTENSIONS.has(ext)) return { valid: true, mediaType: 'video', error: null };
  return { valid: false, mediaType: null, error: `Unsupported format: .${ext || '(none)'}` };
}

export function getFilename(filepath: string): string {
  return filepath.split(/[\\/]/).pop() ?? filepath;
}

export function isVideoFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return VIDEO_EXTENSIONS.has(ext);
}

/**
 * Normalize a path delivered by an OS drag-and-drop event.
 *
 * On Windows, wry (Tauri's webview) can hand back extended-length "verbatim"
 * paths prefixed with `\\?\` (or `\\?\UNC\` for shares) plus stray whitespace.
 * ffmpeg rejects the `\\?\` form with "Invalid argument", which is exactly why
 * drag-dropped videos failed to extract while the browse dialog (plain paths)
 * worked. Strip the prefix so drag-drop behaves identically to browsing.
 */
export function normalizeOsPath(p: string): string {
  let s = p.trim().replace(/^"+|"+$/g, '');
  if (s.startsWith('\\\\?\\UNC\\')) s = '\\\\' + s.slice('\\\\?\\UNC\\'.length);
  else if (s.startsWith('\\\\?\\')) s = s.slice('\\\\?\\'.length);
  return s;
}
