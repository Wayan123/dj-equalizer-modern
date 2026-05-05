import { ThemeType, VizVariant } from '../../store/audioStore';
import { applyGlow, clearGlow } from '../utils/glow';
import { frequencyReactiveColor } from '../utils/gradients';

const THEME_COLORS: Record<ThemeType, string> = {
  ORIGINAL: '#00f0ff',
  NEON_CYAN: '#00f0ff',
  NEON_MAGENTA: '#ff00ff',
  NEON_GREEN: '#00ff88',
  GOLD: '#fbbf24',
  RETRO_AMBER: '#f97316',
  ULTRA_VIOLET: '#8b5cf6',
};

export function renderWave(
  ctx: CanvasRenderingContext2D,
  timeDomainData: Uint8Array,
  width: number,
  height: number,
  theme: ThemeType,
  variant: VizVariant
): void {
  ctx.clearRect(0, 0, width, height);

  const midY = height / 2;
  const sliceWidth = width / timeDomainData.length;
  const color = THEME_COLORS[theme];
  const isOriginal = theme === 'ORIGINAL';

  // Calculate average amplitude for ORIGINAL theme coloring
  let avgAmp = 0;
  if (isOriginal) {
    for (let i = 0; i < timeDomainData.length; i++) {
      avgAmp += Math.abs(timeDomainData[i] - 128);
    }
    avgAmp = avgAmp / timeDomainData.length / 128 * 255;
  }
  const waveColor = isOriginal ? frequencyReactiveColor(avgAmp) : color;

  // Draw center line
  ctx.strokeStyle = `${waveColor}11`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();

  // Waveform
  if (variant === 'OUTLINE') {
    ctx.strokeStyle = waveColor;
    ctx.lineWidth = 1;
  } else {
    applyGlow(ctx, waveColor, variant === 'DENSE' ? 6 : 12);
    ctx.strokeStyle = waveColor;
    ctx.lineWidth = variant === 'DENSE' ? 1 : 2;
  }

  ctx.beginPath();
  for (let i = 0; i < timeDomainData.length; i++) {
    const v = (timeDomainData[i] - 128) / 128;
    const y = midY + v * midY * 0.8;
    if (i === 0) {
      ctx.moveTo(0, y);
    } else {
      ctx.lineTo(i * sliceWidth, y);
    }
  }
  ctx.stroke();
  
  if (variant !== 'OUTLINE') {
    clearGlow(ctx);
  }

  // Variant specific additions
  if (variant === 'FILLED' || variant === 'GLOW_ONLY') {
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fillStyle = variant === 'GLOW_ONLY' ? `${waveColor}11` : `${waveColor}22`;
    ctx.fill();
  }

  // Shadow / Secondary wave (only for default)
  if (variant === 'DEFAULT') {
    applyGlow(ctx, waveColor, 6);
    ctx.strokeStyle = `${waveColor}66`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < timeDomainData.length; i++) {
      const v = (timeDomainData[i] - 128) / 128;
      const y = midY + v * midY * 0.8 + 2;
      if (i === 0) {
        ctx.moveTo(0, y);
      } else {
        ctx.lineTo(i * sliceWidth, y);
      }
    }
    ctx.stroke();
    clearGlow(ctx);
  }
}
