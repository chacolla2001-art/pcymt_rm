/** Destello de relámpago esporádico (solo con lluvia intensa). */
export class MapLightningEffect {
  private flashAge = 0;
  private flashDuration = 0;
  private cooldown = 90;
  private enabled = false;
  private rainIntensity = 0;

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (!value) {
      this.flashAge = 0;
      this.flashDuration = 0;
    }
  }

  setRainIntensity(value: number): void {
    this.rainIntensity = Math.min(1, Math.max(0, value));
  }

  clear(): void {
    this.flashAge = 0;
    this.flashDuration = 0;
    this.cooldown = 60;
  }

  tick(rainActive: boolean, dt = 1): void {
    if (this.flashDuration > 0) {
      this.flashAge += dt;
      if (this.flashAge >= this.flashDuration) {
        this.flashAge = 0;
        this.flashDuration = 0;
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
  }

  isFlashing(): boolean {
    return this.flashDuration > 0 && this.flashAge < this.flashDuration;
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

    ctx.fillStyle = `rgba(220, 235, 255, ${alpha * 0.55})`;
    ctx.fillRect(0, 0, viewportW, viewportH);

    ctx.fillStyle = `rgba(180, 210, 255, ${alpha * 0.35})`;
    const bandH = viewportH * 0.35;
    ctx.fillRect(0, viewportH * 0.08, viewportW, bandH);

    ctx.restore();
  }
}
