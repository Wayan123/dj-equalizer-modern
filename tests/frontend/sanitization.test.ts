import { describe, it, expect } from 'vitest';
import { sanitizeYouTubeUrl, validateAudioFile, sanitizeFilename } from '../../frontend/src/utils/sanitization';
import { MAX_FILE_SIZE_MB } from '../../frontend/src/utils/constants';

describe('sanitizeYouTubeUrl', () => {
  it('should return valid URL unchanged', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    expect(sanitizeYouTubeUrl(url)).toBe(url);
  });

  it('should return null for invalid URL', () => {
    expect(sanitizeYouTubeUrl('not a url')).toBeNull();
  });

  it('should return null for non-YouTube domain', () => {
    expect(sanitizeYouTubeUrl('https://vimeo.com/123')).toBeNull();
  });

  it('should normalize URLs without a scheme', () => {
    expect(sanitizeYouTubeUrl('youtu.be/abc123')).toBe('https://youtu.be/abc123');
  });

  it('should accept standard share parameters', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=share-token';
    expect(sanitizeYouTubeUrl(url)).toBe(url);
  });

  it('should reject YouTube lookalike domains', () => {
    expect(sanitizeYouTubeUrl('https://youtube.com.evil.test/watch?v=abc123')).toBeNull();
  });

  it('should trim whitespace', () => {
    const url = '  https://youtu.be/abc123  ';
    expect(sanitizeYouTubeUrl(url)).toBe(url.trim());
  });
});

describe('validateAudioFile', () => {
  it('should accept MP3 files', () => {
    const file = new File([''], 'test.mp3', { type: 'audio/mpeg' });
    expect(validateAudioFile(file).valid).toBe(true);
  });

  it('should reject non-audio files', () => {
    const file = new File([''], 'test.exe', { type: 'application/x-executable' });
    expect(validateAudioFile(file).valid).toBe(false);
  });

  it('should reject oversized files', () => {
    const file = new File([''], 'big.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(file, 'size', { value: (MAX_FILE_SIZE_MB + 1) * 1024 * 1024 });
    expect(validateAudioFile(file).valid).toBe(false);
  });
});

describe('sanitizeFilename', () => {
  it('should remove special characters', () => {
    expect(sanitizeFilename('test<>file.mp3')).toBe('test__file.mp3');
  });

  it('should truncate long names', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(255);
  });
});
