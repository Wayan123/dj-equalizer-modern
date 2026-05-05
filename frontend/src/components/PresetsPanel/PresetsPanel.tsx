import React, { useCallback, useState, useEffect } from 'react';
import { useAudioStore } from '../../store/audioStore';
import { audioEngine } from '../../audio/AudioEngine';
import { DSP_PRESETS, EQ_PRESETS, DSPPreset } from '../../utils/constants';
import { platform } from '../../platform/platform';

export const PresetsPanel: React.FC = () => {
  const {
    eqValues, inputGain, noiseGate, compressor, limiterCeiling, exciter, stereoWidth,
    bassBoost, reverb, echo, sweep, pan, pitchSpeed, filterMode, filterResonance,
    drive, autoPanDepth, autoPanRate, echoTime, echoFeedback, reverbTone,
    setEqValues, setEnhancer, setCompressorParams, setFxValues,
  } = useAudioStore();

  const [exportMsg, setExportMsg] = useState('');

  const applyDSPPreset = useCallback((preset: DSPPreset) => {
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
  }, [setEqValues, setEnhancer, setCompressorParams, setFxValues]);

  const handleSave = useCallback(async () => {
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
    const allPresets = await platform.presetLoadAll();
    const name = prompt('Preset name:', `Custom ${Object.keys(allPresets).length + 1}`);
    if (name) {
      preset.name = name;
      await platform.presetSave(name, preset);
    }
  }, []);

  const handleExport = useCallback(() => {
    const preset: DSPPreset = {
      name: 'Exported',
      eq: eqValues,
      compressor: { ...compressor },
      limiter: { ceiling: limiterCeiling },
      widener: stereoWidth,
      exciter,
      noiseGate,
      inputGain,
      fx: {
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
      },
    };
    const json = JSON.stringify(preset, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dj-eq-preset.json';
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg('Exported!');
    setTimeout(() => setExportMsg(''), 2000);
  }, [
    eqValues, compressor, limiterCeiling, stereoWidth, exciter, noiseGate, inputGain,
    bassBoost, reverb, echo, sweep, pan, pitchSpeed, filterMode, filterResonance,
    drive, autoPanDepth, autoPanRate, echoTime, echoFeedback, reverbTone,
  ]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const preset = JSON.parse(text) as DSPPreset;
        if (preset.eq && preset.compressor) {
          applyDSPPreset(preset);
          setExportMsg('Imported!');
          setTimeout(() => setExportMsg(''), 2000);
        }
      } catch {
        setExportMsg('Invalid file');
        setTimeout(() => setExportMsg(''), 2000);
      }
    };
    input.click();
  }, [applyDSPPreset]);

  const currentSummary = [
    `EQ: [${eqValues.map(v => v > 0 ? `+${v}` : v).join(', ')}]`,
    `Comp: ${compressor.threshold}dB / ${compressor.ratio}:1`,
    `Limit: ${limiterCeiling}dB`,
    `Width: ${stereoWidth}% | Exciter: ${exciter}%`,
    `Gate: ${noiseGate}% | Input: ${inputGain}%`,
    `FX: ${filterMode.toUpperCase()} ${sweep}% | Echo ${echo}% | Drive ${drive}%`,
  ];

  return (
    <div className="flex flex-col gap-3 p-3 panel-glow overflow-y-auto custom-scrollbar h-full">
      <div className="text-[10px] font-mono text-neon-cyan neon-text tracking-wider">PRESET MANAGER</div>

      {/* DSP Presets */}
      <div>
        <div className="text-[8px] font-mono text-gray-400 mb-1 uppercase">Full DSP Presets</div>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(DSP_PRESETS).map(([name, preset]) => (
            <button
              key={name}
              className="px-2 py-1.5 text-[10px] font-mono text-gray-200 bg-dark-700 border border-dark-500/50 rounded hover:bg-neon-cyan/10 hover:border-neon-cyan/30 transition-colors text-left"
              onClick={() => applyDSPPreset(preset)}
            >
              <span className="text-neon-cyan/60">★</span> {name}
            </button>
          ))}
        </div>
      </div>

      {/* EQ-only Presets */}
      <div>
        <div className="text-[8px] font-mono text-gray-400 mb-1 uppercase">EQ Only Presets</div>
        <div className="grid grid-cols-3 gap-1.5">
          {Object.entries(EQ_PRESETS).filter(([n]) => !DSP_PRESETS[n]).map(([name, eq]) => (
            <button
              key={name}
              className="px-2 py-1.5 text-[10px] font-mono text-gray-200 bg-dark-700 border border-dark-500/50 rounded hover:bg-neon-cyan/10 hover:border-neon-cyan/30 transition-colors"
              onClick={() => { setEqValues(eq); eq.forEach((g, i) => audioEngine.setEqBand(i, g)); }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Presets */}
      <div>
        <div className="text-[8px] font-mono text-gray-400 mb-1 uppercase">Custom Presets</div>
        <CustomPresetList onApply={applyDSPPreset} />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button className="btn-neon flex-1" onClick={handleSave}>SAVE</button>
        <button className="btn-neon flex-1" onClick={handleExport}>EXPORT</button>
        <button className="btn-neon flex-1" onClick={handleImport}>IMPORT</button>
      </div>

      {exportMsg && <div className="text-[9px] font-mono text-neon-green">{exportMsg}</div>}

      {/* Current State Summary */}
      <div>
        <div className="text-[8px] font-mono text-gray-400 mb-1 uppercase">Current Settings</div>
        <div className="flex flex-col gap-0.5">
          {currentSummary.map((line, i) => (
            <span key={i} className="text-[9px] font-mono text-gray-300">{line}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

const CustomPresetList: React.FC<{ onApply: (preset: DSPPreset) => void }> = ({ onApply }) => {
  const [presets, setPresets] = useState<Record<string, DSPPreset>>({});

  useEffect(() => {
    platform.presetLoadAll().then((data) => setPresets(data as Record<string, DSPPreset>)).catch(() => {});
  }, []);

  const handleDelete = async (name: string) => {
    await platform.presetDelete(name);
    const updated = { ...presets };
    delete updated[name];
    setPresets(updated);
  };

  if (Object.keys(presets).length === 0) {
    return <span className="text-[9px] font-mono text-gray-500">No custom presets saved</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {Object.entries(presets).map(([name, preset]) => (
        <div key={name} className="flex items-center gap-1.5">
          <button
            className="flex-1 px-2 py-1 text-[10px] font-mono text-gray-200 bg-dark-700 border border-dark-500/50 rounded hover:bg-neon-magenta/10 hover:border-neon-magenta/30 transition-colors text-left"
            onClick={() => onApply(preset)}
          >
            <span className="text-neon-magenta/60">♥</span> {name}
          </button>
          <button
            className="px-1.5 py-1 text-[9px] font-mono text-red-400 hover:text-red-300 bg-dark-700 border border-dark-500/50 rounded transition-colors"
            onClick={() => handleDelete(name)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};
