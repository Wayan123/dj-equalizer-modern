export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export const EQ_LABELS = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'] as const;

export const EQ_MIN_DB = -12;
export const EQ_MAX_DB = 12;
export const EQ_DEFAULT_DB = 0;

export type VizMode = 'FFT' | 'WAVE' | 'RADIAL' | 'PARTICLE' | 'STEREO' | 'SPECTRO' | 'VU';

export const VIZ_MODES: VizMode[] = ['FFT', 'WAVE', 'RADIAL', 'PARTICLE', 'STEREO', 'SPECTRO', 'VU'];

export const FFT_SIZE = 2048;
export const SMOOTHING = 0.8;

export const NEON_COLORS = {
  cyan: '#00f0ff',
  magenta: '#ff00ff',
  green: '#00ff88',
  purple: '#8b5cf6',
  pink: '#ec4899',
  blue: '#3b82f6',
  orange: '#f97316',
  yellow: '#fbbf24',
} as const;

export type FXFilterMode = 'lowpass' | 'highpass' | 'notch';

export interface FXState {
  bassBoost: number;
  reverb: number;
  echo: number;
  sweep: number;
  pan: number;
  pitchSpeed: number;
  filterMode: FXFilterMode;
  filterResonance: number;
  drive: number;
  autoPanDepth: number;
  autoPanRate: number;
  echoTime: number;
  echoFeedback: number;
  reverbTone: number;
}

export type FXParam = keyof FXState;

export const FX_DEFAULTS: FXState = {
  bassBoost: 0,
  reverb: 0,
  echo: 0,
  sweep: 0,
  pan: 50,
  pitchSpeed: 1,
  filterMode: 'lowpass',
  filterResonance: 1,
  drive: 0,
  autoPanDepth: 0,
  autoPanRate: 0.5,
  echoTime: 35,
  echoFeedback: 35,
  reverbTone: 100,
};

export const FX_PRESETS: Record<string, Partial<FXState>> = {
  Clean: { ...FX_DEFAULTS },
  'Club Filter': {
    filterMode: 'lowpass',
    sweep: 58,
    filterResonance: 6,
    bassBoost: 14,
  },
  'Echo Wash': {
    echo: 58,
    echoTime: 42,
    echoFeedback: 56,
    reverb: 34,
    reverbTone: 78,
  },
  'Wide Motion': {
    pan: 50,
    autoPanDepth: 36,
    autoPanRate: 0.35,
    reverb: 18,
  },
  'Drive Lift': {
    drive: 34,
    bassBoost: 18,
    reverbTone: 88,
  },
  'Space Build': {
    filterMode: 'lowpass',
    sweep: 34,
    filterResonance: 4,
    echo: 48,
    echoTime: 64,
    echoFeedback: 62,
    reverb: 64,
    reverbTone: 68,
  },
};

export const PRESET_FLAT = EQ_FREQUENCIES.map(() => 0);
export const PRESET_BASS_BOOST = [6, 5, 4, 2, 0, 0, 0, 0, 0, 0];
export const PRESET_TREBLE_BOOST = [0, 0, 0, 0, 0, 1, 3, 5, 6, 6];
export const PRESET_VOCAL = [-2, -1, 0, 2, 5, 5, 3, 1, 0, -1];
export const PRESET_ROCK = [4, 3, 1, -1, -1, 0, 2, 4, 5, 4];
export const PRESET_ELECTRONIC = [5, 4, 1, 0, -2, -1, 0, 2, 4, 5];
export const PRESET_JAZZ = [2, 1, 0, 1, -1, -1, 0, 1, 2, 3];

export const EQ_PRESETS: Record<string, number[]> = {
  Flat: PRESET_FLAT,
  'Bass Boost': PRESET_BASS_BOOST,
  'Treble Boost': PRESET_TREBLE_BOOST,
  Vocal: PRESET_VOCAL,
  Rock: PRESET_ROCK,
  Electronic: PRESET_ELECTRONIC,
  Jazz: PRESET_JAZZ,
};

export interface DSPPreset {
  name: string;
  eq: number[];
  compressor: { threshold: number; ratio: number; attack: number; release: number };
  limiter: { ceiling: number };
  widener: number;
  exciter: number;
  noiseGate: number;
  inputGain: number;
  fx?: Partial<FXState>;
}

export const DSP_PRESETS: Record<string, DSPPreset> = {
  Music: {
    name: 'Music',
    eq: [2, 1, 0, 0, 0, 0, 0, 1, 2, 2],
    compressor: { threshold: -18, ratio: 4, attack: 0.01, release: 0.2 },
    limiter: { ceiling: -1 },
    widener: 60,
    exciter: 10,
    noiseGate: 0,
    inputGain: 50,
  },
  Movie: {
    name: 'Movie',
    eq: [4, 3, 1, -1, -2, 0, 2, 4, 5, 4],
    compressor: { threshold: -20, ratio: 5, attack: 0.005, release: 0.15 },
    limiter: { ceiling: -1 },
    widener: 70,
    exciter: 5,
    noiseGate: 10,
    inputGain: 55,
  },
  'Voice Clarity': {
    name: 'Voice Clarity',
    eq: [0, -2, -1, 3, 5, 4, 2, 0, 0, 0],
    compressor: { threshold: -24, ratio: 3, attack: 0.01, release: 0.2 },
    limiter: { ceiling: -3 },
    widener: 30,
    exciter: 15,
    noiseGate: 20,
    inputGain: 60,
  },
  Podcast: {
    name: 'Podcast',
    eq: [-2, -1, 0, 2, 5, 5, 3, 1, -1, -2],
    compressor: { threshold: -18, ratio: 4, attack: 0.005, release: 0.1 },
    limiter: { ceiling: -2 },
    widener: 20,
    exciter: 8,
    noiseGate: 25,
    inputGain: 55,
  },
  'Bass Boost': {
    name: 'Bass Boost',
    eq: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
    compressor: { threshold: -20, ratio: 3, attack: 0.02, release: 0.3 },
    limiter: { ceiling: -1 },
    widener: 50,
    exciter: 0,
    noiseGate: 0,
    inputGain: 50,
  },
  'Night Mode': {
    name: 'Night Mode',
    eq: [-4, -3, -2, 0, 0, 0, -1, -2, -4, -5],
    compressor: { threshold: -12, ratio: 6, attack: 0.005, release: 0.1 },
    limiter: { ceiling: -3 },
    widener: 40,
    exciter: 0,
    noiseGate: 15,
    inputGain: 40,
  },
};

export const MAX_FILE_SIZE_MB = 500;
export const ACCEPTED_AUDIO_TYPES = [
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac',
  'audio/mp4', 'audio/webm', 'audio/x-m4a', 'audio/amr', 'audio/3gpp',
  'video/mp4', 'video/webm', 'video/x-matroska', 'video/quicktime',
  'video/x-msvideo', 'video/3gpp', 'video/x-flv',
];

export const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(((www\.|m\.|music\.)?youtube\.com\/((watch\?v=|embed\/|shorts\/|live\/)[A-Za-z0-9_-]+)([&?#][^\s]*)?)|youtu\.be\/[A-Za-z0-9_-]+([&?#][^\s]*)?)$/i;

export const API_BASE = '/api';
