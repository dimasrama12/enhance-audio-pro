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
