import type { AmbientTickOptions } from './map-ambient-zone';
import { parkPlanSize, parkParticleTarget } from './map-park-visual-scale';
import { ambientScreenScale } from './map-ambient-zone';
import { ambientWindVector, DEFAULT_AMBIENT_WIND } from './map-ambient-wind';

interface ShadowBlob {
  bx: number;
  by: number;
  r: number;
  layer: 0 | 1;
  phase: number;
}

/** Sombras de nubes lentas con parallax (capa lejana vs cercana). */
export class MapCloudShadowEffect {
  private blobs: ShadowBlob[] = [];
  private intensity = 0.4;
  private sizeMul = 1;
  private containsPoint: ((bx: number, by: number) => boolean) | null = null;
  private driftPhase = 0;

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
    this.blobs = [];
    this.driftPhase = 0;
  }

  private inZone(bx: number, by: number): boolean {
    return !this.containsPoint || this.containsPoint(bx, by);
  }

  private spawn(bounds: AmbientTickOptions['bounds'], layer: 0 | 1): ShadowBlob {
    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;
    let bx = bounds.minX + Math.random() * spanX;
    let by = bounds.minY + Math.random() * spanY;
    for (let t = 0; t < 16; t++) {
      bx = bounds.minX + Math.random() * spanX;
      by = bounds.minY + Math.random() * spanY;
      if (this.inZone(bx, by)) break;
    }
    const baseR = layer === 0
      ? parkPlanSize(32 + Math.random() * 48)
      : parkPlanSize(16 + Math.random() * 26);
    return { bx, by, r: baseR, layer, phase: Math.random() * Math.PI * 2 };
  }

  tick(options: AmbientTickOptions, dt = 1): void {
    if (options.containsPoint) this.containsPoint = options.containsPoint;
    const bounds = options.bounds;
    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;
    if (spanX <= 0 || spanY <= 0) return;

    const inten = Math.max(0.15, this.intensity);
    const targetFar = Math.floor(2 + inten * 4);
    const targetNear = Math.floor(2 + inten * 5);
    const target = targetFar + targetNear;

    while (this.blobs.length < target) {
      const layer = (this.blobs.length % 2) as 0 | 1;
      this.blobs.push(this.spawn(bounds, layer));
    }
    while (this.blobs.length > target) this.blobs.pop();

    this.driftPhase += 0.004 * dt;
    const wv = ambientWindVector(options.wind ?? DEFAULT_AMBIENT_WIND);
    const windX = wv.vx * 0.35 + Math.sin(this.driftPhase) * 0.08;
    const windY = wv.vy * 0.28 + Math.cos(this.driftPhase * 0.7) * 0.05;

    for (const b of this.blobs) {
      const parallax = b.layer === 0 ? 0.35 : 0.85;
      b.phase += 0.01 * dt;
      b.bx += (windX + Math.sin(b.phase) * 0.04) * parallax * dt;
      b.by += (windY + Math.cos(b.phase * 0.9) * 0.03) * parallax * dt;

      if (!this.inZone(b.bx, b.by) || b.bx < bounds.minX - 40 || b.bx > bounds.maxX + 40) {
        const n = this.spawn(bounds, b.layer);
        Object.assign(b, n);
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

    for (const b of this.blobs) {
      if (!this.inZone(b.bx, b.by)) continue;
      const { x, y } = toScreen(b.bx, b.by);
      const pulse = 0.9 + Math.sin(b.phase) * 0.1;
      const radius = b.r * sr * pulse;
      const alpha = inten * (b.layer === 0 ? 0.14 : 0.22);
      const g = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
      g.addColorStop(0, `rgba(25, 35, 55, ${alpha * 0.9})`);
      g.addColorStop(0.55, `rgba(15, 25, 40, ${alpha * 0.55})`);
      g.addColorStop(1, 'rgba(10, 18, 30, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * 0.68, 0.15, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
