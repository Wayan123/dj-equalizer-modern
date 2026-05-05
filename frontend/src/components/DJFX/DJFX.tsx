import React, { useCallback } from 'react';
import { useAudioStore } from '../../store/audioStore';
import { audioEngine } from '../../audio/AudioEngine';
import {
  FX_DEFAULTS,
  FX_PRESETS,
  type FXFilterMode,
  type FXParam,
  type FXState,
} from '../../utils/constants';

type NumericFXParam =
  | 'bassBoost'
  | 'reverb'
  | 'echo'
  | 'sweep'
  | 'pan'
  | 'pitchSpeed'
  | 'filterResonance'
  | 'drive'
  | 'autoPanDepth'
  | 'autoPanRate'
  | 'echoTime'
  | 'echoFeedback'
  | 'reverbTone';

interface KnobConfig {
  param: NumericFXParam;
  label: string;
  min: number;
  max: number;
  step?: number;
  color: string;
  format?: (value: number) => string;
}

interface RackKnobProps extends KnobConfig {
  value: number;
  defaultValue: number;
  onChange: (param: NumericFXParam, value: number) => void;
}

const echoTimeLabel = (value: number) => {
  const seconds = 0.06 + (value / 100) * 0.94;
  return `${seconds.toFixed(2)}s`;
};

const panLabel = (value: number) => {
  const offset = Math.round(value - 50);
  if (offset === 0) return 'C';
  return offset < 0 ? `L${Math.abs(offset)}` : `R${offset}`;
};

const KNOBS: KnobConfig[] = [
  { param: 'bassBoost', label: 'BASS', min: 0, max: 100, color: '#00f0ff' },
  { param: 'sweep', label: 'SWEEP', min: 0, max: 100, color: '#fbbf24' },
  { param: 'filterResonance', label: 'Q', min: 0.2, max: 12, step: 0.1, color: '#f97316', format: (v) => v.toFixed(1) },
  { param: 'drive', label: 'DRIVE', min: 0, max: 100, color: '#ff00ff' },
  { param: 'reverb', label: 'REVERB', min: 0, max: 100, color: '#8b5cf6' },
  { param: 'reverbTone', label: 'TONE', min: 0, max: 100, color: '#3b82f6' },
  { param: 'echo', label: 'ECHO', min: 0, max: 100, color: '#00ff88' },
  { param: 'echoTime', label: 'TIME', min: 0, max: 100, color: '#22c55e', format: echoTimeLabel },
  { param: 'echoFeedback', label: 'FDBK', min: 0, max: 100, color: '#84cc16' },
  { param: 'pan', label: 'PAN', min: 0, max: 100, color: '#ec4899', format: panLabel },
  { param: 'autoPanDepth', label: 'AUTO', min: 0, max: 100, color: '#fb7185' },
  { param: 'autoPanRate', label: 'RATE', min: 0.1, max: 8, step: 0.1, color: '#60a5fa', format: (v) => `${v.toFixed(1)}Hz` },
  { param: 'pitchSpeed', label: 'PITCH', min: 0.25, max: 4, step: 0.01, color: '#3b82f6', format: (v) => `${v.toFixed(2)}x` },
];

const FILTER_MODES: { label: string; value: FXFilterMode }[] = [
  { label: 'LP', value: 'lowpass' },
  { label: 'HP', value: 'highpass' },
  { label: 'NOTCH', value: 'notch' },
];

const RackKnob: React.FC<RackKnobProps> = ({
  param,
  label,
  value,
  defaultValue,
  min,
  max,
  step = 1,
  color,
  format,
  onChange,
}) => {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const angle = -135 + (pct / 100) * 270;
  const active = Math.abs(value - defaultValue) > step / 2;
  const displayValue = format ? format(value) : Math.round(value).toString();

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const knob = e.currentTarget;
      knob.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      const startValue = value;

      const handleMove = (moveEvent: PointerEvent) => {
        const delta = (startY - moveEvent.clientY) * 0.55;
        const raw = startValue + (delta / 100) * (max - min);
        const stepped = Math.round(raw / step) * step;
        const clamped = Math.max(min, Math.min(max, Number(stepped.toFixed(2))));
        onChange(param, clamped);
      };

      const handleUp = () => {
        knob.releasePointerCapture(e.pointerId);
        knob.removeEventListener('pointermove', handleMove);
        knob.removeEventListener('pointerup', handleUp);
      };

      knob.addEventListener('pointermove', handleMove);
      knob.addEventListener('pointerup', handleUp);
    },
    [value, min, max, step, param, onChange],
  );

  return (
    <div
      className={`w-[76px] h-[76px] rounded-md border bg-dark-800/70 px-1.5 py-1.5 transition-all ${
        active ? 'border-white/20 shadow-[0_0_12px_rgba(0,240,255,0.14)]' : 'border-dark-500/30'
      }`}
      style={{ borderColor: active ? `${color}80` : undefined }}
    >
      <div
        className="relative mx-auto h-10 w-10 rounded-full bg-dark-700 border cursor-grab active:cursor-grabbing select-none"
        style={{ borderColor: `${color}55` }}
        onPointerDown={handlePointerDown}
        onDoubleClick={() => onChange(param, defaultValue)}
        title={`${label}: ${displayValue}`}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="17" fill="none" stroke={`${color}24`} strokeWidth="3" />
          <circle
            cx="22"
            cy="22"
            r="17"
            fill="none"
            pathLength={100}
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${pct} 100`}
            transform="rotate(135 22 22)"
            opacity="0.85"
          />
        </svg>
        <div
          className="absolute h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}`,
            left: '50%',
            top: '4px',
            transformOrigin: '0 16px',
            transform: `rotate(${angle}deg)`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="max-w-[34px] truncate text-center text-[7px] font-mono font-bold" style={{ color }}>
            {displayValue}
          </span>
        </div>
      </div>
      <div className="mt-1 flex min-w-0 flex-col items-center leading-none">
        <span className={`text-[8px] font-mono font-bold ${active ? 'text-white' : 'text-gray-400'}`}>{label}</span>
        <span className="mt-0.5 h-1 w-5 rounded-full" style={{ backgroundColor: active ? color : 'rgba(46,46,74,0.65)' }} />
      </div>
    </div>
  );
};

export const DJFX: React.FC = () => {
  const {
    bassBoost,
    reverb,
    echo,
    sweep,
    pan,
    pitchSpeed,
    filterMode,
    filterResonance,
    drive,
    autoPanDepth,
    autoPanRate,
    echoTime,
    echoFeedback,
    reverbTone,
    setFx,
    setFxValues,
    resetFx,
    fxCpuLoad,
  } = useAudioStore();

  const values: FXState = {
    bassBoost,
    reverb,
    echo,
    sweep,
    pan,
    pitchSpeed,
    filterMode,
    filterResonance,
    drive,
    autoPanDepth,
    autoPanRate,
    echoTime,
    echoFeedback,
    reverbTone,
  };

  const handleFxChange = useCallback(
    <K extends FXParam>(param: K, value: FXState[K]) => {
      setFx(param, value);
      audioEngine.applyFxState({ [param]: value } as Partial<FXState>);
    },
    [setFx],
  );

  const handlePreset = useCallback(
    (preset: Partial<FXState>) => {
      const merged = { ...FX_DEFAULTS, ...preset };
      setFxValues(merged);
      audioEngine.applyFxState(merged);
    },
    [setFxValues],
  );

  const handleReset = useCallback(() => {
    resetFx();
    audioEngine.resetFx();
  }, [resetFx]);

  return (
    <div className="flex-1 min-h-0 panel-glow overflow-y-auto custom-scrollbar p-2">
      <div className="flex flex-col items-start gap-2">
        <div className="flex w-full max-w-[720px] flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-neon-cyan neon-text tracking-wider">DJ FX RACK</span>
            <div className="flex overflow-hidden rounded border border-dark-500/50 bg-dark-800/70">
              {FILTER_MODES.map((mode) => {
                const active = filterMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    className={`h-6 px-2 text-[8px] font-mono font-bold transition-colors ${
                      active ? 'bg-neon-cyan/15 text-neon-cyan' : 'text-gray-500 hover:text-gray-300'
                    }`}
                    onClick={() => handleFxChange('filterMode', mode.value)}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            className="h-6 rounded border border-neon-magenta/40 bg-neon-magenta/5 px-2 text-[8px] font-mono font-bold text-neon-magenta transition-colors hover:bg-neon-magenta/15"
            onClick={handleReset}
          >
            RESET FX
          </button>
        </div>

        <div className="flex max-w-[720px] flex-wrap gap-1">
          {Object.entries(FX_PRESETS).map(([name, preset]) => (
            <button
              key={name}
              className="h-6 rounded border border-dark-500/40 bg-dark-800/80 px-2 text-[8px] font-mono text-gray-300 transition-colors hover:border-neon-green/40 hover:bg-neon-green/10 hover:text-neon-green"
              onClick={() => handlePreset(preset)}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[repeat(3,minmax(0,4.75rem))] gap-1.5 xl:grid-cols-[repeat(6,minmax(0,4.75rem))]">
          {KNOBS.map((knob) => (
            <RackKnob
              key={knob.param}
              {...knob}
              value={values[knob.param] as number}
              defaultValue={FX_DEFAULTS[knob.param] as number}
              onChange={handleFxChange}
            />
          ))}
        </div>

        <div className="flex w-full max-w-[720px] items-center gap-2 pt-1">
          <span className="w-10 shrink-0 text-[8px] font-mono text-gray-500">FX CPU</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-dark-600">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${fxCpuLoad}%`,
                backgroundColor: fxCpuLoad > 80 ? '#ef4444' : fxCpuLoad > 50 ? '#fbbf24' : '#00ff88',
              }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-[8px] font-mono text-gray-500">{fxCpuLoad.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};
