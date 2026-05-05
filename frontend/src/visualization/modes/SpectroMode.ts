import { ThemeType, VizVariant } from '../../store/audioStore';

const THEME_COLORS: Record<ThemeType, string> = {
  ORIGINAL: '#00f0ff',
  NEON_CYAN: '#00f0ff',
  NEON_MAGENTA: '#ff00ff',
  NEON_GREEN: '#00ff88',
  GOLD: '#fbbf24',
  RETRO_AMBER: '#f97316',
  ULTRA_VIOLET: '#8b5cf6',
};

let offscreen: HTMLCanvasElement | null = null;
let offCtx: CanvasRenderingContext2D | null = null;
let bufWidth = 0;
let bufHeight = 0;
let lastTheme: ThemeType | null = null;

const COLOR_LUT: Uint8Array = new Uint8Array(256 * 3);

function updateLUT(color: string, isOriginal: boolean) {
  if (isOriginal) {
    // Multi-color LUT: cyan → green → yellow → magenta based on intensity
    const stops = [
      { r: 0, g: 240, b: 255 },   // cyan (#00f0ff)
      { r: 0, g: 255, b: 136 },   // green (#00ff88)
      { r: 251, g: 191, b: 36 },  // yellow (#fbbf24)
      { r: 255, g: 0, b: 255 },   // magenta (#ff00ff)
    ];
    for (let v = 0; v < 256; v++) {
      const t = v / 255;
      const seg = t * (stops.length - 1);
      const idx = Math.min(Math.floor(seg), stops.length - 2);
      const local = seg - idx;
      const a = stops[idx], b = stops[idx + 1];
      COLOR_LUT[v * 3] = Math.floor(a.r + (b.r - a.r) * local);
      COLOR_LUT[v * 3 + 1] = Math.floor(a.g + (b.g - a.g) * local);
      COLOR_LUT[v * 3 + 2] = Math.floor(a.b + (b.b - a.b) * local);
    }
  } else {
    // Simple LUT generation based on base color and brightness
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    for (let v = 0; v < 256; v++) {
      const factor = v / 255;
      COLOR_LUT[v * 3] = Math.floor(r * factor);
      COLOR_LUT[v * 3 + 1] = Math.floor(g * factor);
      COLOR_LUT[v * 3 + 2] = Math.floor(b * factor);
    }
  }
}

export function renderSpectro(
  ctx: CanvasRenderingContext2D,
  frequencyData: Uint8Array,
  width: number,
  height: number,
  theme: ThemeType,
  variant: VizVariant
): void {
  if (theme !== lastTheme) {
    updateLUT(THEME_COLORS[theme], theme === 'ORIGINAL');
    lastTheme = theme;
    // Reset offscreen canvas so old theme colors don't persist
    if (offscreen && offCtx) {
      offCtx.fillStyle = '#000';
      offCtx.fillRect(0, 0, bufWidth, bufHeight);
    }
  }

  if (!offscreen || bufWidth !== width || bufHeight !== height) {
    offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    offCtx = offscreen.getContext('2d')!;
    bufWidth = width;
    bufHeight = height;
    offCtx.fillStyle = '#000';
    offCtx.fillRect(0, 0, width, height);
  }

  const scrollAmount = variant === 'DENSE' ? 1 : 2;
  offCtx!.drawImage(offscreen!, scrollAmount, 0, width - scrollAmount, height, 0, 0, width - scrollAmount, height);

  const colWidth = scrollAmount;
  const imageData = offCtx!.createImageData(colWidth, height);
  const data = imageData.data;
  const binStep = Math.max(1, Math.floor(frequencyData.length / height));

  for (let y = 0; y < height; y++) {
    const binIndex = Math.min(y * binStep, frequencyData.length - 1);
    const value = frequencyData[binIndex] || 0;
    const lutIdx = value * 3;
    const baseIdx = y * colWidth * 4;
    for (let cx = 0; cx < colWidth; cx++) {
      const idx = baseIdx + cx * 4;
      data[idx] = COLOR_LUT[lutIdx];
      data[idx + 1] = COLOR_LUT[lutIdx + 1];
      data[idx + 2] = COLOR_LUT[lutIdx + 2];
      data[idx + 3] = 255;
    }
  }

  offCtx!.putImageData(imageData, width - colWidth, 0);
  ctx.drawImage(offscreen!, 0, 0);

  // Overlay
  ctx.fillStyle = `${THEME_COLORS[theme]}44`;
  ctx.font = '8px JetBrains Mono';
  ctx.textAlign = 'left';
  const freqLabels = ['50Hz', '200Hz', '1kHz', '5kHz', '20kHz'];
  freqLabels.forEach((label, i) => {
    const yPos = (i / (freqLabels.length - 1)) * height;
    ctx.fillText(label, 4, yPos + 10);
  });
}

export function resetSpectrogram(): void {
  offscreen = null;
  offCtx = null;
  lastTheme = null;
}
