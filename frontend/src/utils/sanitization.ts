import { YOUTUBE_URL_REGEX, ACCEPTED_AUDIO_TYPES, MAX_FILE_SIZE_MB } from './constants';

const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{6,}$/;
const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'];

export function sanitizeYouTubeUrl(url: string): string | null {
  const trimmed = url.trim();
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!YOUTUBE_URL_REGEX.test(normalized)) return null;
  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.includes(hostname)) return null;

    if (hostname === 'youtu.be') {
      const videoId = parsed.pathname.replace(/^\/+/, '').split('/')[0];
      return YOUTUBE_VIDEO_ID_REGEX.test(videoId) ? normalized : null;
    }

    if (parsed.pathname === '/watch') {
      const videoId = parsed.searchParams.get('v') || '';
      return YOUTUBE_VIDEO_ID_REGEX.test(videoId) ? normalized : null;
    }

    if (parsed.pathname.startsWith('/embed/') || parsed.pathname.startsWith('/shorts/') || parsed.pathname.startsWith('/live/')) {
      const videoId = parsed.pathname.split('/')[2] || '';
      return YOUTUBE_VIDEO_ID_REGEX.test(videoId) ? normalized : null;
    }

    return null;
  } catch {
    return null;
  }
}

export function validateAudioFile(file: File): { valid: boolean; error?: string } {
  if (!ACCEPTED_AUDIO_TYPES.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|flac|aac|m4a|webm|mp4|mkv|avi|mov|flv|3gp|amr)$/i)) {
    return { valid: false, error: `Invalid file type: ${file.type || 'unknown'}` };
  }
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_FILE_SIZE_MB) {
    return { valid: false, error: `File too large: ${sizeMB.toFixed(1)}MB (max ${MAX_FILE_SIZE_MB}MB)` };
  }
  return { valid: true };
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
}
