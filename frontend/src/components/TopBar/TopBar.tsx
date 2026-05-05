import React, { useState, useEffect, useRef } from 'react';
import { useAudioStore } from '../../store/audioStore';
import { EQ_PRESETS, DSP_PRESETS, DSPPreset } from '../../utils/constants';
import { audioEngine } from '../../audio/AudioEngine';

type TabType = 'EQ' | 'ENHANCER' | 'FX' | 'VISUALIZER' | 'PRESETS' | 'MANUAL' | 'FFT' | 'SETTINGS';

interface TopBarProps {
  onTabChange?: (tab: TabType) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onTabChange }) => {
  const {
    latency,
    bufferSize,
    dacActive,
    snapEnabled,
    setSnapEnabled,
    setEqValues,
    resetEq,
    theme,
    setEnhancer,
    setCompressorParams,
    setFxValues,
    meters,
  } = useAudioStore();

  const [activeTab, setActiveTab] = useState<TabType>('EQ');
  const [presetOpen, setPresetOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('Flat');
  const presetRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!presetOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (presetRef.current && !presetRef.current.contains(e.target as Node)) {
        setPresetOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [presetOpen]);

  const handlePreset = (name: string) => {
    setSelectedPreset(name);
    // Apply full DSP preset if available
    const dspPreset = DSP_PRESETS[name];
    if (dspPreset) {
      applyDSPPreset(dspPreset);
    } else if (EQ_PRESETS[name]) {
      setEqValues(EQ_PRESETS[name]);
    }
    setPresetOpen(false);
  };

  const applyDSPPreset = (preset: DSPPreset) => {
    setEqValues(preset.eq);
    preset.eq.forEach((gain, i) => audioEngine.setEqBand(i, gain));
    setEnhancer('inputGain', preset.inputGain);
    audioEngine.setInputGain(preset.inputGain);
    setEnhancer('noiseGate', preset.noiseGate);
    audioEngine.setNoiseGate(preset.noiseGate);
    setEnhancer('limiterCeiling', preset.limiter.ceiling);
    audioEngine.setLimiterCeiling(preset.limiter.ceiling);
    setEnhancer('exciter', preset.exciter);
    audioEngine.setExciter(preset.exciter);
    setEnhancer('stereoWidth', preset.widener);
    audioEngine.setStereoWidth(preset.widener);
    setCompressorParams(preset.compressor);
    audioEngine.setCompressor(preset.compressor);
    if (preset.fx) {
      setFxValues(preset.fx);
      audioEngine.applyFxState(preset.fx);
    }
  };

  const handleSave = () => {
    const s = useAudioStore.getState();
    const preset: DSPPreset = {
      name: '',
      eq: s.eqValues,
      compressor: { ...s.compressor },
      limiter: { ceiling: s.limiterCeiling },
      widener: s.stereoWidth,
      exciter: s.exciter,
      noiseGate: s.noiseGate,
      inputGain: s.inputGain,
      fx: {
        bassBoost: s.bassBoost,
        reverb: s.reverb,
        echo: s.echo,
        sweep: s.sweep,
        pan: s.pan,
        pitchSpeed: s.pitchSpeed,
        filterMode: s.filterMode,
        filterResonance: s.filterResonance,
        drive: s.drive,
        autoPanDepth: s.autoPanDepth,
        autoPanRate: s.autoPanRate,
        echoTime: s.echoTime,
        echoFeedback: s.echoFeedback,
        reverbTone: s.reverbTone,
      },
    };
    const saved = JSON.parse(localStorage.getItem('dj-eq-presets') || '{}');
    const name = prompt('Preset name:', `Custom ${Object.keys(saved).length + 1}`);
    if (name) {
      preset.name = name;
      saved[name] = preset;
      localStorage.setItem('dj-eq-presets', JSON.stringify(saved));
    }
  };

  const themeColors: Record<string, string> = {
    ORIGINAL: 'text-neon-cyan',
    NEON_CYAN: 'text-neon-cyan',
    NEON_MAGENTA: 'text-neon-magenta',
    NEON_GREEN: 'text-neon-green',
    GOLD: 'text-yellow-500',
    RETRO_AMBER: 'text-orange-500',
    ULTRA_VIOLET: 'text-purple-500',
  };

  const textColor = themeColors[theme] || 'text-neon-cyan';

  return (
    <div className="flex items-center justify-between h-12 px-2 sm:px-4 bg-dark-800 border-b border-dark-500/50">
      {/* Left: Title + Tabs */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="flex flex-col">
          <h1 className={`text-xs sm:text-sm font-mono font-bold tracking-wider ${textColor} neon-text leading-tight`}>
            MODERN AUDIO ENHANCER
          </h1>
          <div className="hidden sm:flex items-center gap-2 text-[8px] font-mono text-gray-500 uppercase tracking-[0.2em]">
            <span>High-Performance DSP System</span>
            <span className="text-gray-600">•</span>
            <span className={`${textColor}/80`}>v2.0.0-PRO</span>
          </div>
        </div>
        <div className="flex">
          {(['EQ', 'ENHANCER', 'FX', 'VISUALIZER', 'PRESETS'] as TabType[]).map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? 'tab-active' : 'tab-active-muted'}
              onClick={() => { setActiveTab(tab); onTabChange?.(tab); }}
            >
              {tab}
            </button>
          ))}
          <span className="w-px h-4 bg-dark-500/50 self-center mx-1" />
          {(['MANUAL', 'FFT', 'SETTINGS'] as TabType[]).map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? 'tab-active' : 'tab-active-muted'}
              onClick={() => { setActiveTab(tab); onTabChange?.(tab); }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Center: Snap + Presets */}
      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        <button
          className={snapEnabled ? 'btn-neon-active' : 'btn-neon'}
          onClick={() => setSnapEnabled(!snapEnabled)}
        >
          SNAP {snapEnabled ? 'ON' : 'OFF'}
        </button>

        <div className="relative" ref={presetRef}>
          <button
            className="btn-neon flex items-center gap-1 min-w-[120px]"
            onClick={() => setPresetOpen(!presetOpen)}
          >
            <span className="hidden sm:inline">PRESET: </span>{selectedPreset}
            <span className="text-[10px] ml-auto">▼</span>
          </button>
          {presetOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 max-h-64 overflow-y-auto bg-dark-700 border border-dark-500 rounded shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-[9999]">
              {/* DSP Presets */}
              {Object.keys(DSP_PRESETS).map((name) => (
                <button
                  key={name}
                  className="w-full text-left px-3 py-2 text-xs font-mono text-gray-200 hover:bg-neon-cyan/20 hover:text-white transition-colors border-b border-dark-500/30"
                  onClick={() => handlePreset(name)}
                >
                  <span className="text-neon-cyan/60">★</span> {name}
                </button>
              ))}
              {/* EQ-only presets */}
              {Object.keys(EQ_PRESETS).filter(n => !DSP_PRESETS[n]).map((name) => (
                <button
                  key={name}
                  className="w-full text-left px-3 py-2 text-xs font-mono text-gray-200 hover:bg-neon-cyan/20 hover:text-white transition-colors border-b border-dark-500/30 last:border-0"
                  onClick={() => handlePreset(name)}
                >
                  {name}
                </button>
              ))}
              {/* Custom saved presets */}
              {(() => {
                try {
                  const custom = JSON.parse(localStorage.getItem('dj-eq-presets') || '{}');
                  return Object.keys(custom).map((name) => (
                    <button
                      key={name}
                      className="w-full text-left px-3 py-2 text-xs font-mono text-gray-200 hover:bg-neon-magenta/20 hover:text-white transition-colors border-b border-dark-500/30 last:border-0"
                      onClick={() => {
                        const p = custom[name];
                        if (p.eq && p.compressor) {
                          applyDSPPreset(p as DSPPreset);
                        } else if (p.length) {
                          setEqValues(p);
                        }
                        setSelectedPreset(name);
                        setPresetOpen(false);
                      }}
                    >
                      <span className="text-neon-magenta/60">♥</span> {name}
                    </button>
                  ));
                } catch { return null; }
              })()}
            </div>
          )}
        </div>

        <button className="btn-neon hidden sm:inline-flex" onClick={handleSave}>
          SAVE
        </button>

        <button className="btn-neon" onClick={resetEq}>
          RESET
        </button>
      </div>

      {/* Right: Meters + Metrics + Status */}
      <div className="hidden sm:flex flex-col items-end gap-0.5 text-[10px] font-mono text-gray-400 shrink-0 leading-tight">
        <div className="flex items-center gap-2 sm:gap-3">
          <span>RMS: <span className={meters.rmsDb > -6 ? 'text-red-400' : 'text-neon-green'}>{meters.rmsDb.toFixed(1)}dB</span></span>
          <span>LUFS: <span className="text-neon-yellow">{meters.lufs.toFixed(1)}</span></span>
          <span>GR: <span className="text-neon-purple">{meters.gainReduction.toFixed(1)}dB</span></span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span>LAT: <span className="text-neon-green">{latency.toFixed(1)}ms</span></span>
          <span>BUF: <span className="text-neon-cyan">{bufferSize}</span></span>
          <span className="flex items-center gap-1">
            DAC:
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${dacActive ? 'bg-neon-green shadow-neon-green' : 'bg-gray-600'}`} />
            <span className={dacActive ? 'text-neon-green' : 'text-gray-500'}>{dacActive ? 'ON' : 'OFF'}</span>
          </span>
          <span className="text-gray-600">v3.0</span>
        </div>
      </div>
    </div>
  );
};
