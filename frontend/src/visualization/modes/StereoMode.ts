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

export function renderStereo(
  ctx: CanvasRenderingContext2D,
  frequencyData: Uint8Array,
  width: number,
  height: number,
  theme: ThemeType,
  variant: VizVariant
): void {
  ctx.clearRect(0, 0, width, height);

  const midX = width / 2;
  const barCount = variant === 'DENSE' ? 96 : 48;
  const binStep = Math.floor(frequencyData.length / barCount);
  const color = THEME_COLORS[theme];
  const isOriginal = theme === 'ORIGINAL';
  const barWidth = (height / barCount) * 0.6;
  const gap = (height / barCount) * 0.4;
  const maxBarLength = midX * 0.8;

  // Center line
  ctx.strokeStyle = `${color}22`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(midX, 0);
  ctx.lineTo(midX, height);
  ctx.stroke();

  for (let i = 0; i < barCount; i++) {
    let sum = 0;
    for (let j = 0; j < binStep; j++) {
      sum += frequencyData[i * binStep + j] || 0;
    }
    const value = sum / binStep;
    const barLength = (value / 255) * maxBarLength;
    const y = i * (barWidth + gap) + gap;
    const barColor = isOriginal ? frequencyReactiveColor(value) : color;

    // Left channel
    const leftGrad = ctx.createLinearGradient(midX, y, midX - barLength, y);
    leftGrad.addColorStop(0, barColor);
    leftGrad.addColorStop(1, `${barColor}44`);
    
    if (variant !== 'OUTLINE') {
      applyGlow(ctx, barColor, 5);
    }
    ctx.fillStyle = variant === 'OUTLINE' ? 'transparent' : leftGrad;
    if (variant === 'OUTLINE') {
      ctx.strokeStyle = barColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(midX - barLength, y, barLength, barWidth);
    } else {
      ctx.fillRect(midX - barLength, y, barLength, barWidth);
    }
    if (variant !== 'OUTLINE') {
      clearGlow(ctx);
    }

    // Right channel
    const rightGrad = ctx.createLinearGradient(midX, y, midX + barLength, y);
    rightGrad.addColorStop(0, barColor);
    rightGrad.addColorStop(1, `${barColor}44`);
    
    if (variant !== 'OUTLINE') {
      applyGlow(ctx, barColor, 5);
    }
    ctx.fillStyle = variant === 'OUTLINE' ? 'transparent' : rightGrad;
    if (variant === 'OUTLINE') {
      ctx.strokeStyle = barColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(midX, y, barLength, barWidth);
    } else {
      ctx.fillRect(midX, y, barLength, barWidth);
    }
    if (variant !== 'OUTLINE') {
      clearGlow(ctx);
    }
  }

  // Labels
  ctx.fillStyle = isOriginal ? '#00f0ff' : color;
  ctx.font = '10px JetBrains Mono';
  ctx.textAlign = 'right';
  ctx.fillText('L', midX - 10, 15);
  ctx.textAlign = 'left';
  ctx.fillText('R', midX + 10, 15);
}
