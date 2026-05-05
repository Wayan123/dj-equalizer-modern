import { ThemeType, VizVariant } from '../../store/audioStore';
import { applyGlow, clearGlow } from '../utils/glow';
import { frequencyReactiveColor, createBarGradient } from '../utils/gradients';

const THEME_COLORS: Record<ThemeType, string> = {
  ORIGINAL: '#00f0ff',
  NEON_CYAN: '#00f0ff',
  NEON_MAGENTA: '#ff00ff',
  NEON_GREEN: '#00ff88',
  GOLD: '#fbbf24',
  RETRO_AMBER: '#f97316',
  ULTRA_VIOLET: '#8b5cf6',
};

export function renderFFT(
  ctx: CanvasRenderingContext2D,
  frequencyData: Uint8Array,
  width: number,
  height: number,
  theme: ThemeType,
  variant: VizVariant
): void {
  const barCount = variant === 'DENSE' ? 128 : 64;
  const binStep = Math.floor(frequencyData.length / barCount);
  const color = THEME_COLORS[theme];
  const isOriginal = theme === 'ORIGINAL';
  
  ctx.clearRect(0, 0, width, height);

  for (let i = 0; i < barCount; i++) {
    let sum = 0;
    for (let j = 0; j < binStep; j++) {
      sum += frequencyData[i * binStep + j] || 0;
    }
    const value = sum / binStep;
    const barHeight = (value / 255) * height * 0.9;

    const barWidth = (width / barCount) * (variant === 'DENSE' ? 0.9 : 0.7);
    const gap = (width / barCount) * (variant === 'DENSE' ? 0.1 : 0.3);
    const x = i * (barWidth + gap) + gap / 2;
    const y = height - barHeight;

    if (variant === 'GLOW_ONLY') {
      const glowColor = isOriginal ? frequencyReactiveColor(value) : color;
      applyGlow(ctx, glowColor, 15);
      ctx.fillStyle = isOriginal ? `${frequencyReactiveColor(value)}44` : `${color}44`;
      ctx.fillRect(x, y, barWidth, barHeight);
      clearGlow(ctx);
      continue;
    }

    if (variant === 'OUTLINE') {
      ctx.strokeStyle = isOriginal ? frequencyReactiveColor(value) : color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barWidth, barHeight);
    } else {
      let grad: CanvasGradient;
      if (isOriginal) {
        grad = createBarGradient(ctx, x, y, barHeight);
      } else {
        grad = ctx.createLinearGradient(x, y, x, height);
        grad.addColorStop(0, color);
        grad.addColorStop(1, `${color}22`);
      }
      ctx.fillStyle = grad;
      
      if (variant !== 'DENSE') {
        applyGlow(ctx, isOriginal ? frequencyReactiveColor(value) : color, 8);
      }
      ctx.fillRect(x, y, barWidth, barHeight);
      if (variant !== 'DENSE') {
        clearGlow(ctx);
      }
    }

    // Reflection (only for DEFAULT/FILLED, drawn above the baseline)
    if (variant === 'DEFAULT' || variant === 'FILLED') {
      const reflColor = isOriginal ? frequencyReactiveColor(value) : color;
      ctx.fillStyle = `${reflColor}22`;
      ctx.fillRect(x, height - barHeight * 0.2, barWidth, barHeight * 0.2);
    }
  }
}
