import { describe, it, expect } from 'vitest';
import { validateFile, getFilename } from '../fileValidation';

describe('validateFile', () => {
  it('accepts mp3 as audio', () => {
    const result = validateFile('my-track.mp3');
    expect(result.valid).toBe(true);
    expect(result.mediaType).toBe('audio');
    expect(result.error).toBeNull();
  });

  it('accepts mp4 as video', () => {
    const result = validateFile('clip.mp4');
    expect(result.valid).toBe(true);
    expect(result.mediaType).toBe('video');
  });

  it('rejects unsupported extensions', () => {
    const result = validateFile('document.pdf');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('.pdf');
    expect(result.mediaType).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(validateFile('track.MP3').valid).toBe(true);
    expect(validateFile('clip.MOV').valid).toBe(true);
  });

  it('handles files without extension', () => {
    expect(validateFile('noextension').valid).toBe(false);
  });
});

describe('getFilename', () => {
  it('extracts filename from Windows path', () => {
    expect(getFilename('C:\\Users\\User\\Music\\track.mp3')).toBe('track.mp3');
  });

  it('extracts filename from Unix path', () => {
    expect(getFilename('/home/user/music/track.mp3')).toBe('track.mp3');
  });

  it('returns input unchanged when no separator', () => {
    expect(getFilename('track.mp3')).toBe('track.mp3');
  });
});
