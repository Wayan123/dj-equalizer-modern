import { NEON_COLORS } from '../../utils/constants';

export function applyGlow(
  ctx: CanvasRenderingContext2D,
  color: string = NEON_COLORS.cyan,
  blur: number = 15,
): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

export function clearGlow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

export function drawGlowLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number = 2,
  blur: number = 10,
): void {
  applyGlow(ctx, color, blur);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  clearGlow(ctx);
}

export function drawGlowRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  blur: number = 8,
): void {
  applyGlow(ctx, color, blur);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  clearGlow(ctx);
}
