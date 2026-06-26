import type { GeoPoint } from '../data/park-geometry';
import {
  SPATIAL_REFERENCE_CATEGORY_COLORS,
  spatialReferenceAnimOffset,
  type SpatialReference,
  type SpatialReferenceMarkerStyle,
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
      const url = ref.imageUrl ?? ref.spriteSheet?.url ?? ref.education?.referenceImageUrl;
      if (url) this.ensureImage(url);
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
      if (!ref.visible) continue;
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

      const procedural = spatialReferenceAnimOffset(ref.animation ?? 'none', phase, i);
      const cx = pos.x;
      const cy = pos.y + procedural.dy;
      const size = (ref.displaySize ?? 48) * procedural.scale;

      const mapImg = this.getCachedImage(ref);
      if (mapImg) {
        this.drawImageMarker(ctx, mapImg, cx, cy, size, ref);
      } else {
        this.drawStyledMarker(ctx, ref, cx, cy, size, procedural.ripple);
      }

      if (placeIndex === i || selectedIndex === i || fichaIndex === i) {
        ctx.strokeStyle = fichaIndex === i ? '#42a5f5' : '#ff9800';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.55 + 7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private getCachedImage(ref: SpatialReference): HTMLImageElement | null {
    const url = ref.imageUrl ?? ref.spriteSheet?.url;
    if (!url) return null;
    const img = this.imageCache.get(url);
    if (!img?.complete || img.naturalWidth === 0) {
      this.ensureImage(url);
      return null;
    }
    return img;
  }

  private drawImageMarker(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    cx: number,
    cy: number,
    size: number,
    ref: SpatialReference,
  ): void {
    const sheet = ref.spriteSheet;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    let sx = 0;
    let sy = 0;

    if (sheet && sheet.frameCount > 1) {
      const cols = sheet.columns ?? sheet.frameCount;
      const fps = sheet.fps ?? 8;
      const frame = Math.floor((performance.now() / 1000) * fps) % sheet.frameCount;
      sx = (frame % cols) * sheet.frameWidth;
      sy = Math.floor(frame / cols) * sheet.frameHeight;
      sw = sheet.frameWidth;
      sh = sheet.frameHeight;
    }

    const aspect = sw / sh;
    const drawW = aspect >= 1 ? size : size * aspect;
    const drawH = aspect >= 1 ? size / aspect : size;

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + drawH * 0.42, drawW * 0.45, drawH * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.drawImage(img, sx, sy, sw, sh, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
  }

  private drawStyledMarker(
    ctx: CanvasRenderingContext2D,
    ref: SpatialReference,
    cx: number,
    cy: number,
    size: number,
    ripple: number,
  ): void {
    if (ripple > 0) {
      ctx.strokeStyle = `rgba(100, 180, 255, ${0.25 * ripple})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy + size * 0.35, size * (0.5 + ripple * 0.45), 0, Math.PI * 2);
      ctx.stroke();
    }

    const color = SPATIAL_REFERENCE_CATEGORY_COLORS[ref.category] ?? '#607D8B';
    const style: SpatialReferenceMarkerStyle = ref.markerStyle ?? 'circle';
    const r = size * 0.45;

    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.95, r * 0.55, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    switch (style) {
      case 'square':
        ctx.beginPath();
        ctx.roundRect(-r, -r, r * 2, r * 2, r * 0.22);
        ctx.fill();
        ctx.stroke();
        break;
      case 'pin':
      case 'marker':
        ctx.beginPath();
        ctx.arc(0, -r * 0.15, r * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, r * 0.55);
        ctx.lineTo(-r * 0.42, -r * 0.05);
        ctx.lineTo(r * 0.42, -r * 0.05);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      default:
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(r * 0.62)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ref.icon.slice(0, 1).toUpperCase(), 0, style === 'pin' || style === 'marker' ? -r * 0.15 : 0);
    ctx.restore();
  }
}
