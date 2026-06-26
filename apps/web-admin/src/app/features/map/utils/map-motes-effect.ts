import type { AmbientTickOptions } from './map-ambient-zone';
import { parkParticleTarget } from './map-park-visual-scale';
import { ambientScreenScale } from './map-ambient-zone';
import { ambientWindVector, DEFAULT_AMBIENT_WIND } from './map-ambient-wind';

interface Mote {
  bx: number;
  by: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
  warm: boolean;
}

/** Partículas flotantes (polen, polvo en luz, chispas suaves). */
export class MapMotesEffect {
  private motes: Mote[] = [];
  private intensity = 0.4;
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
    this.motes = [];
  }

  private inZone(bx: number, by: number): boolean {
    return !this.containsPoint || this.containsPoint(bx, by);
  }

  private spawn(bounds: AmbientTickOptions['bounds'], wind = DEFAULT_AMBIENT_WIND): Mote {
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
      vx: wv.vx * 0.22 + (Math.random() - 0.5) * 0.18,
      vy: wv.vy * 0.18 - 0.12 - Math.random() * 0.25,
      r: 0.28 + Math.random() * 0.65,
      phase: Math.random() * Math.PI * 2,
      warm: Math.random() > 0.55,
    };
  }

  tick(options: AmbientTickOptions, dt = 1): void {
    if (options.containsPoint) this.containsPoint = options.containsPoint;
    const wind = options.wind ?? DEFAULT_AMBIENT_WIND;
    const bounds = options.bounds;
    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;
    if (spanX <= 0 || spanY <= 0) return;

    const inten = Math.max(0.15, this.intensity);
    const target = parkParticleTarget(8, 28, inten);

    while (this.motes.length < target) this.motes.push(this.spawn(bounds, wind));
    while (this.motes.length > target) this.motes.pop();

    for (const m of this.motes) {
      m.phase += 0.04 * dt;
      m.bx += m.vx * dt + Math.sin(m.phase) * 0.06 * dt;
      m.by += m.vy * dt;

      if (!this.inZone(m.bx, m.by) || m.by < bounds.minY - 30 || m.by > bounds.maxY + 20) {
        const n = this.spawn(bounds, wind);
        Object.assign(m, n);
        m.by = bounds.maxY + Math.random() * spanY * 0.15;
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

    for (const m of this.motes) {
      if (!this.inZone(m.bx, m.by)) continue;
      const tw = 0.45 + Math.sin(m.phase) * 0.55;
      const alpha = inten * tw;
      const { x, y } = toScreen(m.bx, m.by);
      const r = Math.max(0.25, m.r * sr * 0.9);

      // Halo de brillo — las motas cálidas resplandecen como luciérnagas
      const haloR = r * (m.warm ? 4.5 : 3);
      const haloA = alpha * (m.warm ? 0.5 : 0.3);
      const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
      if (m.warm) {
        halo.addColorStop(0, `rgba(255, 224, 150, ${haloA})`);
        halo.addColorStop(1, 'rgba(255, 210, 120, 0)');
      } else {
        halo.addColorStop(0, `rgba(200, 240, 255, ${haloA})`);
        halo.addColorStop(1, 'rgba(190, 230, 255, 0)');
      }
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, haloR, 0, Math.PI * 2);
      ctx.fill();

      const bodyR = r * 1.15;
      ctx.fillStyle = m.warm ? `rgba(255, 206, 70, ${alpha})` : `rgba(150, 220, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, bodyR, 0, Math.PI * 2);
      ctx.fill();
      // contorno fino cartoon
      ctx.strokeStyle = m.warm ? `rgba(120, 70, 0, ${alpha})` : `rgba(20, 60, 110, ${alpha})`;
      ctx.lineWidth = Math.max(0.3, bodyR * 0.28);
      ctx.stroke();
      // punto blanco central
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x - bodyR * 0.15, y - bodyR * 0.15, bodyR * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
