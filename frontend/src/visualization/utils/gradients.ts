import { NEON_COLORS } from '../../utils/constants';

export function frequencyReactiveColor(value: number, max: number = 255): string {
  const ratio = value / max;
  if (ratio < 0.33) {
    return lerpColor(NEON_COLORS.cyan, NEON_COLORS.green, ratio / 0.33);
  } else if (ratio < 0.66) {
    return lerpColor(NEON_COLORS.green, NEON_COLORS.yellow, (ratio - 0.33) / 0.33);
  } else {
    return lerpColor(NEON_COLORS.yellow, NEON_COLORS.magenta, (ratio - 0.66) / 0.34);
  }
}

export function lerpColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

export function createBarGradient(ctx: CanvasRenderingContext2D, x: number, y: number, height: number): CanvasGradient {
  const grad = ctx.createLinearGradient(x, y + height, x, y);
  grad.addColorStop(0, '#00f0ff');
  grad.addColorStop(0.3, '#00ff88');
  grad.addColorStop(0.6, '#fbbf24');
  grad.addColorStop(0.85, '#ff00ff');
  grad.addColorStop(1, '#ec4899');
  return grad;
}

export function createRadialGradient(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): CanvasGradient {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(0, 240, 255, 0.8)');
  grad.addColorStop(0.5, 'rgba(139, 92, 246, 0.4)');
  grad.addColorStop(1, 'rgba(255, 0, 255, 0.1)');
  return grad;
}
