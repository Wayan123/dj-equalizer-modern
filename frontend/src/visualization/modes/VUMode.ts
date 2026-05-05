import { ThemeType, VizVariant } from '../../store/audioStore';
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

const BAND_COUNT = 48;
const smoothLevels = new Float32Array(BAND_COUNT);
const peakLevels = new Float32Array(BAND_COUNT);
const peakDecay = new Float32Array(BAND_COUNT);

export function renderVU(
  ctx: CanvasRenderingContext2D,
  frequencyData: Uint8Array,
  _timeDomainData: Uint8Array,
  width: number,
  height: number,
  theme: ThemeType,
  variant: VizVariant
): void {
  ctx.clearRect(0, 0, width, height);

  const color = THEME_COLORS[theme];
  const isOriginal = theme === 'ORIGINAL';
  const binCount = frequencyData.length;
  const binsPerBand = Math.floor(binCount / BAND_COUNT);
  const decay = 0.88;

  for (let b = 0; b < BAND_COUNT; b++) {
    let sum = 0;
    const start = b * binsPerBand;
    for (let i = start; i < start + binsPerBand && i < binCount; i++) {
      sum += frequencyData[i];
    }
    const level = sum / binsPerBand / 255;
    smoothLevels[b] = Math.max(level, smoothLevels[b] * decay);

    if (level > peakLevels[b]) {
      peakLevels[b] = level;
      peakDecay[b] = 30;
    } else if (peakDecay[b] > 0) {
      peakDecay[b]--;
    } else {
      peakLevels[b] *= 0.96;
    }
  }

  const cols = variant === 'DENSE' ? 48 : 24;
  const rows = variant === 'DENSE' ? 1 : 2;
  const gap = 1;
  const topPad = 4;
  const leftPad = 16;
  const rightPad = 24;
  const availW = width - leftPad - rightPad - gap * (cols + 1);
  const barW = Math.max(1, availW / cols);
  const rowGap = variant === 'DENSE' ? 0 : 6;
  const availH = height - topPad - rowGap;
  const barH = rows === 1 ? availH : Math.max(10, availH / rows);

  for (let row = 0; row < rows; row++) {
    const rowY = topPad + row * (barH + rowGap);
    
    if (rows > 1) {
      ctx.fillStyle = isOriginal ? '#00f0ff' : color;
      ctx.font = `bold 8px JetBrains Mono`;
      ctx.textAlign = 'center';
      ctx.fillText(row === 0 ? 'L' : 'R', leftPad / 2, rowY + barH / 2);
    }

    for (let col = 0; col < cols; col++) {
      const bandIdx = row * cols + col;
      if (bandIdx >= BAND_COUNT) break;

      const x = leftPad + gap + col * (barW + gap);
      const level = smoothLevels[bandIdx];
      const peak = peakLevels[bandIdx];
      const filledH = level * barH;
      const barColor = isOriginal ? frequencyReactiveColor(level * 255) : color;

      ctx.fillStyle = 'rgba(15, 15, 25, 0.7)';
      ctx.fillRect(x, rowY, barW, barH);

      let drawColor = barColor;
      if (variant !== 'OUTLINE' && level > 0.8) drawColor = '#ef4444';
      
      if (variant === 'OUTLINE') {
        ctx.strokeStyle = barColor;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, rowY + barH - filledH, barW, filledH);
      } else {
        ctx.fillStyle = drawColor;
        ctx.fillRect(x, rowY + barH - filledH, barW, filledH);
      }

      if (variant !== 'GLOW_ONLY') {
        const peakY = rowY + barH - peak * barH;
        ctx.fillStyle = peak > 0.85 ? '#ef4444' : `${barColor}aa`;
        ctx.fillRect(x, peakY, barW, 1);
      }
    }
  }
}
