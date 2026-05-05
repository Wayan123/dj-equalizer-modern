import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAudioStore, QueueItem } from '../../store/audioStore';
import { audioEngine } from '../../audio/AudioEngine';
import { validateAudioFile, sanitizeYouTubeUrl, sanitizeFilename } from '../../utils/sanitization';
import { platform } from '../../platform/platform';

// --- DB Playlist entry (from backend) ---
interface DbPlaylistEntry {
  id: number;
  video_id: string;
  title: string;
  url: string;
  cdn_url: string;
  channel: string;
  duration: number;
  created_at: string;
}

// --- Search result ---
interface SearchResult { title: string; url: string; duration: number | null; channel: string; id: string; }

const SEARCH_HISTORY_KEY = 'modern-audio-enhancer:youtube-search-history';
const URL_HISTORY_KEY = 'modern-audio-enhancer:youtube-url-history';
const MAX_HISTORY_ITEMS = 12;
const VISIBLE_HISTORY_ITEMS = 6;

const readHistory = (key: string): string[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
};

const writeHistory = (key: string, items: string[]) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
  } catch {
    // History is a convenience feature; ignore storage quota/private-mode failures.
  }
};

const pushHistoryItem = (items: string[], value: string) => {
  const cleanValue = value.trim();
  if (!cleanValue) return items;

  const normalized = cleanValue.toLowerCase();
  return [
    cleanValue,
    ...items.filter((item) => item.trim().toLowerCase() !== normalized),
  ].slice(0, MAX_HISTORY_ITEMS);
};

const getHistoryMatches = (items: string[], value: string) => {
  const query = value.trim().toLowerCase();
  const matches = query
    ? items.filter((item) => item.toLowerCase().includes(query))
    : items;

  return matches.slice(0, VISIBLE_HISTORY_ITEMS);
};

interface HistoryDropdownProps {
  items: string[];
  accent: 'cyan' | 'magenta';
  emptyLabel: string;
  onPick: (value: string) => void;
  onClear: () => void;
}

const HistoryDropdown: React.FC<HistoryDropdownProps> = ({ items, accent, emptyLabel, onPick, onClear }) => {
  if (items.length === 0) return null;

  const tone =
    accent === 'cyan'
      ? {
          border: 'border-neon-cyan/30',
          label: 'text-neon-cyan',
          icon: 'text-neon-cyan/70',
          hover: 'hover:border-neon-cyan/40 hover:bg-neon-cyan/10',
        }
      : {
          border: 'border-neon-magenta/30',
          label: 'text-neon-magenta',
          icon: 'text-neon-magenta/70',
          hover: 'hover:border-neon-magenta/40 hover:bg-neon-magenta/10',
        };

  return (
    <div
      className={`absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded border ${tone.border} bg-dark-800/95 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur`}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between border-b border-dark-500/40 px-2 py-1">
        <span className={`text-[7px] font-mono font-bold uppercase tracking-wider ${tone.label}`}>RECENT</span>
        <button
          className="text-[7px] font-mono text-gray-600 transition-colors hover:text-red-400"
          onMouseDown={(e) => {
            e.preventDefault();
            onClear();
          }}
        >
          CLEAR
        </button>
      </div>
      <div className="max-h-32 overflow-y-auto custom-scrollbar p-1">
        {items.length === 0 ? (
          <span className="block px-1.5 py-1 text-[8px] font-mono text-gray-600">{emptyLabel}</span>
        ) : (
          items.map((item) => (
            <button
              key={item}
              className={`flex w-full items-center gap-1.5 rounded border border-transparent px-1.5 py-1 text-left transition-colors ${tone.hover}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(item);
              }}
              title={item}
            >
              <span className={`shrink-0 text-[8px] font-mono ${tone.icon}`}>↺</span>
              <span className="min-w-0 flex-1 truncate text-[8px] font-mono text-gray-300">{item}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export const InputZone: React.FC = () => {
  const [ytUrl, setYtUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { setTrackInfo, setPlaying, setVideoId, currentVideoId, localVideoUrl, setLocalVideoUrl, setQueue, setQueueIndex, isPlaying } = useAudioStore();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [urlHistory, setUrlHistory] = useState<string[]>(() => readHistory(URL_HISTORY_KEY));
  const [searchHistory, setSearchHistory] = useState<string[]>(() => readHistory(SEARCH_HISTORY_KEY));
  const [showUrlHistory, setShowUrlHistory] = useState(false);
  const [showQueryHistory, setShowQueryHistory] = useState(false);

  // Playlist state (loaded from DB)
  const [playlist, setPlaylist] = useState<DbPlaylistEntry[]>([]);
  const [showPlaylist, setShowPlaylist] = useState(false);

  const urlHistoryMatches = getHistoryMatches(urlHistory, ytUrl);
  const searchHistoryMatches = getHistoryMatches(searchHistory, searchQuery);

  const rememberUrl = useCallback((value: string) => {
    setUrlHistory((items) => {
      const next = pushHistoryItem(items, value);
      writeHistory(URL_HISTORY_KEY, next);
      return next;
    });
  }, []);

  const rememberSearch = useCallback((value: string) => {
    setSearchHistory((items) => {
      const next = pushHistoryItem(items, value);
      writeHistory(SEARCH_HISTORY_KEY, next);
      return next;
    });
  }, []);

  const clearUrlHistory = useCallback(() => {
    setUrlHistory([]);
    writeHistory(URL_HISTORY_KEY, []);
    setShowUrlHistory(false);
  }, []);

  const clearSearchHistory = useCallback(() => {
    setSearchHistory([]);
    writeHistory(SEARCH_HISTORY_KEY, []);
    setShowQueryHistory(false);
  }, []);

  // Load playlist from backend DB on mount
  const loadPlaylistFromDB = useCallback(async () => {
    try {
      const entries = await platform.playlistList();
      setPlaylist(entries);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadPlaylistFromDB(); }, [loadPlaylistFromDB]);

  // Sync local video preview with audio playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !localVideoUrl) return;
    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying, localVideoUrl]);

  // Extract YouTube Video ID from URL
  const getYoutubeId = (url: string) => {
    const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]+)/);
    return match ? match[1] : null;
  };

  const loadAudioFile = useCallback(
    async (file: File) => {
      setError('');
      setVideoId(null);
      const validation = validateAudioFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        return;
      }

      const name = sanitizeFilename(file.name);
      try {
        setTrackInfo(name, 'loading');
        const url = URL.createObjectURL(file);
        await audioEngine.loadAudio(url);
        setTrackInfo(name, 'playing', audioEngine.audio?.duration);
        setPlaying(true);
        await audioEngine.play();

        // Show video preview for local video files
        const isVideo = file.type.startsWith('video/');
        if (isVideo) {
          setLocalVideoUrl(url);
        } else {
          setLocalVideoUrl(null);
        }
      } catch (err) {
        setError(`Failed to load: ${err}`);
        setTrackInfo('', 'error');
      }
    },
    [setTrackInfo, setPlaying, setVideoId, setLocalVideoUrl],
  );

  // Play a YouTube track by URL, optionally using cached CDN URL
  const playYouTubeByInfo = useCallback(
    async (youtubeUrl: string, title: string, cdnUrl?: string) => {
      setLoading(true);
      setTrackInfo(title || 'YouTube...', 'loading');
      setError('');
      setLocalVideoUrl(null);

      const videoId = getYoutubeId(youtubeUrl);
      setVideoId(videoId);

      try {
        let audioUrl = cdnUrl;

        // If no cached CDN URL, extract fresh
        if (!audioUrl) {
          const extractResult = await platform.youtubeExtract(youtubeUrl);
          audioUrl = extractResult.audio_url;
          title = extractResult.title || title;
        }

        // Get playable stream URL (proxy for web, asset:// for Tauri)
        const streamUrl = await platform.getStreamUrl(audioUrl!);
        await audioEngine.loadAudio(streamUrl);
        setTrackInfo(title, 'playing', audioEngine.audio?.duration);
        setPlaying(true);
        await audioEngine.play();

        // Save to DB playlist
        if (videoId) {
          await platform.playlistAdd({
            video_id: videoId,
            title: title,
            url: youtubeUrl,
            cdn_url: audioUrl || '',
          });
          loadPlaylistFromDB();
        }
      } catch (err) {
        setError(`YouTube error: ${err}`);
        setTrackInfo('', 'error');
      } finally {
        setLoading(false);
      }
    },
    [setTrackInfo, setPlaying, setVideoId, setLocalVideoUrl, loadPlaylistFromDB],
  );

  const loadYouTube = useCallback(async () => {
    setError('');
    const sanitized = sanitizeYouTubeUrl(ytUrl);
    if (!sanitized) {
      setError('Invalid YouTube URL');
      return;
    }
    rememberUrl(sanitized);
    await playYouTubeByInfo(sanitized, 'YouTube Audio');
  }, [ytUrl, playYouTubeByInfo, rememberUrl]);

  // YouTube search by title
  const searchYouTube = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) { setError('Min 2 characters for search'); return; }

    setSearchLoading(true);
    setError('');
    rememberSearch(q);
    try {
      const results = await platform.youtubeSearch(q, 8);
      setSearchResults(results);
      setShowSearch(true);
    } catch (err) {
      setError(`Search error: ${err}`);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, rememberSearch]);

  // Play all search results as a queue
  const playAllSearch = useCallback(async () => {
    if (searchResults.length === 0) return;
    const items: QueueItem[] = searchResults.map((r) => ({
      videoId: r.id,
      title: r.title,
      url: r.url,
    }));
    setQueue(items);
    setQueueIndex(0);
    setShowSearch(false);
    await playYouTubeByInfo(items[0].url, items[0].title);
  }, [searchResults, setQueue, setQueueIndex, playYouTubeByInfo]);

  // Play all playlist entries as a queue
  const playAllPlaylist = useCallback(async () => {
    if (playlist.length === 0) return;
    const items: QueueItem[] = playlist.map((e) => ({
      videoId: e.video_id,
      title: e.title,
      url: e.url,
      cdnUrl: e.cdn_url || undefined,
    }));
    setQueue(items);
    setQueueIndex(0);
    await playYouTubeByInfo(items[0].url, items[0].title, items[0].cdnUrl);
  }, [playlist, setQueue, setQueueIndex, playYouTubeByInfo]);

  // Replay from playlist
  const replayFromPlaylist = useCallback(
    async (entry: DbPlaylistEntry) => {
      await playYouTubeByInfo(entry.url, entry.title, entry.cdn_url || undefined);
    },
    [playYouTubeByInfo],
  );

  const deleteFromPlaylist = useCallback(async (videoId: string) => {
    try {
      await platform.playlistDelete(videoId);
      loadPlaylistFromDB();
    } catch (err) {
      setError(`Delete error: ${err}`);
    }
  }, [loadPlaylistFromDB]);

  const clearPlaylist = useCallback(async () => {
    try {
      await platform.playlistClear();
      loadPlaylistFromDB();
    } catch (err) {
      setError(`Clear error: ${err}`);
    }
  }, [loadPlaylistFromDB]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        loadAudioFile(files[0]);
      }
    },
    [loadAudioFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        loadAudioFile(files[0]);
      }
    },
    [loadAudioFile],
  );

  // Format duration from seconds
  const fmtDur = (s: number | null) => {
    if (s == null) return '';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-2 sm:p-3 custom-scrollbar">
      {/* Drop zone */}
      <div
        className={`flex flex-col items-center justify-center gap-0.5 p-3 rounded-lg border-2 border-dashed transition-all cursor-pointer ${
          dragOver
            ? 'border-neon-cyan bg-neon-cyan/5'
            : 'border-dark-500/50 hover:border-dark-500'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <span className="text-[9px] sm:text-[10px] font-mono text-gray-500">DROP MEDIA/MUSIC</span>
        <span className="text-[7px] sm:text-[8px] font-mono text-gray-600">MP3, WAV, MP4, WebM, FLAC...</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/mp4,video/webm,video/x-matroska,.mp3,.wav,.ogg,.flac,.aac,.m4a,.webm,.mp4,.mkv,.avi,.mov"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Video Preview — YouTube thumbnail or local video */}
      {(currentVideoId || localVideoUrl) && (
        <div className="flex flex-col gap-1 mt-1">
          <span className="text-[8px] font-mono text-neon-cyan uppercase tracking-wider">Video Preview</span>
          <div className="aspect-video w-full bg-black rounded overflow-hidden border border-dark-500/30 relative group">
            {localVideoUrl ? (
              <video
                ref={videoRef}
                src={localVideoUrl}
                className="w-full h-full object-contain"
                muted
                playsInline
              />
            ) : currentVideoId ? (
              <>
                <img
                  src={`https://img.youtube.com/vi/${currentVideoId}/mqdefault.jpg`}
                  alt="YouTube thumbnail"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${currentVideoId}/default.jpg`; }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                  <a
                    href={`https://www.youtube.com/watch?v=${currentVideoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-600/90 hover:bg-red-500 text-white text-[10px] font-mono font-bold transition-colors"
                  >
                    ▶ WATCH ON YOUTUBE
                  </a>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* YouTube URL input */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[8px] sm:text-[9px] font-mono text-gray-500">YOUTUBE URL</span>
        <div className="relative flex gap-1 w-full">
          <input
            type="text"
            value={ytUrl}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => {
              setYtUrl(e.target.value);
              setShowUrlHistory(true);
            }}
            onFocus={() => setShowUrlHistory(true)}
            onBlur={() => window.setTimeout(() => setShowUrlHistory(false), 120)}
            placeholder="youtu.be/..."
            className="flex-1 min-w-0 px-1.5 py-1 text-[9px] sm:text-[10px] font-mono bg-dark-700 border border-dark-500/50 rounded
              text-gray-300 placeholder-gray-600 focus:border-neon-cyan focus:outline-none transition-colors"
            onKeyDown={(e) => e.key === 'Enter' && loadYouTube()}
          />
          <button
            className="shrink-0 px-2 py-1 text-[8px] sm:text-[9px] font-mono rounded border border-neon-cyan/50 text-neon-cyan
              bg-neon-cyan/5 hover:bg-neon-cyan/15 transition-colors disabled:opacity-40"
            onClick={loadYouTube}
            disabled={loading}
          >
            {loading ? '...' : 'LOAD'}
          </button>
          {showUrlHistory && urlHistoryMatches.length > 0 && (
            <HistoryDropdown
              items={urlHistoryMatches}
              accent="cyan"
              emptyLabel="No URL history"
              onPick={(value) => {
                setYtUrl(value);
                setShowUrlHistory(false);
              }}
              onClear={clearUrlHistory}
            />
          )}
        </div>
      </div>

      {/* YouTube Search by Title */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[8px] sm:text-[9px] font-mono text-neon-magenta">SEARCH BY TITLE</span>
        <div className="relative flex gap-1 w-full">
          <input
            type="text"
            value={searchQuery}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowQueryHistory(true);
            }}
            onFocus={() => setShowQueryHistory(true)}
            onBlur={() => window.setTimeout(() => setShowQueryHistory(false), 120)}
            placeholder="Song name..."
            className="flex-1 min-w-0 px-1.5 py-1 text-[9px] sm:text-[10px] font-mono bg-dark-700 border border-neon-magenta/30 rounded
              text-gray-300 placeholder-gray-600 focus:border-neon-magenta focus:outline-none transition-colors"
            onKeyDown={(e) => e.key === 'Enter' && searchYouTube()}
          />
          <button
            className="shrink-0 px-2 py-1 text-[8px] sm:text-[9px] font-mono rounded border border-neon-magenta/50 text-neon-magenta
              bg-neon-magenta/5 hover:bg-neon-magenta/15 transition-colors disabled:opacity-40"
            onClick={searchYouTube}
            disabled={searchLoading}
          >
            {searchLoading ? '...' : 'FIND'}
          </button>
          {showQueryHistory && searchHistoryMatches.length > 0 && (
            <HistoryDropdown
              items={searchHistoryMatches}
              accent="magenta"
              emptyLabel="No search history"
              onPick={(value) => {
                setSearchQuery(value);
                setShowQueryHistory(false);
              }}
              onClear={clearSearchHistory}
            />
          )}
        </div>
      </div>

      {/* Search Results */}
      {showSearch && searchResults.length > 0 && (
        <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between">
            <span className="text-[7px] font-mono text-gray-500">SEARCH RESULTS ({searchResults.length})</span>
            <button
              className="text-[7px] font-mono px-1.5 py-0.5 rounded border border-neon-magenta/50 text-neon-magenta bg-neon-magenta/10 hover:bg-neon-magenta/20 transition-colors"
              onClick={playAllSearch}
            >
              ▶ PLAY ALL
            </button>
          </div>
          {searchResults.map((r) => (
            <button
              key={r.id}
              className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-dark-700/60 hover:bg-neon-magenta/10 border border-dark-500/30
                hover:border-neon-magenta/40 transition-all text-left group w-full"
              onClick={() => { setShowSearch(false); setSearchResults([]); playYouTubeByInfo(r.url, r.title); }}
            >
              <span className="text-[8px] font-mono text-neon-magenta/60 group-hover:text-neon-magenta shrink-0">▶</span>
              <span className="text-[8px] font-mono text-gray-300 truncate flex-1">{r.title}</span>
              {r.duration != null && (
                <span className="text-[7px] font-mono text-gray-500 shrink-0">{fmtDur(r.duration)}</span>
              )}
            </button>
          ))}
          <button
            className="text-[7px] font-mono text-gray-600 hover:text-gray-400 py-0.5"
            onClick={() => { setShowSearch(false); setSearchResults([]); }}
          >Close</button>
        </div>
      )}

      {/* Playlist from DB */}
      <div className="mt-1 pt-1 border-t border-dark-500/30">
        <div className="flex items-center justify-between mb-1">
          <button
            className="text-[8px] font-mono font-bold text-neon-green tracking-wider uppercase hover:text-neon-green/80 transition-colors"
            onClick={() => setShowPlaylist(!showPlaylist)}
          >
            SAVED PLAYLIST {showPlaylist ? '▲' : '▼'} [{playlist.length}]
          </button>
          <div className="flex items-center gap-1">
            {playlist.length > 0 && (
              <>
                <button
                  className="text-[7px] font-mono px-1.5 py-0.5 rounded border border-neon-green/50 text-neon-green bg-neon-green/10 hover:bg-neon-green/20 transition-colors"
                  onClick={playAllPlaylist}
                >
                  ▶ PLAY ALL
                </button>
                <button
                  className="text-[7px] font-mono text-gray-600 hover:text-red-400 transition-colors"
                  onClick={clearPlaylist}
                >CLEAR</button>
              </>
            )}
          </div>
        </div>

        {showPlaylist && (
          <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto custom-scrollbar">
            {playlist.length === 0 && (
              <span className="text-[7px] font-mono text-gray-600 italic">No tracks saved yet</span>
            )}
            {playlist.map((entry) => (
              <div
                key={entry.video_id}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-dark-700/40 border border-dark-500/20 hover:border-neon-green/30 transition-colors group"
              >
                <button
                  className="text-[8px] font-mono text-neon-green/50 group-hover:text-neon-green shrink-0"
                  onClick={() => replayFromPlaylist(entry)}
                  title="Replay"
                >▶</button>
                <span className="text-[8px] font-mono text-gray-400 truncate flex-1">{entry.title}</span>
                {entry.duration > 0 && (
                  <span className="text-[6px] font-mono text-gray-600 shrink-0">{fmtDur(entry.duration)}</span>
                )}
                <span className="text-[6px] font-mono text-gray-600 shrink-0">
                  {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  className="text-[7px] font-mono text-gray-600 hover:text-red-400 shrink-0 ml-0.5"
                  onClick={() => deleteFromPlaylist(entry.video_id)}
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-[8px] sm:text-[9px] font-mono text-red-400 px-1 break-words">{error}</div>
      )}
    </div>
  );
};
