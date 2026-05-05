/**
 * Platform Abstraction Layer
 * Detects runtime (web vs Tauri) and routes API calls accordingly.
 * Web → fetch to FastAPI backend
 * Tauri → invoke() to Rust commands
 */

import { checkWebUpdate, installWebUpdate } from './webUpdate';

// --- Type definitions shared by both platforms ---

export interface YouTubeExtractResult {
  audio_url: string;
  title: string;
}

export interface YouTubeSearchResult {
  id: string;
  title: string;
  url: string;
  duration: number | null;
  channel: string;
}

export interface PlaylistEntry {
  id: number;
  video_id: string;
  title: string;
  url: string;
  cdn_url: string;
  channel: string;
  duration: number;
  created_at: string;
}

export interface UpdateProgress {
  downloaded: number;
  total: number | null;
  percent: number | null;
  message: string;
}

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  version?: string;
  date?: string;
  body?: string;
  runtime: 'web' | 'tauri';
  channel: 'web-pwa' | 'internal-local';
  message: string;
}

// --- Platform detection ---

let _isTauri: boolean | null = null;

export function isTauri(): boolean {
  if (_isTauri !== null) return _isTauri;
  _isTauri = !!(window as any).__TAURI__;
  return _isTauri;
}

// --- Lazy Tauri invoke import ---

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

// --- Platform API ---

export const platform = {
  getRuntimeVersion: async (): Promise<string> => {
    if (isTauri()) {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        return await getVersion();
      } catch (err) {
        console.warn('Unable to read Tauri app version:', err);
      }
    }
    return __APP_VERSION__;
  },

  checkForUpdate: async (): Promise<UpdateInfo> => {
    const currentVersion = await platform.getRuntimeVersion();

    if (isTauri()) {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (!update) {
        return {
          available: false,
          currentVersion,
          runtime: 'tauri',
          channel: 'internal-local',
          message: 'UP TO DATE',
        };
      }

      return {
        available: true,
        currentVersion,
        version: update.version,
        date: update.date,
        body: update.body,
        runtime: 'tauri',
        channel: 'internal-local',
        message: 'UPDATE READY',
      };
    }

    const webUpdate = await checkWebUpdate();
    return {
      available: webUpdate.available,
      currentVersion,
      runtime: 'web',
      channel: 'web-pwa',
      message: webUpdate.available ? 'UPDATE READY' : webUpdate.message,
    };
  },

  installUpdate: async (onProgress?: (progress: UpdateProgress) => void): Promise<void> => {
    if (isTauri()) {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (!update) throw new Error('No update is available.');

      let downloaded = 0;
      let total: number | null = null;

      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? null;
          downloaded = 0;
          onProgress?.({ downloaded, total, percent: null, message: 'DOWNLOADING' });
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          const percent = total ? Math.min(100, (downloaded / total) * 100) : null;
          onProgress?.({ downloaded, total, percent, message: 'DOWNLOADING' });
        } else if (event.event === 'Finished') {
          onProgress?.({ downloaded, total, percent: 100, message: 'INSTALLING' });
        }
      });

      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
      return;
    }

    await installWebUpdate();
  },

  // YouTube
  youtubeExtract: async (url: string): Promise<YouTubeExtractResult> => {
    if (isTauri()) {
      return invoke<YouTubeExtractResult>('youtube_extract', { url });
    }
    const resp = await fetch('/api/youtube/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!resp.ok) throw new Error(`Extract failed: ${resp.statusText}`);
    return resp.json();
  },

  youtubeSearch: async (query: string, maxResults = 8): Promise<YouTubeSearchResult[]> => {
    if (isTauri()) {
      const result = await invoke<YouTubeSearchResult[]>('youtube_search', { query, maxResults });
      return result;
    }
    const resp = await fetch('/api/youtube/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, max_results: maxResults }),
    });
    if (!resp.ok) throw new Error(`Search failed: ${resp.statusText}`);
    const data = await resp.json();
    return data.results || [];
  },

  /**
   * Download audio and return a playable URL.
   * Web: returns proxy URL that streams through backend
   * Tauri: downloads to temp file via Rust, returns asset:// protocol URL
   */
  getStreamUrl: async (audioUrl: string): Promise<string> => {
    if (isTauri()) {
      // Download audio to temp file via Rust, get local path
      const localPath = await invoke<string>('download_audio', { url: audioUrl });
      // Convert to asset protocol URL that WebView can load
      const { convertFileSrc } = await import('@tauri-apps/api/core');
      return convertFileSrc(localPath);
    }
    return `/api/youtube/stream?url=${encodeURIComponent(audioUrl)}`;
  },

  // Playlist
  playlistList: async (): Promise<PlaylistEntry[]> => {
    if (isTauri()) {
      return invoke<PlaylistEntry[]>('playlist_list');
    }
    const resp = await fetch('/api/playlist/list');
    if (!resp.ok) throw new Error(`List failed: ${resp.statusText}`);
    const data = await resp.json();
    return data.entries || [];
  },

  playlistAdd: async (entry: {
    video_id: string;
    title: string;
    url: string;
    cdn_url?: string;
    channel?: string;
    duration?: number;
  }): Promise<PlaylistEntry> => {
    if (isTauri()) {
      return invoke<PlaylistEntry>('playlist_add', { entry });
    }
    const resp = await fetch('/api/playlist/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!resp.ok) throw new Error(`Add failed: ${resp.statusText}`);
    const data = await resp.json();
    return data.entry;
  },

  playlistDelete: async (videoId: string): Promise<void> => {
    if (isTauri()) {
      await invoke('playlist_delete', { videoId });
      return;
    }
    const resp = await fetch(`/api/playlist/delete/${videoId}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error(`Delete failed: ${resp.statusText}`);
  },

  playlistClear: async (): Promise<number> => {
    if (isTauri()) {
      return invoke<number>('playlist_clear');
    }
    const resp = await fetch('/api/playlist/clear', { method: 'DELETE' });
    if (!resp.ok) throw new Error(`Clear failed: ${resp.statusText}`);
    const data = await resp.json();
    return data.cleared || 0;
  },

  playlistUpdateCdn: async (videoId: string, cdnUrl: string): Promise<void> => {
    if (isTauri()) {
      await invoke('playlist_update_cdn', { videoId, cdnUrl });
      return;
    }
    const resp = await fetch(`/api/playlist/cdn/${videoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cdn_url: cdnUrl }),
    });
    if (!resp.ok) throw new Error(`CDN update failed: ${resp.statusText}`);
  },

  // Presets (localStorage for web, file-based for Tauri)
  presetSave: async (name: string, data: unknown): Promise<void> => {
    if (isTauri()) {
      await invoke('preset_save', { name, data: JSON.stringify(data) });
      return;
    }
    const saved = JSON.parse(localStorage.getItem('dj-eq-presets') || '{}');
    saved[name] = data;
    localStorage.setItem('dj-eq-presets', JSON.stringify(saved));
  },

  presetLoadAll: async (): Promise<Record<string, unknown>> => {
    if (isTauri()) {
      return invoke<Record<string, unknown>>('preset_load_all');
    }
    return JSON.parse(localStorage.getItem('dj-eq-presets') || '{}');
  },

  presetDelete: async (name: string): Promise<void> => {
    if (isTauri()) {
      await invoke('preset_delete', { name });
      return;
    }
    const saved = JSON.parse(localStorage.getItem('dj-eq-presets') || '{}');
    delete saved[name];
    localStorage.setItem('dj-eq-presets', JSON.stringify(saved));
  },
};
