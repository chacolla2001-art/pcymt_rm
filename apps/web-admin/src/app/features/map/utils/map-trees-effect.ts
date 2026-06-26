import { AMBIENT_TREE_SLOTS, type AmbientTreeSlot } from '../data/ambient-tree-slots';
import type { MapPlaneBounds } from './map-ambient-zone';
import type { AmbientWind } from './map-ambient-zone';
import { drawSimpleTree } from './draw-simple-tree';

export interface MapTreesDrawOptions {
  geoToCanvas: (geo: { lat: number; lng: number }) => { x: number; y: number };
  isInZone: (geo: { lat: number; lng: number }) => boolean;
  viewport: MapPlaneBounds;
  isDark: boolean;
  baseHeight: number;
  sectionIndex: number;
  wind: AmbientWind;
}

interface PlacedTree extends AmbientTreeSlot {
  x: number;
  y: number;
}

export class MapTreesEffect {
  private phase = 0;
  private intensity = 0.55;
  private sizeMul = 1;
  private sectionIndex = -1;

  setIntensity(value: number): void {
    this.intensity = Math.min(1, Math.max(0, value));
  }

  setSizeMul(value: number): void {
    this.sizeMul = Math.min(2.5, Math.max(0.08, value));
  }

  setSectionIndex(index: number): void {
    this.sectionIndex = index;
  }

  getPhase(): number {
    return this.phase;
  }

  tick(_dt = 1): void {
    // ponytail: árboles estáticos — sin fase de viento
  }

  private pool(): AmbientTreeSlot[] {
    if (this.sectionIndex < 0) return AMBIENT_TREE_SLOTS;
    return AMBIENT_TREE_SLOTS.filter((s) => s.section === this.sectionIndex);
  }

  drawWorld(ctx: CanvasRenderingContext2D, opts: MapTreesDrawOptions): void {
    const pad = 48;
    const { viewport, isDark, baseHeight, sectionIndex } = opts;
    this.sectionIndex = sectionIndex;

    const pool = this.pool();
    if (!pool.length) return;

    const count = Math.min(
      pool.length,
      Math.max(2, Math.floor(2 + this.intensity * (pool.length - 1))),
    );

    const trees: PlacedTree[] = [];
    for (let i = 0; i < count; i++) {
      const slot = pool[i];
      const geo = { lat: slot.lat, lng: slot.lng };
      if (!opts.isInZone(geo)) continue;
      const pos = opts.geoToCanvas(geo);
      if (pos.x < viewport.minX - pad || pos.x > viewport.maxX + pad
        || pos.y < viewport.minY - pad || pos.y > viewport.maxY + pad) {
        continue;
      }
      trees.push({ ...slot, x: pos.x, y: pos.y });
    }

    trees.sort((a, b) => a.y - b.y);

    for (const t of trees) {
      const h = baseHeight * this.sizeMul * t.scale;
      drawSimpleTree(ctx, t.x, t.y, h, 0, t.seed, t.variant, isDark, t.section);
    }
  }
}
