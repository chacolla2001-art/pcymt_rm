/**
 * Lluvia en el plano del mapa (no en la pantalla).
 * Gotas con profundidad, ligera deriva y ondas al impacto; rota con la vista.
 */

import type { AmbientTickOptions, MapPlaneBounds } from './map-ambient-zone';
import { parkParticleTarget } from './map-park-visual-scale';
import { ambientScreenScale } from './map-ambient-zone';
import { ambientWindVector, DEFAULT_AMBIENT_WIND } from './map-ambient-wind';

export type { MapPlaneBounds };
export type RainTickOptions = AmbientTickOptions;

interface RainFaller {
  bx: number;
  by: number;
  speed: number;
  r: number;
  layer: 0 | 1 | 2;
  streak: number;
  groundY: number;
  drift: number;
}

interface RainRipple {
  bx: number;
  by: number;
  age: number;
  duration: number;
  maxR: number;
}

/** Caída pseudo-isométrica en el plano del mapa (ajustable por viento). */
const BASE_FALL_DX = 0.38;
const BASE_FALL_DY = 1;

const LAYER_ALPHA = [0.42, 0.68, 0.92] as const;
const LAYER_SPEED = [0.72, 1, 1.28] as const;

export class MapRainEffect {
  private fallers: RainFaller[] = [];
  private ripples: RainRipple[] = [];
  private intensity = 0.45;
  private sizeMul = 1;
  private containsPoint: ((bx: number, by: number) => boolean) | null = null;
  private windPhase = 0;
  private fallDx = BASE_FALL_DX;
  private fallDy = BASE_FALL_DY;

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
    this.fallers = [];
    this.ripples = [];
    this.windPhase = 0;
  }

  private inZone(bx: number, by: number): boolean {
    return !this.containsPoint || this.containsPoint(bx, by);
  }

  private randomInBounds(bounds: MapPlaneBounds, fromTop: boolean): { bx: number; by: number } {
    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;
    for (let t = 0; t < 28; t++) {
      const bx = bounds.minX + Math.random() * spanX;
      const by = fromTop
        ? bounds.minY - 10 - Math.random() * spanY * 0.25
        : bounds.minY + Math.random() * spanY * 0.95;
      if (this.inZone(bx, by) || (!fromTop && this.inZone(bx, bounds.minY + spanY * 0.5))) {
        return { bx, by };
      }
    }
    return { bx: bounds.minX + spanX * 0.5, by: bounds.minY + spanY * 0.35 };
  }

  private spawnFaller(bounds: MapPlaneBounds, spanX: number, spanY: number, fromTop = false): RainFaller {
    const layer = Math.floor(Math.random() * 3) as 0 | 1 | 2;
    const layerMul = LAYER_SPEED[layer];
    const pos = this.randomInBounds(bounds, fromTop);
    return {
      bx: pos.bx,
      by: pos.by,
      speed: (6 + Math.random() * 12) * layerMul,
      r: (0.5 + Math.random() * 0.9) * (0.75 + layer * 0.22),
      layer,
      streak: 1 + Math.random() * 2.2,
      groundY: bounds.minY + (0.1 + Math.random() * 0.9) * spanY,
      drift: (Math.random() - 0.5) * 0.35,
    };
  }

  private pickGroundY(bounds: MapPlaneBounds, spanY: number): number {
    for (let t = 0; t < 16; t++) {
      const gy = bounds.minY + (0.1 + Math.random() * 0.9) * spanY;
      const gx = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      if (this.inZone(gx, gy)) return gy;
    }
    return bounds.minY + spanY * (0.2 + Math.random() * 0.7);
  }

  tick(options: RainTickOptions, dt = 1): void {
    const { bounds, containsPoint } = options;
    if (containsPoint) this.containsPoint = containsPoint;

    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;
    if (spanX <= 0 || spanY <= 0) return;

    const intensity = Math.max(0.2, this.intensity);
    const target = parkParticleTarget(22, 95, intensity);

    while (this.fallers.length < target) {
      this.fallers.push(this.spawnFaller(bounds, spanX, spanY, true));
    }
    while (this.fallers.length > target) this.fallers.pop();

    this.windPhase += 0.007 * dt;
    const wv = ambientWindVector(options.wind ?? DEFAULT_AMBIENT_WIND);
    const gust = Math.sin(this.windPhase) * 0.14 + Math.sin(this.windPhase * 2.3) * 0.05;
    this.fallDx = BASE_FALL_DX + wv.vx * 0.55;
    this.fallDy = BASE_FALL_DY + wv.vy * 0.35;
    const wind = gust + wv.vx * 0.35;
    const speedMul = 0.55 + intensity * 1.1;
    const fallLen = Math.hypot(this.fallDx, this.fallDy);

    for (const f of this.fallers) {
      const step = f.speed * speedMul * dt;
      f.bx += (this.fallDx / fallLen) * step + (wind + f.drift) * step * 0.22;
      f.by += (this.fallDy / fallLen) * step;

      if (!this.inZone(f.bx, f.by)) {
        const next = this.spawnFaller(bounds, spanX, spanY, true);
        Object.assign(f, next);
        continue;
      }

      if (f.by >= f.groundY) {
        if (this.inZone(f.bx, f.groundY)) {
          this.addRipple(f.bx, f.groundY, intensity);
        }
        const next = this.spawnFaller(bounds, spanX, spanY, true);
        f.bx = next.bx;
        f.by = next.by;
        f.groundY = this.pickGroundY(bounds, spanY);
        f.speed = next.speed;
        f.r = next.r;
        f.layer = next.layer;
        f.streak = next.streak;
        f.drift = next.drift;
      }

      if (f.bx > bounds.maxX + 16) f.bx = bounds.minX - 10;
      if (f.bx < bounds.minX - 16) f.bx = bounds.maxX + 10;
    }

    for (const r of this.ripples) r.age += dt;
    this.ripples = this.ripples.filter((r) => r.age < r.duration && this.inZone(r.bx, r.by));
    if (this.ripples.length > 55) this.ripples.splice(0, this.ripples.length - 55);
  }

  private addRipple(bx: number, by: number, intensity: number): void {
    if (Math.random() > 0.12 + intensity * 0.72) return;
    this.ripples.push({
      bx,
      by,
      age: 0,
      duration: 22 + Math.random() * 28,
      maxR: 5 + Math.random() * 14,
    });
    if (Math.random() < 0.18 + intensity * 0.12) {
      this.ripples.push({
        bx: bx + (Math.random() - 0.5) * 6,
        by: by + (Math.random() - 0.5) * 3,
        age: 0.5 + Math.random() * 2,
        duration: 18 + Math.random() * 20,
        maxR: 3 + Math.random() * 9,
      });
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    clipPath: Path2D | null,
    toScreen: (bx: number, by: number) => { x: number; y: number },
    screenScale = 1,
  ): void {
    const intensity = Math.max(0.35, this.intensity);
    const sr = ambientScreenScale(screenScale, this.sizeMul);
    ctx.save();
    if (clipPath) ctx.clip(clipPath);

    const fallLen = Math.hypot(this.fallDx, this.fallDy);
    const fallAngle = Math.atan2(this.fallDy, this.fallDx);

    // Ondas de impacto — anillo limpio con contorno (cartoon)
    for (const r of this.ripples) {
      if (!this.inZone(r.bx, r.by)) continue;
      const t = r.age / r.duration;
      const fade = (1 - t) * intensity;
      const { x, y } = toScreen(r.bx, r.by);
      const radius = r.maxR * sr * (0.1 + t * 1.15);

      ctx.strokeStyle = `rgba(20, 60, 110, ${fade * 0.7})`;
      ctx.lineWidth = Math.max(0.6, 2.8 * sr * (1 - t * 0.5));
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * 0.34, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(150, 220, 255, ${fade})`;
      ctx.lineWidth = Math.max(0.4, 1.4 * sr * (1 - t * 0.5));
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * 0.34, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Gotas en forma de lágrima con contorno negro y brillo
    const dropAngle = fallAngle + Math.PI / 2;
    for (const f of this.fallers) {
      if (!this.inZone(f.bx, f.by)) continue;
      const head = toScreen(f.bx, f.by);
      const alpha = LAYER_ALPHA[f.layer] * intensity;
      const rw = Math.max(0.5, f.r * sr * 0.85);
      const len = rw * (2.4 + f.streak * 0.5);
      const lw = Math.max(0.4, rw * 0.4);

      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(dropAngle);
      // silueta de lágrima (punta arriba, bulbo abajo)
      ctx.beginPath();
      ctx.moveTo(0, -len);
      ctx.bezierCurveTo(rw, -len * 0.45, rw, rw * 0.6, 0, rw);
      ctx.bezierCurveTo(-rw, rw * 0.6, -rw, -len * 0.45, 0, -len);
      ctx.closePath();
      ctx.fillStyle = `rgba(70, 160, 235, ${alpha})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(15, 45, 90, ${alpha})`;
      ctx.lineWidth = lw;
      ctx.stroke();
      // brillo blanco
      ctx.fillStyle = `rgba(235, 250, 255, ${alpha * 0.85})`;
      ctx.beginPath();
      ctx.ellipse(-rw * 0.28, -len * 0.1, rw * 0.22, rw * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}
