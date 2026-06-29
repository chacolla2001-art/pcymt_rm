import type { GeoPoint } from '../data/park-geometry';

/** Transformación 2D de una capa en espacio canvas del mapa (antes de zoom/vista). */
export interface MapLayerFrameTransform {
  x: number;
  y: number;
  /** Escala uniforme (1 = tamaño por defecto). */
  scale: number;
  rotationDeg: number;
}

/** Geometría del anillo base (-1): expansión sin mover el contorno visible. */
export interface BaseRingFrameConfig extends MapLayerFrameTransform {
  /** Ancho extra del anillo hacia el interior del parque (px canvas). */
  innerExpandPx: number;
  /** Expansión del borde exterior del anillo más allá del plano (px canvas). */
  outerExpandPx: number;
}

export interface MapLayerFramesData {
  /** Cuadrado grande del plano (fondo -2 y borde exterior del anillo). */
  mapPlate: MapLayerFrameTransform;
  /** Anillo entre plano y contorno (-1). */
  baseRing: BaseRingFrameConfig;
  /** Zonas 0/1/2 (además de layerOffsets.sections al arrastrar). */
  zones: MapLayerFrameTransform;
  /** Marcadores (además de layerOffsets.markers al arrastrar). */
  markers: MapLayerFrameTransform;
}

export const DEFAULT_LAYER_FRAME: MapLayerFrameTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotationDeg: 0,
};

export const DEFAULT_BASE_RING_FRAME: BaseRingFrameConfig = {
  ...DEFAULT_LAYER_FRAME,
  innerExpandPx: 0,
  outerExpandPx: 0,
};

export const DEFAULT_MAP_LAYER_FRAMES: MapLayerFramesData = {
  mapPlate: { ...DEFAULT_LAYER_FRAME },
  baseRing: { ...DEFAULT_BASE_RING_FRAME },
  zones: { ...DEFAULT_LAYER_FRAME },
  markers: { ...DEFAULT_LAYER_FRAME },
};

export interface CanvasPoint {
  x: number;
  y: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function normalizeFrame(frame: Partial<MapLayerFrameTransform> | undefined): MapLayerFrameTransform {
  if (!frame) return { ...DEFAULT_LAYER_FRAME };
  return {
    x: frame.x ?? 0,
    y: frame.y ?? 0,
    scale: clamp(frame.scale ?? 1, 0.25, 3),
    rotationDeg: frame.rotationDeg ?? 0,
  };
}

export function normalizeMapLayerFrames(
  raw?: Partial<MapLayerFramesData> | null,
): MapLayerFramesData {
  if (!raw) return cloneMapLayerFrames(DEFAULT_MAP_LAYER_FRAMES);
  return {
    mapPlate: normalizeFrame(raw.mapPlate),
    baseRing: {
      ...normalizeFrame(raw.baseRing),
      innerExpandPx: clamp(raw.baseRing?.innerExpandPx ?? 0, 0, 400),
      outerExpandPx: clamp(raw.baseRing?.outerExpandPx ?? 0, 0, 400),
    },
    zones: normalizeFrame(raw.zones),
    markers: normalizeFrame(raw.markers),
  };
}

export function cloneMapLayerFrames(src: MapLayerFramesData): MapLayerFramesData {
  return JSON.parse(JSON.stringify(src)) as MapLayerFramesData;
}

/** Esquinas del plano cuadrado con escala, rotación y desplazamiento. */
export function mapPlateCanvasPoints(
  w: number,
  h: number,
  frame: MapLayerFrameTransform = DEFAULT_LAYER_FRAME,
): CanvasPoint[] {
  const cx = w / 2;
  const cy = h / 2;
  const scale = clamp(frame.scale, 0.25, 3);
  const hw = (w / 2) * scale;
  const hh = (h / 2) * scale;
  const rad = (frame.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const local: CanvasPoint[] = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
  return local.map(({ x, y }) => ({
    x: cx + frame.x + x * cos - y * sin,
    y: cy + frame.y + x * sin + y * cos,
  }));
}

/** Expande cada vértice del polígono hacia fuera desde el centroide (anillo más ancho hacia fuera). */
export function expandPolygonOutward(points: CanvasPoint[], expandPx: number): CanvasPoint[] {
  if (expandPx <= 0 || points.length < 3) return points.map((p) => ({ ...p }));
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;
  return points.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return {
      x: p.x + (dx / len) * expandPx,
      y: p.y + (dy / len) * expandPx,
    };
  });
}

/**
 * Contrae el polígono hacia su centroide (hueco más pequeño → anillo base más ancho hacia dentro).
 * Solo para clip del anillo; no modifica el contorno visible.
 */
export function contractPolygonInward(points: CanvasPoint[], insetPx: number): CanvasPoint[] {
  if (insetPx <= 0 || points.length < 3) return points.map((p) => ({ ...p }));
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;
  return points.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    const shrink = Math.max(0.05, len - insetPx) / len;
    return { x: cx + dx * shrink, y: cy + dy * shrink };
  });
}

/** Plano del mapa con expansión extra del anillo hacia fuera. */
export function mapPlatePointsForBaseRing(
  w: number,
  h: number,
  plateFrame: MapLayerFrameTransform,
  outerExpandPx: number,
): CanvasPoint[] {
  const pts = mapPlateCanvasPoints(w, h, plateFrame);
  return expandPolygonOutward(pts, outerExpandPx);
}

/** Contorno usado como hueco al recortar el anillo base (-1). */
export function baseRingHoleContour(
  boundaryCanvasPoints: CanvasPoint[],
  innerExpandPx: number,
): CanvasPoint[] {
  return contractPolygonInward(boundaryCanvasPoints, innerExpandPx);
}

/** Combina offset de arrastre (layerOffsets) con marco de geometría (sliders). */
export function combineLayerOffset(
  drag: { x: number; y: number },
  frame: MapLayerFrameTransform,
): MapLayerFrameTransform {
  return {
    x: drag.x + frame.x,
    y: drag.y + frame.y,
    scale: frame.scale,
    rotationDeg: frame.rotationDeg,
  };
}

/** Aplica transformación de capa al contexto (después de translate al centro del canvas). */
export function applyLayerFrameTransform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: MapLayerFrameTransform,
): void {
  const cx = w / 2;
  const cy = h / 2;
  ctx.translate(cx + frame.x, cy + frame.y);
  if (frame.rotationDeg !== 0) {
    ctx.rotate((frame.rotationDeg * Math.PI) / 180);
  }
  if (frame.scale !== 1) {
    ctx.scale(frame.scale, frame.scale);
  }
  ctx.translate(-cx, -cy);
}

/** Punto en espacio mapa → espacio con marco de capa aplicado. */
export function forwardLayerFramePoint(
  w: number,
  h: number,
  frame: MapLayerFrameTransform,
  x: number,
  y: number,
): CanvasPoint {
  const cx = w / 2;
  const cy = h / 2;
  let px = x - cx;
  let py = y - cy;
  if (frame.scale !== 1) {
    px *= frame.scale;
    py *= frame.scale;
  }
  if (frame.rotationDeg !== 0) {
    const rad = (frame.rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = px * cos - py * sin;
    const ry = px * sin + py * cos;
    px = rx;
    py = ry;
  }
  return { x: px + cx + frame.x, y: py + cy + frame.y };
}

/** Inverso de `forwardLayerFramePoint` (p. ej. clics sobre zonas transformadas). */
export function inverseLayerFramePoint(
  w: number,
  h: number,
  frame: MapLayerFrameTransform,
  x: number,
  y: number,
): CanvasPoint {
  const cx = w / 2;
  const cy = h / 2;
  let px = x - cx - frame.x;
  let py = y - cy - frame.y;
  if (frame.rotationDeg !== 0) {
    const rad = (-frame.rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = px * cos - py * sin;
    const ry = px * sin + py * cos;
    px = rx;
    py = ry;
  }
  if (frame.scale !== 1) {
    px /= frame.scale;
    py /= frame.scale;
  }
  return { x: px + cx, y: py + cy };
}

/** Esquinas del plano en geo (para árboles y clics en capas -1/-2). */
export function mapPlateGeoPolygon(
  plateCanvasPoints: CanvasPoint[],
  canvasPointToGeo: (x: number, y: number) => GeoPoint,
): GeoPoint[] {
  return plateCanvasPoints.map((p) => canvasPointToGeo(p.x, p.y));
}
