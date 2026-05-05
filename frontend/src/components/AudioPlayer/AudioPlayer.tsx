import React, { useCallback, useEffect, useRef } from 'react';
import { useAudioStore, QueueItem } from '../../store/audioStore';
import { audioEngine } from '../../audio/AudioEngine';
import { platform } from '../../platform/platform';

export const AudioPlayer: React.FC = () => {
  const {
    isPlaying,
    trackTitle,
    trackStatus,
    trackDuration,
    trackCurrentTime,
    volume,
    loopEnabled,
    setPlaying,
    setTrackInfo,
    setCurrentTime,
    setVolume,
    updateMetrics,
    setTrackDuration,
    setFxCpuLoad,
    setLoopEnabled,
    setVideoId,
    queueAdvance,
    setLocalVideoUrl,
    setMeters,
  } = useAudioStore();

  const advancingRef = useRef(false);
  const playQueueItemRef = useRef<(item: QueueItem, depth?: number) => Promise<void>>();

  // Update current time periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const audio = audioEngine.audio;
      if (audio) {
        setCurrentTime(audio.currentTime);
        if (audio.duration && !isNaN(audio.duration)) {
          setTrackDuration(audio.duration);
        }
      }
    }, 250);
    return () => clearInterval(interval);
  }, [setCurrentTime, setTrackDuration]);

  // Sync loop property on audio element
  useEffect(() => {
    const audio = audioEngine.audio;
    if (audio) {
      audio.loop = loopEnabled;
    }
  }, [loopEnabled]);

  // Play a queue item with depth-limited error skip
  const playQueueItem = useCallback(async (item: QueueItem, depth = 0): Promise<void> => {
    try {
      setTrackInfo(item.title, 'loading');
      setVideoId(item.videoId);
      setLocalVideoUrl(null);
      let audioUrl = item.cdnUrl;
      if (!audioUrl) {
        const extractResult = await platform.youtubeExtract(item.url);
        audioUrl = extractResult.audio_url;
        // Update DB with fresh CDN URL for future replays
        if (item.videoId) {
          platform.playlistUpdateCdn(item.videoId, audioUrl).catch(() => {});
        }
      }
      const streamUrl = await platform.getStreamUrl(audioUrl!);
      await audioEngine.loadAudio(streamUrl);
      setTrackInfo(item.title, 'playing', audioEngine.audio?.duration);
      setPlaying(true);
      await audioEngine.play();
    } catch (err) {
      console.error('Queue auto-advance error:', err);
      if (depth >= 5) {
        setPlaying(false);
        setTrackInfo('', 'error');
        return;
      }
      const next = queueAdvance();
      if (next) {
        await playQueueItem(next, depth + 1);
      } else {
        setPlaying(false);
        setTrackInfo('', 'error');
      }
    }
  }, [setTrackInfo, setPlaying, setVideoId, setLocalVideoUrl, queueAdvance]);

  // Keep ref in sync so the ended handler always calls the latest version
  useEffect(() => {
    playQueueItemRef.current = playQueueItem;
  }, [playQueueItem]);

  // Handle track end — auto-advance queue or pause
  useEffect(() => {
    const audio = audioEngine.audio;
    if (!audio) return;
    const handleEnded = async () => {
      if (loopEnabled) return;
      if (advancingRef.current) return;
      advancingRef.current = true;
      try {
        const next = queueAdvance();
        if (next && playQueueItemRef.current) {
          await playQueueItemRef.current(next);
        } else {
          setPlaying(false);
          setTrackInfo(trackTitle, 'paused');
        }
      } finally {
        advancingRef.current = false;
      }
    };
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [loopEnabled, trackTitle, setPlaying, setTrackInfo, queueAdvance]);

  // Update system metrics + meters + FX CPU estimate
  useEffect(() => {
    const interval = setInterval(() => {
      if (audioEngine.isInitialized) {
        updateMetrics(audioEngine.getLatency(), audioEngine.getBufferSize());
        // Push meter values from engine to store
        const m = audioEngine.updateMeters();
        setMeters(m);
        // CPU estimate
        const s = useAudioStore.getState();
        let load = 0;
        if (s.bassBoost > 0) load += 5;
        if (s.reverb > 0) load += 20;
        if (s.echo > 0) load += 10;
        if (s.sweep > 0) load += 8;
        if (s.pan !== 50) load += 3;
        if (s.pitchSpeed !== 1) load += 4;
        if (s.drive > 0) load += 8;
        if (s.autoPanDepth > 0) load += 4;
        if (s.filterResonance > 4) load += 2;
        if (s.echoFeedback > 50 && s.echo > 0) load += 3;
        if (s.noiseGate > 0) load += 3;
        if (s.exciter > 0) load += 8;
        if (s.stereoWidth !== 50) load += 5;
        if (s.compressor.threshold > -60) load += 6;
        setFxCpuLoad(Math.min(load, 100));
      }
    }, 250);
    return () => clearInterval(interval);
  }, [updateMetrics, setFxCpuLoad, setMeters]);

  const handlePlayPause = useCallback(async () => {
    if (!audioEngine.isInitialized) return;

    if (isPlaying) {
      audioEngine.pause();
      setPlaying(false);
      setTrackInfo(trackTitle, 'paused');
    } else {
      await audioEngine.play();
      setPlaying(true);
      setTrackInfo(trackTitle, 'playing');
    }
  }, [isPlaying, trackTitle, setPlaying, setTrackInfo]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      audioEngine.seek(time);
      setCurrentTime(time);
    },
    [setCurrentTime],
  );

  const handleVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const vol = parseFloat(e.target.value);
      setVolume(vol);
      audioEngine.setVolume(vol);
    },
    [setVolume],
  );

  const formatTime = (t: number): string => {
    if (!t || isNaN(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const statusText = trackStatus === 'idle' ? 'No Track Loaded' : trackStatus.toUpperCase();
  const statusColor =
    trackStatus === 'playing'
      ? 'text-neon-green'
      : trackStatus === 'paused'
      ? 'text-neon-cyan'
      : trackStatus === 'error'
      ? 'text-red-400'
      : 'text-gray-500';

  return (
    <div className="flex items-center gap-2 sm:gap-3 h-12 sm:h-14 px-2 sm:px-4 bg-dark-800 border-t border-dark-500/50">
      {/* Play/Pause */}
      <button
        className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border transition-all text-sm ${
          isPlaying
            ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan shadow-neon'
            : 'border-dark-500 text-gray-400 hover:border-neon-cyan hover:text-neon-cyan'
        }`}
        onClick={handlePlayPause}
        disabled={trackStatus === 'idle'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      {/* Repeat */}
      <button
        className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border transition-all text-xs ${
          loopEnabled
            ? 'border-neon-green bg-neon-green/10 text-neon-green shadow-neon-green'
            : 'border-dark-500 text-gray-500 hover:border-neon-green hover:text-neon-green'
        }`}
        onClick={() => setLoopEnabled(!loopEnabled)}
        title={loopEnabled ? 'Repeat ON' : 'Repeat OFF'}
      >
        ⟳
      </button>

      {/* Time + Seek */}
      <span className="text-[9px] sm:text-[10px] font-mono text-gray-500 w-10 sm:w-12 text-right shrink-0">
        {formatTime(trackCurrentTime)}
      </span>
      <input
        type="range"
        min={0}
        max={trackDuration || 0}
        step={0.1}
        value={trackCurrentTime}
        onChange={handleSeek}
        className="flex-1 min-w-0 h-1 appearance-none bg-dark-600 rounded-full cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-neon-cyan [&::-webkit-slider-thumb]:shadow-neon"
        disabled={trackStatus === 'idle'}
      />
      <span className="text-[9px] sm:text-[10px] font-mono text-gray-500 w-10 sm:w-12 shrink-0">
        {formatTime(trackDuration)}
      </span>

      {/* Status info */}
      <div className="hidden lg:flex items-center gap-3 min-w-[200px] border-r border-dark-500/30 pr-4 mr-2">
        <div className="w-10 h-10 rounded-lg bg-dark-700/50 flex items-center justify-center border border-dark-500/30">
          <svg className="w-6 h-6 text-neon-cyan drop-shadow-neon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-mono font-bold text-white truncate max-w-[140px]">
            {trackTitle || 'No Track Loaded'}
          </span>
          <span className={`text-[9px] font-mono uppercase tracking-wider ${
            trackStatus === 'playing' ? 'text-neon-green' : 
            trackStatus === 'error' ? 'text-red-500' : 'text-gray-500'
          }`}>
            {trackStatus}
          </span>
        </div>
        {/* Small IN/OUT Bars — CSS animated */}
        <div className="flex gap-1 ml-auto">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-1.5 h-6 bg-dark-700 rounded-full overflow-hidden relative border border-dark-500/20">
              {trackStatus === 'playing' && (
                <div className="absolute bottom-0 w-full bg-neon-cyan animate-bar-bounce" />
              )}
            </div>
            <span className="text-[6px] text-gray-500 font-mono">IN</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-1.5 h-6 bg-dark-700 rounded-full overflow-hidden relative border border-dark-500/20">
              {trackStatus === 'playing' && (
                <div className="absolute bottom-0 w-full bg-neon-magenta animate-bar-bounce-alt" />
              )}
            </div>
            <span className="text-[6px] text-gray-500 font-mono">OUT</span>
          </div>
        </div>
      </div>

      {/* Track info */}
      <div className="hidden sm:flex flex-col min-w-0 max-w-[200px]">
        <span className="text-[11px] font-mono text-gray-300 truncate">{trackTitle || '—'}</span>
        <span className={`text-[9px] font-mono ${statusColor}`}>{statusText}</span>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-1 sm:gap-1.5 ml-auto shrink-0">
        <span className="text-[9px] sm:text-[10px] font-mono text-gray-500">VOL</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={handleVolume}
          className="w-14 sm:w-20 h-1 appearance-none bg-dark-600 rounded-full cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-neon-green [&::-webkit-slider-thumb]:shadow-neon-green"
        />
        <span className="text-[8px] sm:text-[9px] font-mono text-gray-500 w-7 sm:w-8">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  );
};
