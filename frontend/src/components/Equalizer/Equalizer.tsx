import React, { useCallback } from 'react';
import { useAudioStore } from '../../store/audioStore';
import { EQ_LABELS, EQ_MIN_DB, EQ_MAX_DB } from '../../utils/constants';
import { audioEngine } from '../../audio/AudioEngine';

export const Equalizer: React.FC = () => {
  const { eqValues, setEqBand, snapEnabled } = useAudioStore();

  const handleChange = useCallback(
    (index: number, value: number) => {
      let db = value;
      if (snapEnabled) {
        db = Math.round(value / 2) * 2;
      }
      setEqBand(index, db);
      audioEngine.setEqBand(index, db);
    },
    [setEqBand, snapEnabled],
  );

  const handleDoubleClick = useCallback(
    (index: number) => {
      setEqBand(index, 0);
      audioEngine.setEqBand(index, 0);
    },
    [setEqBand],
  );

  return (
    <div className="flex items-end justify-center gap-1.5 px-2 py-2 panel-glow h-full min-h-0">
      {EQ_LABELS.map((label, i) => {
        const db = eqValues[i];
        const pct = ((db - EQ_MIN_DB) / (EQ_MAX_DB - EQ_MIN_DB)) * 100;
        const isPositive = db > 0;
        const isNegative = db < 0;

        return (
          <div key={label} className="flex flex-col items-center gap-1 w-12">
            {/* dB value */}
            <span
              className={`text-[9px] font-mono ${
                isPositive ? 'text-neon-green' : isNegative ? 'text-neon-magenta' : 'text-gray-500'
              }`}
            >
              {db > 0 ? '+' : ''}{db}
            </span>

            {/* Vertical slider */}
            <div
              className="relative w-3 h-32 bg-dark-600 rounded-full cursor-pointer group"
              onPointerDown={(e) => {
                const slider = e.currentTarget;
                slider.setPointerCapture(e.pointerId);

                const handleMove = (moveEvent: PointerEvent) => {
                  const rect = slider.getBoundingClientRect();
                  const y = moveEvent.clientY - rect.top;
                  const ratio = 1 - Math.max(0, Math.min(1, y / rect.height));
                  const newDb = EQ_MIN_DB + ratio * (EQ_MAX_DB - EQ_MIN_DB);
                  handleChange(i, newDb);
                };

                const handleUp = () => {
                  slider.releasePointerCapture(e.pointerId);
                  slider.removeEventListener('pointermove', handleMove);
                  slider.removeEventListener('pointerup', handleUp);
                };

                slider.addEventListener('pointermove', handleMove);
                slider.addEventListener('pointerup', handleUp);
                handleMove(e.nativeEvent);
              }}
              onDoubleClick={() => handleDoubleClick(i)}
            >
              {/* Center line (0 dB) */}
              <div className="absolute left-0 right-0 top-1/2 h-px bg-gray-600" />

              {/* Fill bar */}
              <div
                className="absolute left-0 right-0 rounded-full bg-gradient-to-t from-neon-cyan to-neon-magenta transition-all duration-75"
                style={{
                  bottom: db >= 0 ? '50%' : `${pct}%`,
                  height: db >= 0 ? `${(pct - 50)}%` : `${50 - pct}%`,
                }}
              />

              {/* Thumb */}
              <div
                className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-neon-cyan shadow-neon border border-neon-cyan/50 transition-all duration-75"
                style={{ bottom: `calc(${pct}% - 8px)` }}
              />
            </div>

            {/* Frequency label */}
            <span className="text-[9px] font-mono text-gray-400">{label}</span>
          </div>
        );
      })}
    </div>
  );
};
