import { describe, it, expect } from 'vitest';
import { EQ_FREQUENCIES, EQ_LABELS, EQ_MIN_DB, EQ_MAX_DB, YOUTUBE_URL_REGEX, EQ_PRESETS } from '../../frontend/src/utils/constants';

describe('Constants', () => {
  it('should have 10 EQ frequencies', () => {
    expect(EQ_FREQUENCIES.length).toBe(10);
  });

  it('should have matching labels count', () => {
    expect(EQ_LABELS.length).toBe(EQ_FREQUENCIES.length);
  });

  it('should have valid dB range', () => {
    expect(EQ_MIN_DB).toBe(-12);
    expect(EQ_MAX_DB).toBe(12);
    expect(EQ_MIN_DB).toBeLessThan(EQ_MAX_DB);
  });

  it('should have presets with correct band count', () => {
    for (const [name, values] of Object.entries(EQ_PRESETS)) {
      expect(values.length).toBe(10, `Preset "${name}" has ${values.length} bands, expected 10`);
    }
  });

  it('should have preset values within dB range', () => {
    for (const [name, values] of Object.entries(EQ_PRESETS)) {
      for (const v of values) {
        expect(v).toBeGreaterThanOrEqual(EQ_MIN_DB);
        expect(v).toBeLessThanOrEqual(EQ_MAX_DB);
      }
    }
  });
});

describe('YouTube URL Regex', () => {
  it('should accept standard YouTube URLs', () => {
    expect(YOUTUBE_URL_REGEX.test('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
  });

  it('should accept short URLs', () => {
    expect(YOUTUBE_URL_REGEX.test('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
  });

  it('should reject non-YouTube URLs', () => {
    expect(YOUTUBE_URL_REGEX.test('https://vimeo.com/123')).toBe(false);
  });

  it('should reject empty strings', () => {
    expect(YOUTUBE_URL_REGEX.test('')).toBe(false);
  });
});
