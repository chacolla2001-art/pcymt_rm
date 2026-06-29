import type { GeoPoint } from '../data/park-geometry';
import {
  spatialReferenceFrameUrls,
  spatialReferenceHasMapImage,
  type SpatialReference,
} from '../data/spatial-reference';

export interface SpatialReferenceDrawOptions {
  geoToScreen: (geo: GeoPoint) => { x: number; y: number };
  phase: number;
  viewportW: number;
  viewportH: number;
  placeIndex: number;
  selectedIndex: number;
  fichaIndex: number;
}

export class SpatialReferenceLayer {
  private readonly imageCache = new Map<string, HTMLImageElement>();
  private readonly loadPromises = new Map<string, Promise<HTMLImageElement | null>>();

  preload(refs: SpatialReference[]): void {
    for (const ref of refs) {
      for (const url of spatialReferenceFrameUrls(ref)) {
        this.ensureImage(url);
      }
      if (ref.imageUrl) this.ensureImage(ref.imageUrl);
    }
  }

  ensureImage(url: string): Promise<HTMLImageElement | null> {
    const cached = this.imageCache.get(url);
    if (cached?.complete && cached.naturalWidth > 0) return Promise.resolve(cached);
    const pending = this.loadPromises.get(url);
    if (pending) return pending;

    const promise = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { this.imageCache.set(url, img); resolve(img); };
      img.onerror = () => resolve(null);
      img.src = url;
    });
    this.loadPromises.set(url, promise);
    return promise;
  }

  hitTest(
    refs: SpatialReference[],
    screenX: number,
    screenY: number,
    geoToScreen: (geo: GeoPoint) => { x: number; y: number },
  ): number {
    for (let i = refs.length - 1; i >= 0; i--) {
      const ref = refs[i];
      if (!ref.visible || !spatialReferenceHasMapImage(ref)) continue;
      const pos = geoToScreen({ lat: ref.lat, lng: ref.lng });
      const size = ref.displaySize ?? 48;
      const hitR = size * 0.55 + 8;
      const dx = screenX - pos.x;
      const dy = screenY - pos.y;
      if (dx * dx + dy * dy <= hitR * hitR) return i;
    }
    return -1;
  }

  draw(ctx: CanvasRenderingContext2D, refs: SpatialReference[], opts: SpatialReferenceDrawOptions): void {
    const { geoToScreen, phase, viewportW, viewportH, placeIndex, selectedIndex, fichaIndex } = opts;

    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      if (!ref.visible) continue;

      const pos = geoToScreen({ lat: ref.lat, lng: ref.lng });
      if (pos.x < -90 || pos.y < -90 || pos.x > viewportW + 90 || pos.y > viewportH + 90) continue;

      const cx = pos.x;
      const cy = pos.y;
      const size = ref.displaySize ?? 48;
      const mapImg = this.getCachedImage(ref, phase);
      const isEditing = placeIndex === i || selectedIndex === i || fichaIndex === i;

      if (mapImg) {
        this.drawImageMarker(ctx, mapImg, cx, cy, size);
      } else if (isEditing) {
        this.drawPlacementHint(ctx, cx, cy, size);
      } else {
        continue;
      }

      if (isEditing) {
        ctx.strokeStyle = fichaIndex === i ? '#42a5f5' : '#ff9800';
        ctx.lineWidth = 2;
        ctx.setLineDash(mapImg ? [] : [4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.55 + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  /** Anillo punteado solo mientras se ubica un punto sin imágenes aún. */
  private drawPlacementHint(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.strokeStyle = 'rgba(255, 152, 0, 0.65)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private getCachedImage(ref: SpatialReference, phase = 0): HTMLImageElement | null {
    const url = this.resolveMapImageUrl(ref, phase);
    if (!url) return null;
    const img = this.imageCache.get(url);
    if (!img?.complete || img.naturalWidth === 0) {
      this.ensureImage(url);
      return null;
    }
    return img;
  }

  private resolveMapImageUrl(ref: SpatialReference, phase: number): string | null {
    const frames = spatialReferenceFrameUrls(ref);
    if (frames.length) {
      const fps = ref.frameSequence?.fps ?? 6;
      const idx = Math.floor(phase * fps) % frames.length;
      return frames[idx] ?? null;
    }
    return ref.imageUrl ?? null;
  }

  private drawImageMarker(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    cx: number,
    cy: number,
    size: number,
  ): void {
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    const aspect = sw / sh;
    const drawW = aspect >= 1 ? size : size * aspect;
    const drawH = aspect >= 1 ? size / aspect : size;

    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + drawH * 0.42, drawW * 0.45, drawH * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
  }
}
