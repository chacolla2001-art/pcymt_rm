import {
  isBackdropTreeSlot,
  isBaseParkTreeSlot,
  paletteSectionForTree,
  type AmbientTreeSlot,
} from '../data/ambient-tree-slots';
import type { MapPlaneBounds } from './map-ambient-zone';
import type { AmbientWind } from './map-ambient-zone';
import { drawSimpleTree } from './draw-simple-tree';

export interface MapTreesDrawOptions {
  geoToCanvas: (geo: { lat: number; lng: number }) => { x: number; y: number };
  isParkTreeVisible: (slot: AmbientTreeSlot, geo: { lat: number; lng: number }) => boolean;
  isBaseParkTreeVisible: (slot: AmbientTreeSlot, geo: { lat: number; lng: number }) => boolean;
  isBackdropTreeVisible: (slot: AmbientTreeSlot, geo: { lat: number; lng: number }) => boolean;
  viewport: MapPlaneBounds;
  isDark: boolean;
  baseHeight: number;
  wind: AmbientWind;
}

interface PlacedTree extends AmbientTreeSlot {
  x: number;
  y: number;
}

export class MapTreesEffect {
  private intensity = 0.55;
  private sizeMul = 1;
  private slots: AmbientTreeSlot[] = [];

  setIntensity(value: number): void {
    this.intensity = Math.min(1, Math.max(0, value));
  }

  setSizeMul(value: number): void {
    this.sizeMul = Math.min(2.5, Math.max(0.08, value));
  }

  setSlots(slots: AmbientTreeSlot[] | null): void {
    this.slots = (slots ?? []).map((s) => ({ ...s }));
  }

  tick(_dt = 1): void {
    // ponytail: árboles estáticos — sin fase de viento
  }

  private zonePool(): AmbientTreeSlot[] {
    return this.slots.filter((s) => !isBackdropTreeSlot(s) && !isBaseParkTreeSlot(s));
  }

  private baseParkPool(): AmbientTreeSlot[] {
    return this.slots.filter((s) => isBaseParkTreeSlot(s));
  }

  private backdropPool(): AmbientTreeSlot[] {
    return this.slots.filter((s) => isBackdropTreeSlot(s));
  }

  private collectVisible(
    pool: AmbientTreeSlot[],
    opts: MapTreesDrawOptions,
    mode: 'zone' | 'basePark' | 'backdrop',
  ): PlacedTree[] {
    if (!pool.length) return [];

    const pad = 48;
    const { viewport } = opts;
    const count = pool.length;
    if (!count) return [];

    const trees: PlacedTree[] = [];
    for (let i = 0; i < count; i++) {
      const slot = pool[i];
      const geo = { lat: slot.lat, lng: slot.lng };
      const visible = mode === 'backdrop'
        ? opts.isBackdropTreeVisible(slot, geo)
        : mode === 'basePark'
          ? opts.isBaseParkTreeVisible(slot, geo)
          : opts.isParkTreeVisible(slot, geo);
      if (!visible) continue;
      const pos = opts.geoToCanvas(geo);
      if (pos.x < viewport.minX - pad || pos.x > viewport.maxX + pad
        || pos.y < viewport.minY - pad || pos.y > viewport.maxY + pad) {
        continue;
      }
      trees.push({ ...slot, x: pos.x, y: pos.y });
    }
    trees.sort((a, b) => a.y - b.y);
    return trees;
  }

  private drawPlaced(
    ctx: CanvasRenderingContext2D,
    trees: PlacedTree[],
    opts: MapTreesDrawOptions,
  ): void {
    for (const t of trees) {
      const h = opts.baseHeight * this.sizeMul * t.scale;
      drawSimpleTree(
        ctx,
        t.x,
        t.y,
        h,
        0,
        t.seed,
        t.variant,
        opts.isDark,
        paletteSectionForTree(t),
      );
    }
  }

  /** Árboles de la capa base del parque (section=-1), bajo las zonas. */
  drawBasePark(ctx: CanvasRenderingContext2D, opts: MapTreesDrawOptions): void {
    const trees = this.collectVisible(this.baseParkPool(), opts, 'basePark');
    if (!trees.length) return;
    this.drawPlaced(ctx, trees, opts);
  }

  /** Árboles del fondo del mapa (section=-2), bajo el parque. */
  drawBackdrop(ctx: CanvasRenderingContext2D, opts: MapTreesDrawOptions): void {
    const trees = this.collectVisible(this.backdropPool(), opts, 'backdrop');
    if (!trees.length) return;
    this.drawPlaced(ctx, trees, opts);
  }

  /** Árboles de ecosistema (0/1/2), sobre las zonas. */
  drawWorld(ctx: CanvasRenderingContext2D, opts: MapTreesDrawOptions): void {
    const trees = this.collectVisible(this.zonePool(), opts, 'zone');
    if (!trees.length) return;
    this.drawPlaced(ctx, trees, opts);
  }
}
