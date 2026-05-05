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

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

let particles: Particle[] = [];

export function renderParticle(
  ctx: CanvasRenderingContext2D,
  frequencyData: Uint8Array,
  width: number,
  height: number,
  theme: ThemeType,
  variant: VizVariant
): void {
  ctx.clearRect(0, 0, width, height);

  const color = THEME_COLORS[theme];
  const isOriginal = theme === 'ORIGINAL';
  const maxParticles = variant === 'DENSE' ? 600 : 300;

  // Calculate average energy
  let totalEnergy = 0;
  for (let i = 0; i < frequencyData.length; i++) {
    totalEnergy += frequencyData[i];
  }
  const avgEnergy = totalEnergy / frequencyData.length;
  const energyRatio = avgEnergy / 255;

  // Spawn new particles
  const spawnCount = Math.floor(energyRatio * (variant === 'DENSE' ? 15 : 8));
  for (let i = 0; i < spawnCount && particles.length < maxParticles; i++) {
    const freqBin = Math.floor(Math.random() * frequencyData.length);
    const value = frequencyData[freqBin] || 0;
    if (value > 30) {
      particles.push({
        x: width / 2 + (Math.random() - 0.5) * width * 0.6,
        y: height / 2 + (Math.random() - 0.5) * height * 0.6,
        vx: (Math.random() - 0.5) * 3 * energyRatio,
        vy: (Math.random() - 0.5) * 3 * energyRatio - 1,
        life: 1,
        maxLife: 0.5 + Math.random() * 1.5,
        size: 1 + (value / 255) * 4,
        color: isOriginal ? frequencyReactiveColor(value) : color,
      });
    }
  }

  // Update and render
  const dt = 1 / 60;
  particles = particles.filter((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy -= 0.02;
    p.life -= dt / p.maxLife;

    if (p.life <= 0) return false;

    const alpha = p.life;
    const pColor = `${p.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;

    if (variant !== 'OUTLINE') {
      applyGlow(ctx, p.color, p.size * (variant === 'GLOW_ONLY' ? 5 : 3));
    }
    
    ctx.fillStyle = pColor;
    if (variant === 'OUTLINE') {
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x, p.y, p.size * alpha, p.size * alpha);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    
    if (variant !== 'OUTLINE') {
      clearGlow(ctx);
    }

    return true;
  });

  // Center indicator
  if (variant !== 'OUTLINE') {
    applyGlow(ctx, color, 15);
  }
  ctx.strokeStyle = `${color}${Math.floor(energyRatio * 128).toString(16).padStart(2, '0')}`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 30 + energyRatio * 20, 0, Math.PI * 2);
  ctx.stroke();
  if (variant !== 'OUTLINE') {
    clearGlow(ctx);
  }
}

export function resetParticles(): void {
  particles = [];
}
