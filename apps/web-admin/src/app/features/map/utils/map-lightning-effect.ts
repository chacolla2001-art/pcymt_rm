/** Destello de relámpago esporádico con rayo ramificado (solo con lluvia intensa). */

interface BoltPoint {
  x: number;
  y: number;
}

export class MapLightningEffect {
  private flashAge = 0;
  private flashDuration = 0;
  private cooldown = 90;
  private enabled = false;
  private rainIntensity = 0;
  /** Rayo principal + ramas, en coords [0..1] del viewport; null = sin rayo. */
  private bolt: BoltPoint[] | null = null;
  private branches: BoltPoint[][] = [];
  private boltSide = 0.5;

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (!value) {
      this.flashAge = 0;
      this.flashDuration = 0;
      this.bolt = null;
      this.branches = [];
    }
  }

  setRainIntensity(value: number): void {
    this.rainIntensity = Math.min(1, Math.max(0, value));
  }

  clear(): void {
    this.flashAge = 0;
    this.flashDuration = 0;
    this.cooldown = 60;
    this.bolt = null;
    this.branches = [];
  }

  /** Genera un rayo quebrado de arriba hacia abajo con 1-2 ramas. */
  private generateBolt(): void {
    this.boltSide = 0.2 + Math.random() * 0.6;
    const segments = 7 + Math.floor(Math.random() * 4);
    const main: BoltPoint[] = [{ x: this.boltSide, y: 0 }];
    let x = this.boltSide;
    const endY = 0.5 + Math.random() * 0.32;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      x += (Math.random() - 0.5) * 0.11;
      x = Math.min(0.95, Math.max(0.05, x));
      main.push({ x, y: t * endY });
    }
    this.bolt = main;

    this.branches = [];
    const branchCount = 1 + Math.floor(Math.random() * 2);
    for (let b = 0; b < branchCount; b++) {
      const startIdx = 2 + Math.floor(Math.random() * (main.length - 3));
      const start = main[startIdx];
      const branch: BoltPoint[] = [{ ...start }];
      let bx = start.x;
      let by = start.y;
      const dir = Math.random() > 0.5 ? 1 : -1;
      const steps = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < steps; i++) {
        bx += dir * (0.03 + Math.random() * 0.06);
        by += 0.04 + Math.random() * 0.07;
        bx = Math.min(0.97, Math.max(0.03, bx));
        branch.push({ x: bx, y: by });
      }
      this.branches.push(branch);
    }
  }

  tick(rainActive: boolean, dt = 1): void {
    if (this.flashDuration > 0) {
      this.flashAge += dt;
      if (this.flashAge >= this.flashDuration) {
        this.flashAge = 0;
        this.flashDuration = 0;
        this.bolt = null;
        this.branches = [];
        this.cooldown = 70 + Math.random() * 120;
      }
      return;
    }

    if (!this.enabled || !rainActive || this.rainIntensity < 0.7) return;

    this.cooldown -= dt;
    if (this.cooldown > 0) return;

    if (Math.random() > 0.018 + (this.rainIntensity - 0.7) * 0.06) return;

    this.flashDuration = 4 + Math.random() * 6;
    this.flashAge = 0;
    this.cooldown = 80 + Math.random() * 140;
    // ponytail: ~55% de los destellos muestran rayo visible; el resto es solo fogonazo lejano.
    this.bolt = null;
    this.branches = [];
    if (Math.random() < 0.55) this.generateBolt();
  }

  isFlashing(): boolean {
    return this.flashDuration > 0 && this.flashAge < this.flashDuration;
  }

  /** Dispara un destello con rayo de inmediato (previsualización / pruebas). */
  forceFlash(withBolt = true): void {
    this.flashDuration = 4 + Math.random() * 6;
    this.flashAge = 0;
    if (withBolt) this.generateBolt();
    else { this.bolt = null; this.branches = []; }
  }

  private strokeBolt(
    ctx: CanvasRenderingContext2D,
    pts: BoltPoint[],
    w: number,
    h: number,
    width: number,
    color: string,
  ): void {
    if (pts.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x * w, pts[0].y * h);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * w, pts[i].y * h);
    ctx.stroke();
  }

  draw(
    ctx: CanvasRenderingContext2D,
    clipPath: Path2D | null,
    viewportW: number,
    viewportH: number,
  ): void {
    if (!this.isFlashing()) return;

    const t = this.flashAge / this.flashDuration;
    const peak = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
    const alpha = peak * 0.42;

    ctx.save();
    if (clipPath) ctx.clip(clipPath);

    // Fogonazo cálido (cómic): blanco-amarillo
    ctx.fillStyle = `rgba(255, 250, 215, ${alpha * 0.5})`;
    ctx.fillRect(0, 0, viewportW, viewportH);
    ctx.fillStyle = `rgba(255, 235, 150, ${alpha * 0.3})`;
    ctx.fillRect(0, viewportH * 0.06, viewportW, viewportH * 0.35);

    if (this.bolt) {
      const boltFade = Math.max(0, 1 - t * 1.4);
      if (boltFade > 0.02) {
        const scale = Math.min(viewportW, viewportH) / 320 + 0.6;
        // Contorno negro grueso (estilo cómic)
        this.strokeBolt(ctx, this.bolt, viewportW, viewportH, 7 * scale, `rgba(10, 10, 20, ${boltFade})`);
        for (const br of this.branches) this.strokeBolt(ctx, br, viewportW, viewportH, 4.5 * scale, `rgba(10, 10, 20, ${boltFade})`);
        // Relleno amarillo
        this.strokeBolt(ctx, this.bolt, viewportW, viewportH, 4 * scale, `rgba(255, 214, 40, ${boltFade})`);
        for (const br of this.branches) this.strokeBolt(ctx, br, viewportW, viewportH, 2.4 * scale, `rgba(255, 214, 40, ${boltFade})`);
        // Núcleo blanco caliente
        this.strokeBolt(ctx, this.bolt, viewportW, viewportH, 1.6 * scale, `rgba(255, 255, 240, ${boltFade})`);
        for (const br of this.branches) this.strokeBolt(ctx, br, viewportW, viewportH, 1 * scale, `rgba(255, 255, 240, ${boltFade * 0.9})`);
      }
    }

    ctx.restore();
  }
}
