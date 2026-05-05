import { ThemeType, VizVariant } from '../../store/audioStore';
import { applyGlow, clearGlow } from '../utils/glow';
import { frequencyReactiveColor, createRadialGradient } from '../utils/gradients';

const THEME_COLORS: Record<ThemeType, string> = {
  ORIGINAL: '#00f0ff',
  NEON_CYAN: '#00f0ff',
  NEON_MAGENTA: '#ff00ff',
  NEON_GREEN: '#00ff88',
  GOLD: '#fbbf24',
  RETRO_AMBER: '#f97316',
  ULTRA_VIOLET: '#8b5cf6',
};

export function renderRadial(
  ctx: CanvasRenderingContext2D,
  frequencyData: Uint8Array,
  width: number,
  height: number,
  theme: ThemeType,
  variant: VizVariant
): void {
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const color = THEME_COLORS[theme];
  const isOriginal = theme === 'ORIGINAL';
  const innerRadius = Math.min(width, height) * 0.15;
  const maxBarLength = Math.min(width, height) * 0.3;
  const barCount = variant === 'DENSE' ? 256 : 128;
  const binStep = Math.floor(frequencyData.length / barCount);

  // Inner circle - use radial gradient for ORIGINAL
  if (isOriginal) {
    const radGrad = createRadialGradient(ctx, cx, cy, innerRadius);
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  if (variant !== 'OUTLINE') {
    applyGlow(ctx, color, 20);
  }
  ctx.strokeStyle = `${color}44`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
  ctx.stroke();
  if (variant !== 'OUTLINE') {
    clearGlow(ctx);
  }

  // Radial bars
  for (let i = 0; i < barCount; i++) {
    const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
    let sum = 0;
    for (let j = 0; j < binStep; j++) {
      sum += frequencyData[i * binStep + j] || 0;
    }
    const value = sum / binStep;
    const barLength = (value / 255) * maxBarLength;
    const barColor = isOriginal ? frequencyReactiveColor(value) : color;

    const x1 = cx + Math.cos(angle) * innerRadius;
    const y1 = cy + Math.sin(angle) * innerRadius;
    const x2 = cx + Math.cos(angle) * (innerRadius + barLength);
    const y2 = cy + Math.sin(angle) * (innerRadius + barLength);

    if (variant === 'OUTLINE') {
      ctx.strokeStyle = barColor;
      ctx.lineWidth = 1;
    } else {
      applyGlow(ctx, barColor, variant === 'DENSE' ? 4 : 6);
      ctx.strokeStyle = barColor;
      ctx.lineWidth = variant === 'DENSE' ? 1 : 2;
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    if (variant !== 'OUTLINE') {
      clearGlow(ctx);
    }
  }

  // Center text
  ctx.fillStyle = isOriginal ? '#00f0ff' : color;
  ctx.font = '10px JetBrains Mono';
  ctx.textAlign = 'center';
  ctx.fillText('RADIAL', cx, cy + 4);
}
