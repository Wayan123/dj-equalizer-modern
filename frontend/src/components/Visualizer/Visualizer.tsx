import React, { useRef, useEffect, useCallback } from 'react';
import { useAudioStore } from '../../store/audioStore';
import { VIZ_MODES } from '../../utils/constants';
import { audioEngine } from '../../audio/AudioEngine';
import { RenderLoop } from '../../visualization/RenderLoop';
import { renderFFT } from '../../visualization/modes/FFTMode';
import { renderWave } from '../../visualization/modes/WaveMode';
import { renderRadial } from '../../visualization/modes/RadialMode';
import { renderParticle } from '../../visualization/modes/ParticleMode';
import { renderStereo } from '../../visualization/modes/StereoMode';
import { renderSpectro } from '../../visualization/modes/SpectroMode';
import { renderVU } from '../../visualization/modes/VUMode';

const renderLoop = new RenderLoop();

export const Visualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { vizMode, setVizMode, trackStatus, theme, vizVariant } = useAudioStore();
  const fpsRef = useRef<number>(0);

  const render = useCallback(
    (_timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      fpsRef.current = renderLoop.currentFps;

      if (!audioEngine.isInitialized || trackStatus === 'idle') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const dpr = window.devicePixelRatio || 1;
        const logicalWidth = canvas.width / dpr;
        const logicalHeight = canvas.height / dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.font = '16px JetBrains Mono';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LOAD AUDIO TO ACTIVATE', logicalWidth / 2, logicalHeight / 2);
        return;
      }

      const frequencyData = audioEngine.getFrequencyData();
      const timeDomainData = audioEngine.getTimeDomainData();

      // Use logical dimensions (CSS pixels) for drawing
      const logicalWidth = canvas.width / (window.devicePixelRatio || 1);
      const logicalHeight = canvas.height / (window.devicePixelRatio || 1);

      // Re-apply transform in case it was reset by clearRect or other operations
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      switch (vizMode) {
        case 'FFT':
          renderFFT(ctx, frequencyData, logicalWidth, logicalHeight, theme, vizVariant);
          break;
        case 'WAVE':
          renderWave(ctx, timeDomainData, logicalWidth, logicalHeight, theme, vizVariant);
          break;
        case 'RADIAL':
          renderRadial(ctx, frequencyData, logicalWidth, logicalHeight, theme, vizVariant);
          break;
        case 'PARTICLE':
          renderParticle(ctx, frequencyData, logicalWidth, logicalHeight, theme, vizVariant);
          break;
        case 'STEREO':
          renderStereo(ctx, frequencyData, logicalWidth, logicalHeight, theme, vizVariant);
          break;
        case 'SPECTRO':
          renderSpectro(ctx, frequencyData, logicalWidth, logicalHeight, theme, vizVariant);
          break;
        case 'VU':
          renderVU(ctx, frequencyData, timeDomainData, logicalWidth, logicalHeight, theme, vizVariant);
          break;
      }

      // FPS overlay
      ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.font = '10px JetBrains Mono';
      ctx.textAlign = 'left';
      ctx.fillText(`FPS: ${fpsRef.current}`, 8, 14);
    },
    [vizMode, trackStatus, theme, vizVariant],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        
        // Physical pixels for the internal buffer
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        
        // CSS pixels for the display size
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Reset transform and apply scaling
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }
    });
    resizeObserver.observe(container);

    renderLoop.start(render);

    return () => {
      resizeObserver.disconnect();
      renderLoop.stop();
    };
  }, [render]);

  return (
    <div className="flex flex-col h-full">
      {/* Mode selector */}
      <div className="flex items-center gap-1 px-1 py-1 bg-dark-800/50 border-b border-dark-500/30">
        {VIZ_MODES.map((mode) => (
          <button
            key={mode}
            className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all ${
              vizMode === mode
                ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
            onClick={() => setVizMode(mode)}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-black/20">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      </div>
    </div>
  );
};
