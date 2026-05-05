import { create } from 'zustand';
import {
  EQ_DEFAULT_DB,
  EQ_FREQUENCIES,
  FX_DEFAULTS,
  type FXParam,
  type FXState,
  VizMode,
} from '../utils/constants';

export type TrackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface QueueItem {
  videoId: string;
  title: string;
  url: string;
  cdnUrl?: string;
}

export type ThemeType = 'ORIGINAL' | 'NEON_CYAN' | 'NEON_MAGENTA' | 'NEON_GREEN' | 'GOLD' | 'RETRO_AMBER' | 'ULTRA_VIOLET';
export type VizVariant = 'DEFAULT' | 'DENSE' | 'OUTLINE' | 'FILLED' | 'GLOW_ONLY';

export interface CompressorParams {
  threshold: number; // -60 to 0 dB
  ratio: number;     // 1-20
  attack: number;    // 0-0.5s
  release: number;   // 0-1s
}

export interface MeterValues {
  rmsDb: number;
  peakDb: number;
  lufs: number;
  gainReduction: number;
  stereoWidth: number;
}

interface AudioState extends FXState {
  // Theme
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  vizVariant: VizVariant;
  setVizVariant: (variant: VizVariant) => void;

  // EQ
  eqValues: number[];
  setEqBand: (index: number, value: number) => void;
  setEqValues: (values: number[]) => void;
  resetEq: () => void;

  // YouTube Video
  currentVideoId: string | null;
  setVideoId: (id: string | null) => void;

  // Local Video Preview
  localVideoUrl: string | null;
  setLocalVideoUrl: (url: string | null) => void;

  // Playback Queue
  queue: QueueItem[];
  queueIndex: number;
  setQueue: (items: QueueItem[]) => void;
  setQueueIndex: (index: number) => void;
  queueAdvance: () => QueueItem | null;

  // Enhancer (DSP)
  inputGain: number;
  noiseGate: number;
  compressor: CompressorParams;
  limiterCeiling: number;
  exciter: number;
  stereoWidth: number;
  setEnhancer: (param: 'inputGain' | 'noiseGate' | 'limiterCeiling' | 'exciter' | 'stereoWidth', value: number) => void;
  setCompressorParams: (params: Partial<CompressorParams>) => void;

  // FX
  setFx: (fx: FXParam, value: FXState[FXParam]) => void;
  setFxValues: (values: Partial<FXState>) => void;
  resetFx: () => void;

  // Meters
  meters: MeterValues;
  setMeters: (meters: MeterValues) => void;

  // Playback
  isPlaying: boolean;
  trackTitle: string;
  trackStatus: TrackStatus;
  trackDuration: number;
  trackCurrentTime: number;
  volume: number;
  loopEnabled: boolean;
  setPlaying: (playing: boolean) => void;
  setLoopEnabled: (enabled: boolean) => void;
  setTrackInfo: (title: string, status: TrackStatus, duration?: number) => void;
  setCurrentTime: (time: number) => void;
  setTrackDuration: (duration: number) => void;
  setVolume: (vol: number) => void;

  // Visualization
  vizMode: VizMode;
  setVizMode: (mode: VizMode) => void;

  // System
  latency: number;
  bufferSize: number;
  dacActive: boolean;
  setDacActive: (active: boolean) => void;
  snapEnabled: boolean;
  setSnapEnabled: (enabled: boolean) => void;
  updateMetrics: (latency: number, bufferSize: number) => void;

  // FX CPU
  fxCpuLoad: number;
  setFxCpuLoad: (load: number) => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  // Theme
  theme: 'ORIGINAL',
  setTheme: (theme) => set({ theme }),
  vizVariant: 'DEFAULT',
  setVizVariant: (variant) => set({ vizVariant: variant }),

  // EQ
  eqValues: EQ_FREQUENCIES.map(() => EQ_DEFAULT_DB),
  setEqBand: (index, value) =>
    set((state) => {
      const newValues = [...state.eqValues];
      newValues[index] = value;
      return { eqValues: newValues };
    }),
  setEqValues: (values) => set({ eqValues: values }),
  resetEq: () => set({ eqValues: EQ_FREQUENCIES.map(() => EQ_DEFAULT_DB) }),

  // YouTube Video
  currentVideoId: null,
  setVideoId: (id) => set({ currentVideoId: id }),

  // Local Video Preview
  localVideoUrl: null,
  setLocalVideoUrl: (url) => set({ localVideoUrl: url }),

  // Playback Queue
  queue: [],
  queueIndex: -1,
  setQueue: (items) => set({ queue: items, queueIndex: items.length > 0 ? 0 : -1 }),
  setQueueIndex: (index) => set({ queueIndex: index }),
  queueAdvance: (): QueueItem | null => {
    const state: AudioState = useAudioStore.getState();
    const nextIndex = state.queueIndex + 1;
    if (nextIndex < state.queue.length) {
      useAudioStore.setState({ queueIndex: nextIndex });
      return state.queue[nextIndex];
    }
    useAudioStore.setState({ queueIndex: -1 });
    return null;
  },

  // Enhancer (DSP)
  inputGain: 50, // 0-100, default 50 = gain 1
  noiseGate: 0,  // 0-100, 0 = off
  compressor: { threshold: -24, ratio: 4, attack: 0.01, release: 0.2 },
  limiterCeiling: -1, // dB
  exciter: 0,    // 0-100
  stereoWidth: 50, // 0-100, 50 = normal
  setEnhancer: (param, value) => set({ [param]: value }),
  setCompressorParams: (params) =>
    set((state) => ({ compressor: { ...state.compressor, ...params } })),

  // FX
  ...FX_DEFAULTS,
  setFx: (fx, value) => set({ [fx]: value } as Partial<AudioState>),
  setFxValues: (values) => set(values),
  resetFx: () => set({ ...FX_DEFAULTS }),

  // Meters
  meters: { rmsDb: -60, peakDb: -60, lufs: -70, gainReduction: 0, stereoWidth: 0 },
  setMeters: (meters) => set({ meters }),

  // Playback
  isPlaying: false,
  trackTitle: '',
  trackStatus: 'idle',
  trackDuration: 0,
  trackCurrentTime: 0,
  volume: 0.8,
  loopEnabled: false,
  setPlaying: (playing) => set({ isPlaying: playing }),
  setLoopEnabled: (enabled) => set({ loopEnabled: enabled }),
  setTrackInfo: (title, status, duration) =>
    set({ trackTitle: title, trackStatus: status, trackDuration: duration ?? 0 }),
  setCurrentTime: (time) => set({ trackCurrentTime: time }),
  setTrackDuration: (duration) => set({ trackDuration: duration }),
  setVolume: (vol) => set({ volume: vol }),

  // Visualization
  vizMode: 'FFT',
  setVizMode: (mode) => set({ vizMode: mode }),

  // System
  latency: 0,
  bufferSize: 2048,
  dacActive: false,
  setDacActive: (active) => set({ dacActive: active }),
  snapEnabled: false,
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  updateMetrics: (latency, bufferSize) => set({ latency, bufferSize, dacActive: true }),

  // FX CPU
  fxCpuLoad: 0,
  setFxCpuLoad: (load: number) => set({ fxCpuLoad: load }),
}));
