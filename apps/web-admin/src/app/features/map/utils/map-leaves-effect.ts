import type { AmbientTickOptions } from './map-ambient-zone';
import { parkParticleTarget } from './map-park-visual-scale';
import { ambientScreenScale } from './map-ambient-zone';
import { ambientWindVector, DEFAULT_AMBIENT_WIND } from './map-ambient-wind';

/** Sesgo de viento por sección (suma al viento global). */
const SECTION_WIND_BIAS: ReadonlyArray<{ vx: number; vy: number }> = [
  { vx: -0.08, vy: 0.04 },
  { vx: 0.06, vy: 0.02 },
  { vx: 0.05, vy: 0.1 },
];

interface LeafParticle {
  bx: number;
  by: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  r: number;
  kind: 'leaf' | 'petal';
  hue: number;
}

export class MapLeavesEffect {
  private particles: LeafParticle[] = [];
  private intensity = 0.45;
  private sizeMul = 1;
  private containsPoint: ((bx: number, by: number) => boolean) | null = null;
  private sectionAt: ((bx: number, by: number) => number) | null = null;
  private wind = DEFAULT_AMBIENT_WIND;

  setIntensity(value: number): void {
    this.intensity = Math.min(1, Math.max(0, value));
  }

  setSizeMul(value: number): void {
    this.sizeMul = Math.min(2.5, Math.max(0.08, value));
  }

  setContainsPoint(fn: ((bx: number, by: number) => boolean) | null): void {
    this.containsPoint = fn;
  }

  setSectionAt(fn: ((bx: number, by: number) => number) | null): void {
    this.sectionAt = fn;
  }

  clear(): void {
    this.particles = [];
  }

  private inZone(bx: number, by: number): boolean {
    return !this.containsPoint || this.containsPoint(bx, by);
  }

  private windAt(bx: number, by: number): { vx: number; vy: number } {
    const wv = ambientWindVector(this.wind);
    const idx = this.sectionAt?.(bx, by) ?? -1;
    const bias = idx >= 0 && idx < SECTION_WIND_BIAS.length ? SECTION_WIND_BIAS[idx] : { vx: 0, vy: 0 };
    return { vx: wv.vx * 0.55 + bias.vx, vy: wv.vy * 0.45 + bias.vy + 0.2 };
  }

  private spawn(bounds: AmbientTickOptions['bounds']): LeafParticle {
    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;
    let bx = bounds.minX + Math.random() * spanX;
    let by = bounds.minY - 10 - Math.random() * spanY * 0.2;
    for (let t = 0; t < 20; t++) {
      bx = bounds.minX + Math.random() * spanX;
      by = bounds.minY - 10 - Math.random() * spanY * 0.25;
      if (this.inZone(bx, by)) break;
    }
    const w = this.windAt(bx, by);
    return {
      bx,
      by,
      vx: w.vx + (Math.random() - 0.5) * 0.12,
      vy: w.vy + 0.25 + Math.random() * 0.35,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.08,
      r: 1 + Math.random() * 1.8,
      kind: Math.random() > 0.45 ? 'leaf' : 'petal',
      hue: Math.random() > 0.5 ? 95 : 28,
    };
  }

  tick(options: AmbientTickOptions, dt = 1): void {
    if (options.containsPoint) this.containsPoint = options.containsPoint;
    if (options.wind) this.wind = options.wind;
    const bounds = options.bounds;
    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;
    if (spanX <= 0 || spanY <= 0) return;

    const inten = Math.max(0.15, this.intensity);
    const target = parkParticleTarget(5, 18, inten);

    while (this.particles.length < target) this.particles.push(this.spawn(bounds));
    while (this.particles.length > target) this.particles.pop();

    for (const p of this.particles) {
      const w = this.windAt(p.bx, p.by);
      p.vx += (w.vx - p.vx) * 0.04 * dt;
      p.vy += (w.vy + 0.3 - p.vy) * 0.03 * dt;
      p.bx += p.vx * dt * 2.2;
      p.by += p.vy * dt * 2.2;
      p.rot += p.spin * dt;

      if (!this.inZone(p.bx, p.by) || p.by > bounds.maxY + 25) {
        Object.assign(p, this.spawn(bounds));
        p.by = bounds.minY - 5 - Math.random() * 30;
      }
    }
  }

  private drawSprite(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    rot: number,
    kind: 'leaf' | 'petal',
    hue: number,
    alpha: number,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    // Volteo 3D: el ancho se comprime según la fase de giro
    const flip = 0.4 + 0.6 * Math.abs(Math.cos(rot * 1.6));
    ctx.scale(flip, 1);
    const lw = Math.max(0.3, r * 0.18);
    if (kind === 'petal') {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.6, r, 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 78%, 70%, ${alpha})`;
      ctx.fill();
      ctx.strokeStyle = `hsla(${hue}, 50%, 32%, ${alpha})`;
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.fillStyle = `hsla(0, 0%, 100%, ${alpha * 0.6})`;
      ctx.beginPath();
      ctx.ellipse(-r * 0.18, -r * 0.3, r * 0.16, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Hoja tipo corazón aplanado (muesca arriba, punta abajo)
      ctx.beginPath();
      ctx.moveTo(0, r);
      ctx.bezierCurveTo(r * 1.2, -r * 0.1, r * 0.5, -r, 0, -r * 0.4);
      ctx.bezierCurveTo(-r * 0.5, -r, -r * 1.2, -r * 0.1, 0, r);
      ctx.closePath();
      ctx.fillStyle = `hsla(${hue}, 60%, 48%, ${alpha})`;
      ctx.fill();
      ctx.strokeStyle = `hsla(${hue}, 55%, 22%, ${alpha})`;
      ctx.lineWidth = lw;
      ctx.lineJoin = 'round';
      ctx.stroke();
      // nervadura central
      ctx.lineWidth = lw * 0.7;
      ctx.beginPath();
      ctx.moveTo(0, r * 0.85);
      ctx.lineTo(0, -r * 0.35);
      ctx.stroke();
      // brillo en lóbulo superior-izquierdo
      ctx.fillStyle = `hsla(${hue}, 70%, 70%, ${alpha * 0.5})`;
      ctx.beginPath();
      ctx.ellipse(-r * 0.32, -r * 0.32, r * 0.26, r * 0.34, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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

    for (const p of this.particles) {
      if (!this.inZone(p.bx, p.by)) continue;
      const { x, y } = toScreen(p.bx, p.by);
      const r = Math.max(0.4, p.r * sr);
      this.drawSprite(ctx, x, y, r, p.rot, p.kind, p.hue, inten * 0.85);
    }

    ctx.restore();
  }
}
