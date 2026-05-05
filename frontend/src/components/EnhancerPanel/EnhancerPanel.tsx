import React, { useCallback } from 'react';
import { useAudioStore, CompressorParams } from '../../store/audioStore';
import { audioEngine } from '../../audio/AudioEngine';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  color: string;
  onChange: (value: number) => void;
}

const Knob: React.FC<KnobProps> = ({ label, value, min, max, step = 1, unit = '', color, onChange }) => {
  const pct = ((value - min) / (max - min)) * 100;
  const angle = -135 + (pct / 100) * 270;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const knob = e.currentTarget;
      knob.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      const startValue = value;

      const handleMove = (moveEvent: PointerEvent) => {
        const delta = (startY - moveEvent.clientY) * 0.5;
        const range = max - min;
        const rawNew = startValue + (delta / 100) * range;
        const stepped = Math.round(rawNew / step) * step;
        const newValue = Math.max(min, Math.min(max, stepped));
        onChange(newValue);
      };

      const handleUp = () => {
        knob.releasePointerCapture(e.pointerId);
        knob.removeEventListener('pointermove', handleMove);
        knob.removeEventListener('pointerup', handleUp);
      };

      knob.addEventListener('pointermove', handleMove);
      knob.addEventListener('pointerup', handleUp);
    },
    [value, min, max, step, onChange],
  );

  const displayValue = step < 1 ? value.toFixed(2) : Math.round(value);

  return (
    <div className="knob-container">
      <div
        className="relative w-12 h-12 rounded-full bg-dark-700 border-2 cursor-grab active:cursor-grabbing select-none"
        style={{ borderColor: `${color}44` }}
        onPointerDown={handlePointerDown}
      >
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke={`${color}22`} strokeWidth="3"
            strokeDasharray={`${pct * 1.88} 999`} transform="rotate(135 24 24)" />
        </svg>
        <div className="absolute w-2 h-2 rounded-full" style={{
          backgroundColor: color, boxShadow: `0 0 8px ${color}`,
          left: '50%', top: '4px', transformOrigin: '0 20px', transform: `rotate(${angle}deg)`,
        }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[7px] font-mono" style={{ color }}>{displayValue}{unit}</span>
        </div>
      </div>
      <span className="text-[8px] font-mono text-gray-400 mt-0.5">{label}</span>
    </div>
  );
};

export const EnhancerPanel: React.FC = () => {
  const {
    inputGain, noiseGate, compressor, limiterCeiling, exciter, stereoWidth,
    setEnhancer, setCompressorParams, meters,
  } = useAudioStore();

  const handleEnhancerChange = useCallback(
    (param: 'inputGain' | 'noiseGate' | 'limiterCeiling' | 'exciter' | 'stereoWidth', value: number) => {
      setEnhancer(param, value);
      switch (param) {
        case 'inputGain': audioEngine.setInputGain(value); break;
        case 'noiseGate': audioEngine.setNoiseGate(value); break;
        case 'limiterCeiling': audioEngine.setLimiterCeiling(value); break;
        case 'exciter': audioEngine.setExciter(value); break;
        case 'stereoWidth': audioEngine.setStereoWidth(value); break;
      }
    },
    [setEnhancer],
  );

  const handleCompressorChange = useCallback(
    (params: Partial<CompressorParams>) => {
      setCompressorParams(params);
      audioEngine.setCompressor(params);
    },
    [setCompressorParams],
  );

  const meterBar = (label: string, value: number, min: number, max: number, color: string, unit = '') => {
    const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[7px] font-mono text-gray-500 w-8 shrink-0">{label}</span>
        <div className="flex-1 h-1.5 bg-dark-600 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-150" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        <span className="text-[7px] font-mono text-gray-400 w-12 text-right shrink-0">{value.toFixed(1)}{unit}</span>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-1.5 p-2 panel-glow overflow-y-auto custom-scrollbar">
      <div className="text-[10px] font-mono text-neon-magenta neon-text tracking-wider">AUDIO ENHANCER</div>

      {/* Input Gain + Noise Gate + Limiter */}
      <div className="flex items-start justify-center gap-4">
        <Knob label="INPUT" value={inputGain} min={0} max={100} color="#00f0ff" onChange={(v) => handleEnhancerChange('inputGain', v)} />
        <Knob label="GATE" value={noiseGate} min={0} max={100} color="#ef4444" onChange={(v) => handleEnhancerChange('noiseGate', v)} />
        <Knob label="CEILING" value={limiterCeiling} min={-12} max={0} step={0.5} unit="dB" color="#ef4444"
          onChange={(v) => handleEnhancerChange('limiterCeiling', v)} />
      </div>

      {/* Compressor */}
      <div className="border-t border-dark-500/30 pt-1.5">
        <div className="text-[8px] font-mono text-gray-400 mb-1">COMPRESSOR</div>
        <div className="flex items-start justify-center gap-4">
          <Knob label="THRESH" value={compressor.threshold} min={-60} max={0} step={1} unit="dB" color="#fbbf24"
            onChange={(v) => handleCompressorChange({ threshold: v })} />
          <Knob label="RATIO" value={compressor.ratio} min={1} max={20} step={0.5} color="#fbbf24"
            onChange={(v) => handleCompressorChange({ ratio: v })} />
          <Knob label="ATK" value={compressor.attack} min={0} max={0.5} step={0.01} unit="s" color="#fbbf24"
            onChange={(v) => handleCompressorChange({ attack: v })} />
          <Knob label="REL" value={compressor.release} min={0.01} max={1} step={0.01} unit="s" color="#fbbf24"
            onChange={(v) => handleCompressorChange({ release: v })} />
        </div>
      </div>

      {/* Exciter + Stereo Width */}
      <div className="border-t border-dark-500/30 pt-1.5">
        <div className="text-[8px] font-mono text-gray-400 mb-1">EXCITER + STEREO</div>
        <div className="flex items-start justify-center gap-4">
          <Knob label="EXCITER" value={exciter} min={0} max={100} color="#8b5cf6" onChange={(v) => handleEnhancerChange('exciter', v)} />
          <Knob label="WIDTH" value={stereoWidth} min={0} max={100} color="#3b82f6" onChange={(v) => handleEnhancerChange('stereoWidth', v)} />
        </div>
      </div>

      {/* Meters */}
      <div className="border-t border-dark-500/30 pt-1.5">
        <div className="text-[8px] font-mono text-gray-400 mb-1">METERS</div>
        <div className="flex flex-col gap-1">
          {meterBar('RMS', meters.rmsDb, -60, 0, '#00ff88', 'dB')}
          {meterBar('PEAK', meters.peakDb, -60, 0, '#ef4444', 'dB')}
          {meterBar('LUFS', meters.lufs, -70, 0, '#fbbf24', 'LU')}
          {meterBar('GR', meters.gainReduction, -30, 0, '#8b5cf6', 'dB')}
          {meterBar('WIDTH', meters.stereoWidth, 0, 150, '#3b82f6', '%')}
        </div>
      </div>
    </div>
  );
};
