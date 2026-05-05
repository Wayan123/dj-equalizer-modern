export type RenderCallback = (timestamp: number) => void;

export class RenderLoop {
  private rafId: number | null = null;
  private callback: RenderCallback | null = null;
  private running = false;
  private lastTime = 0;
  private frameCount = 0;
  private fps = 0;
  private fpsUpdateTime = 0;

  get currentFps(): number {
    return this.fps;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(callback: RenderCallback): void {
    this.callback = callback;
    this.running = true;
    this.lastTime = performance.now();
    this.fpsUpdateTime = this.lastTime;
    this.frameCount = 0;
    this.loop(this.lastTime);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private loop = (timestamp: number): void => {
    if (!this.running) return;

    // FPS calculation
    this.frameCount++;
    const elapsed = timestamp - this.fpsUpdateTime;
    if (elapsed >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.fpsUpdateTime = timestamp;
    }

    this.callback?.(timestamp);
    this.rafId = requestAnimationFrame(this.loop);
  };
}
