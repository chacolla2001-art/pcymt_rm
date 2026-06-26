import type { AmbientTickOptions } from './map-ambient-zone';
import { parkPlanSize, parkParticleTarget } from './map-park-visual-scale';
import { ambientScreenScale } from './map-ambient-zone';
import { ambientWindVector, DEFAULT_AMBIENT_WIND } from './map-ambient-wind';

interface FogPatch {
  bx: number;
  by: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

export class MapFogEffect {
  private patches: FogPatch[] = [];
  private intensity = 0.35;
  private sizeMul = 1;
  private containsPoint: ((bx: number, by: number) => boolean) | null = null;

  setIntensity(value: number): void {
    this.intensity = Math.min(1, Math.max(0, value));
  }

  setSizeMul(value: number): void {
    this.sizeMul = Math.min(2.5, Math.max(0.08, value));
  }

  setContainsPoint(fn: ((bx: number, by: number) => boolean) | null): void {
    this.containsPoint = fn;
  }

  clear(): void {
    this.patches = [];
  }

  private inZone(bx: number, by: number): boolean {
    return !this.containsPoint || this.containsPoint(bx, by);
  }

  private spawn(bounds: AmbientTickOptions['bounds'], wind = DEFAULT_AMBIENT_WIND): FogPatch {
    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;
    let bx = bounds.minX + Math.random() * spanX;
    let by = bounds.minY + Math.random() * spanY;
    for (let t = 0; t < 20; t++) {
      bx = bounds.minX + Math.random() * spanX;
      by = bounds.minY + Math.random() * spanY;
      if (this.inZone(bx, by)) break;
    }
    const wv = ambientWindVector(wind);
    return {
      bx,
      by,
      vx: wv.vx * 0.35 + (Math.random() - 0.5) * 0.12,
      vy: wv.vy * 0.28 + (Math.random() - 0.5) * 0.1,
      r: parkPlanSize(18 + Math.random() * 32),
      phase: Math.random() * Math.PI * 2,
    };
  }

  tick(options: AmbientTickOptions, dt = 1): void {
    if (options.containsPoint) this.containsPoint = options.containsPoint;
    const wind = options.wind ?? DEFAULT_AMBIENT_WIND;
    const wv = ambientWindVector(wind);
    const bounds = options.bounds;
    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;
    if (spanX <= 0 || spanY <= 0) return;

    const inten = Math.max(0.15, this.intensity);
    const target = parkParticleTarget(3, 9, inten);

    while (this.patches.length < target) this.patches.push(this.spawn(bounds, wind));
    while (this.patches.length > target) this.patches.pop();

    for (const p of this.patches) {
      p.phase += 0.012 * dt;
      p.vx += (wv.vx * 0.35 - p.vx) * 0.03 * dt;
      p.vy += (wv.vy * 0.28 - p.vy) * 0.03 * dt;
      p.bx += p.vx * dt + Math.sin(p.phase) * 0.08 * dt;
      p.by += p.vy * dt + Math.cos(p.phase * 0.8) * 0.05 * dt;
      if (!this.inZone(p.bx, p.by) || p.bx < bounds.minX - 20 || p.bx > bounds.maxX + 20) {
        const n = this.spawn(bounds, wind);
        Object.assign(p, n);
      }
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    clipPath: Path2D | null,
    toScreen: (bx: number, by: number) => { x: number; y: number },
    screenScale = 1,
  ): void {
    const inten = Math.max(0.2, this.intensity);
    const sr = ambientScreenScale(screenScale, this.sizeMul);
    ctx.save();
    if (clipPath) ctx.clip(clipPath);

    for (const p of this.patches) {
      if (!this.inZone(p.bx, p.by)) continue;
      const { x, y } = toScreen(p.bx, p.by);
      const pulse = 0.82 + Math.sin(p.phase) * 0.18;
      const radius = p.r * sr * pulse;
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, `rgba(235, 245, 255, ${inten * 0.22})`);
      g.addColorStop(0.45, `rgba(200, 220, 240, ${inten * 0.12})`);
      g.addColorStop(1, 'rgba(200, 220, 240, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
