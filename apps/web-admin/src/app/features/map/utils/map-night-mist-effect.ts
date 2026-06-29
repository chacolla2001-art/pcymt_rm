import type { AmbientTickOptions } from './map-ambient-zone';
import { ambientScreenScale } from './map-ambient-zone';
import { parkPlanSize, parkParticleTarget } from './map-park-visual-scale';

interface MistVeil {
  bx: number;
  by: number;
  r: number;
  phase: number;
}

/** Bruma nocturna con tinte azul — pensada para tema oscuro del mapa. */
export class MapNightMistEffect {
  private veils: MistVeil[] = [];
  private intensity = 0.35;
  private containsPoint: ((bx: number, by: number) => boolean) | null = null;
  private globalPhase = 0;

  setIntensity(value: number): void {
    this.intensity = Math.min(1, Math.max(0, value));
  }

  setContainsPoint(fn: ((bx: number, by: number) => boolean) | null): void {
    this.containsPoint = fn;
  }

  clear(): void {
    this.veils = [];
    this.globalPhase = 0;
  }

  private inZone(bx: number, by: number): boolean {
    return !this.containsPoint || this.containsPoint(bx, by);
  }

  tick(options: AmbientTickOptions, dt = 1): void {
    if (options.containsPoint) this.containsPoint = options.containsPoint;
    const bounds = options.bounds;
    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;
    if (spanX <= 0 || spanY <= 0) return;

    const inten = Math.max(0.15, this.intensity);
    const target = parkParticleTarget(2, 6, inten);

    while (this.veils.length < target) {
      let bx = bounds.minX + Math.random() * spanX;
      let by = bounds.minY + Math.random() * spanY;
      for (let t = 0; t < 16; t++) {
        bx = bounds.minX + Math.random() * spanX;
        by = bounds.minY + Math.random() * spanY;
        if (this.inZone(bx, by)) break;
      }
      this.veils.push({
        bx,
        by,
        r: parkPlanSize(22 + Math.random() * 38),
        phase: Math.random() * Math.PI * 2,
      });
    }
    while (this.veils.length > target) this.veils.pop();

    this.globalPhase += 0.005 * dt;
    for (const v of this.veils) {
      v.phase += 0.008 * dt;
      v.bx += Math.sin(v.phase + this.globalPhase) * 0.05 * dt;
      v.by += Math.cos(v.phase * 0.85) * 0.03 * dt;
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    clipPath: Path2D | null,
    toScreen: (bx: number, by: number) => { x: number; y: number },
    screenScale = 1,
    isDarkTheme: boolean,
    viewportW: number,
    viewportH: number,
  ): void {
    if (!isDarkTheme) return;

    const inten = Math.max(0.2, this.intensity);
    const sr = ambientScreenScale(screenScale, 1);
    ctx.save();
    if (clipPath) ctx.clip(clipPath);

    for (const v of this.veils) {
      if (!this.inZone(v.bx, v.by)) continue;
      const { x, y } = toScreen(v.bx, v.by);
      const pulse = 0.88 + Math.sin(v.phase) * 0.12;
      const radius = v.r * sr * pulse;
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, `rgba(80, 120, 200, ${inten * 0.2})`);
      g.addColorStop(0.5, `rgba(50, 80, 160, ${inten * 0.12})`);
      g.addColorStop(1, 'rgba(30, 50, 100, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = `rgba(25, 40, 90, ${inten * 0.06})`;
    ctx.fillRect(0, 0, viewportW, viewportH);

    ctx.restore();
  }
}
