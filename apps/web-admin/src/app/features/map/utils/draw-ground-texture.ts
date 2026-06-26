import { clampGroundTilePx, PARK_MAP_VIS, parkGroundPatternDensity } from './map-park-visual-scale';

/**
 * Suelo procedural — estilo cartoon isométrico (tipo Carbot).
 *
 * Dos capas que combaten el "look de grilla":
 *  1) SÚPER-BALDOSA: el patrón se renderiza en un lienzo de varias celdas
 *     (`span = unit * repeat`). Las features se dibujan dispersas por todo el
 *     span con un tamaño fijo (`unit`), por lo que el período de repetición es
 *     mucho mayor que el grano → de lejos no se ve el motivo repetido.
 *  2) VARIACIÓN MACRO: en `fillPolygonWithGroundTexture` se pintan manchas
 *     grandes en coordenadas del MUNDO (no se repiten), dando aspecto de
 *     terreno natural a distancia.
 *
 * Secciones: 0=Altas, 1=Medias, 2=Bajas, -1=base parque, -2=fondo del mapa.
 */

function n(span: number, density: number, min = 1): number {
  return Math.max(min, Math.round((span * span / 64) * density));
}

export interface GroundTexturePalette {
  base: string;
  accent: string;
  speck: string;
  line: string;
  light: string;
}

export function groundPaletteForSection(sectionIndex: number, isDark: boolean): GroundTexturePalette {
  if (sectionIndex === 0) {
    return isDark
      ? { base: '#5A4A30', accent: '#46381F', speck: '#6A5C44', line: '#241A0E', light: '#7A6640' }
      : { base: '#D8B878', accent: '#C09A55', speck: '#9A8B73', line: '#6B4F2A', light: '#EAD6A0' };
  }
  if (sectionIndex === 2) {
    return isDark
      ? { base: '#1A5028', accent: '#103A1C', speck: '#5A4A2A', line: '#06200E', light: '#2E8B40' }
      : { base: '#2E8B40', accent: '#1F6B30', speck: '#8A6A3C', line: '#0E3A1A', light: '#5CC85E' };
  }
  return isDark
    ? { base: '#3E6A22', accent: '#2E5418', speck: '#7A8E3A', line: '#16300C', light: '#5A8E30' }
    : { base: '#7DBE3F', accent: '#69A82F', speck: '#D8C84A', line: '#2E5418', light: '#A6E060' };
}

export function parkBasePalette(isDark: boolean): GroundTexturePalette {
  return isDark
    ? { base: '#3A4632', accent: '#2C3626', speck: '#46523A', line: '#1A2014', light: '#52624A' }
    : { base: '#8FA86A', accent: '#79925A', speck: '#6E8050', line: '#41502E', light: '#A8C084' };
}

export function mapBackdropPalette(isDark: boolean): GroundTexturePalette {
  return isDark
    ? { base: '#252B33', accent: '#323A45', speck: '#3A424E', line: '#161A20', light: '#3E4754' }
    : { base: '#AEB8A6', accent: '#98A28E', speck: '#888F7E', line: '#6E7866', light: '#C6CEBE' };
}

function seededRand(seed: number): () => number {
  let s = Math.abs(Math.floor(seed)) % 2147483646 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Repite `fn` en copias desplazadas ±span cerca de bordes → teselado sin costuras. */
function wrapped(span: number, x: number, y: number, margin: number, fn: (wx: number, wy: number) => void): void {
  const xs = [x];
  const ys = [y];
  if (x < margin) xs.push(x + span);
  if (x > span - margin) xs.push(x - span);
  if (y < margin) ys.push(y + span);
  if (y > span - margin) ys.push(y - span);
  for (const wx of xs) for (const wy of ys) fn(wx, wy);
}

/** Mancha plana de color (rompe la uniformidad dentro de la súper-baldosa). */
function flatPatchOne(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, rand: () => number, span: number, x: number, y: number, r: number): void {
  const col = rand() > 0.5 ? p.accent : p.light;
  wrapped(span, x, y, r, (wx, wy) => {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(wx, wy, r, r * 0.78, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function cartoonStone(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, span: number, x: number, y: number, size: number, lw: number): void {
  wrapped(span, x, y, size + lw, (wx, wy) => {
    ctx.beginPath();
    ctx.ellipse(wx, wy, size, size * 0.72, 0, 0, Math.PI * 2);
    ctx.fillStyle = p.speck;
    ctx.globalAlpha = 0.95;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = p.line;
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(wx - size * 0.3, wy - size * 0.26, size * 0.34, size * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function cartoonGrass(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, rand: () => number, span: number, x: number, y: number, size: number, lw: number): void {
  wrapped(span, x, y, size + lw, (wx, wy) => {
    ctx.lineCap = 'round';
    for (let b = 0; b < 3; b++) {
      const lean = (b - 1) * 0.5 + (rand() - 0.5) * 0.3;
      const h = size * (0.9 + rand() * 0.5);
      const tipX = wx + lean * size;
      const tipY = wy - h;
      const ctrlX = wx + lean * size * 0.4;
      const ctrlY = wy - h * 0.55;
      ctx.strokeStyle = p.line;
      ctx.lineWidth = lw * 2.1;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      ctx.stroke();
      ctx.strokeStyle = b === 1 ? p.light : p.accent;
      ctx.lineWidth = lw * 1.1;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;
}

function cartoonLeaf(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, rand: () => number, span: number, x: number, y: number, size: number, lw: number): void {
  wrapped(span, x, y, size + lw, (wx, wy) => {
    const rot = rand() * Math.PI * 2;
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.bezierCurveTo(size, -size * 0.4, size * 0.7, size * 0.8, 0, size);
    ctx.bezierCurveTo(-size * 0.7, size * 0.8, -size, -size * 0.4, 0, -size);
    ctx.closePath();
    ctx.fillStyle = rand() > 0.5 ? p.light : p.accent;
    ctx.globalAlpha = 0.95;
    ctx.fill();
    ctx.strokeStyle = p.line;
    ctx.lineWidth = lw;
    ctx.globalAlpha = 0.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.8);
    ctx.lineTo(0, size * 0.8);
    ctx.lineWidth = lw * 0.6;
    ctx.stroke();
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

function cartoonFlower(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, span: number, x: number, y: number, size: number, lw: number): void {
  wrapped(span, x, y, size + lw, (wx, wy) => {
    ctx.beginPath();
    ctx.arc(wx, wy, size, 0, Math.PI * 2);
    ctx.fillStyle = p.speck;
    ctx.globalAlpha = 1;
    ctx.fill();
    ctx.strokeStyle = p.line;
    ctx.lineWidth = lw * 0.8;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(wx, wy, size * 0.32, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function shadowSpot(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, span: number, x: number, y: number, size: number): void {
  wrapped(span, x, y, size, (wx, wy) => {
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = p.line;
    ctx.beginPath();
    ctx.ellipse(wx, wy, size, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

export type GroundElementType = 'patch' | 'stone' | 'grass' | 'leaf' | 'flower' | 'shadow';

export interface GroundElementSpec {
  type: GroundElementType;
  /** Densidad por área (× span²/64). Más bajo = más espacio plano. */
  density: number;
  /** Mínimo absoluto por baldosa. */
  min?: number;
  /** Tamaño en múltiplos de `unit` (escalable a cualquier baldosa). */
  sizeMin: number;
  sizeMax: number;
}

export interface ZoneGroundStyle {
  elements: GroundElementSpec[];
  /** Variación macro (manchas grandes en el mundo): multiplicador de cantidad. */
  macroDensity: number;
  /** Multiplicador de opacidad de la variación macro. */
  macroAlpha: number;
}

/**
 * ░░ PUNTO ÚNICO DE AJUSTE DE LA ESTÉTICA DEL SUELO ░░
 * Cambia densidades, tamaños y variación macro por zona aquí. Todo escala con
 * el tamaño de baldosa (`unit`), así que acepta cualquier zoom.
 */
/** Etiquetas UI para tipos de icono de suelo. */
export const GROUND_ELEMENT_LABELS: Record<GroundElementType, string> = {
  patch: 'Parches planos',
  stone: 'Piedras',
  grass: 'Hierba / paja',
  leaf: 'Hojas',
  flower: 'Flores',
  shadow: 'Sombras',
};

export const GROUND_ZONE_KEYS = [0, 1, 2, -1, -2] as const;

export const GROUND_ZONE_LABELS: Record<number, string> = {
  0: 'Tierras Altas',
  1: 'Tierras Medias',
  2: 'Tierras Bajas',
  [-1]: 'Base parque',
  [-2]: 'Fondo mapa',
};

export const GROUND_STYLE: Record<number, ZoneGroundStyle> = {
  // Tierras Altas: altiplano árido → pocas piedras, poca paja, MUCHO plano
  0: {
    elements: [
      { type: 'patch', density: 0.18, min: 1, sizeMin: 0.8, sizeMax: 2.0 },
      { type: 'stone', density: 0.16, min: 1, sizeMin: 0.16, sizeMax: 0.32 },
      { type: 'grass', density: 0.16, min: 1, sizeMin: 0.2, sizeMax: 0.34 },
    ],
    macroDensity: 1.15,
    macroAlpha: 1,
  },
  // Tierras Medias: pradera de valle → hierba densa + flores
  1: {
    elements: [
      { type: 'patch', density: 0.3, min: 2, sizeMin: 0.7, sizeMax: 1.6 },
      { type: 'grass', density: 0.7, min: 3, sizeMin: 0.22, sizeMax: 0.4 },
      { type: 'flower', density: 0.22, min: 1, sizeMin: 0.08, sizeMax: 0.14 },
    ],
    macroDensity: 1,
    macroAlpha: 1,
  },
  // Tierras Bajas: selva → hojarasca + sombras + alguna piedra
  2: {
    elements: [
      { type: 'patch', density: 0.34, min: 2, sizeMin: 0.7, sizeMax: 1.6 },
      { type: 'shadow', density: 0.3, min: 1, sizeMin: 0.35, sizeMax: 0.7 },
      { type: 'leaf', density: 0.42, min: 2, sizeMin: 0.16, sizeMax: 0.32 },
      { type: 'stone', density: 0.16, min: 1, sizeMin: 0.12, sizeMax: 0.24 },
    ],
    macroDensity: 1,
    macroAlpha: 1,
  },
  // Base del parque: pradera neutra suave
  [-1]: {
    elements: [
      { type: 'patch', density: 0.26, min: 2, sizeMin: 0.7, sizeMax: 1.5 },
      { type: 'grass', density: 0.4, min: 2, sizeMin: 0.16, sizeMax: 0.28 },
    ],
    macroDensity: 0.9,
    macroAlpha: 0.9,
  },
  // Fondo del mapa: textura neutra muy sutil (alrededor del parque)
  [-2]: {
    elements: [
      { type: 'patch', density: 0.16, min: 1, sizeMin: 0.9, sizeMax: 2.2 },
      { type: 'stone', density: 0.07, min: 0, sizeMin: 0.1, sizeMax: 0.2 },
      { type: 'grass', density: 0.08, min: 0, sizeMin: 0.12, sizeMax: 0.22 },
    ],
    macroDensity: 0.7,
    macroAlpha: 0.8,
  },
};

/** Alias explícito de los valores de fábrica (código / reset UI). */
export const DEFAULT_GROUND_STYLE = GROUND_STYLE;

let activeGroundStyleOverride: Record<number, ZoneGroundStyle> | null = null;

function cloneZoneStyle(z: ZoneGroundStyle): ZoneGroundStyle {
  return {
    macroDensity: z.macroDensity,
    macroAlpha: z.macroAlpha,
    elements: z.elements.map((e) => ({ ...e })),
  };
}

export function cloneGroundStyleMap(src: Record<number, ZoneGroundStyle>): Record<number, ZoneGroundStyle> {
  const out: Record<number, ZoneGroundStyle> = {};
  for (const [k, v] of Object.entries(src)) out[Number(k)] = cloneZoneStyle(v);
  return out;
}

/** Estilo resuelto (defaults + overrides de UI). */
export function getActiveGroundStyleMap(): Record<number, ZoneGroundStyle> {
  if (!activeGroundStyleOverride) return GROUND_STYLE;
  const merged = cloneGroundStyleMap(GROUND_STYLE);
  for (const [k, v] of Object.entries(activeGroundStyleOverride)) {
    merged[Number(k)] = cloneZoneStyle(v);
  }
  return merged;
}

export function getGroundStyleOverride(): Record<number, ZoneGroundStyle> | null {
  return activeGroundStyleOverride ? cloneGroundStyleMap(activeGroundStyleOverride) : null;
}

export function setGroundStyleOverride(style: Record<number, ZoneGroundStyle> | null): void {
  activeGroundStyleOverride = style ? cloneGroundStyleMap(style) : null;
}

export function resetGroundStyleToDefaults(): void {
  activeGroundStyleOverride = null;
}

export function resetGroundStyleZone(sectionIndex: number): void {
  if (!activeGroundStyleOverride) return;
  delete activeGroundStyleOverride[sectionIndex];
  if (Object.keys(activeGroundStyleOverride).length === 0) activeGroundStyleOverride = null;
}

export function updateGroundStyleZone(sectionIndex: number, style: ZoneGroundStyle): void {
  if (!activeGroundStyleOverride) activeGroundStyleOverride = {};
  activeGroundStyleOverride[sectionIndex] = cloneZoneStyle(style);
}

/** Snapshot completo para persistencia / panel UI. */
export function exportGroundStyleSnapshot(): Record<number, ZoneGroundStyle> {
  return cloneGroundStyleMap(getActiveGroundStyleMap());
}

/** Restaura desde snapshot guardado (null = defaults de código). */
export function importGroundStyleSnapshot(snapshot: Record<number, ZoneGroundStyle> | null | undefined): void {
  if (!snapshot || Object.keys(snapshot).length === 0) {
    resetGroundStyleToDefaults();
    return;
  }
  setGroundStyleOverride(cloneGroundStyleMap(snapshot));
}

function styleForSection(sectionIndex: number): ZoneGroundStyle {
  const styles = getActiveGroundStyleMap();
  return styles[sectionIndex] ?? styles[1];
}

function drawGroundElement(
  ctx: CanvasRenderingContext2D,
  type: GroundElementType,
  p: GroundTexturePalette,
  rand: () => number,
  span: number,
  unit: number,
  sizeMin: number,
  sizeMax: number,
  lw: number,
): void {
  const x = rand() * span;
  const y = rand() * span;
  const size = unit * (sizeMin + rand() * (sizeMax - sizeMin));
  switch (type) {
    case 'patch': flatPatchOne(ctx, p, rand, span, x, y, size); break;
    case 'stone': cartoonStone(ctx, p, span, x, y, size, lw); break;
    case 'grass': cartoonGrass(ctx, p, rand, span, x, y, size, lw); break;
    case 'leaf': cartoonLeaf(ctx, p, rand, span, x, y, size, lw); break;
    case 'flower': cartoonFlower(ctx, p, span, x, y, size, lw); break;
    case 'shadow': shadowSpot(ctx, p, span, x, y, size); break;
  }
}

function paintZone(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, rand: () => number, span: number, unit: number, style: ZoneGroundStyle): void {
  const lw = Math.max(0.4, unit * 0.06);
  for (const el of style.elements) {
    const count = n(span, el.density, el.min ?? 0);
    for (let i = 0; i < count; i++) {
      drawGroundElement(ctx, el.type, p, rand, span, unit, el.sizeMin, el.sizeMax, lw);
    }
  }
}

function paletteForSection(sectionIndex: number, isDark: boolean): GroundTexturePalette {
  if (sectionIndex === -2) return mapBackdropPalette(isDark);
  if (sectionIndex < 0) return parkBasePalette(isDark);
  return groundPaletteForSection(sectionIndex, isDark);
}

function paintSection(ctx: CanvasRenderingContext2D, sectionIndex: number, p: GroundTexturePalette, rand: () => number, span: number, unit: number): void {
  paintZone(ctx, p, rand, span, unit, styleForSection(sectionIndex));
}

/** Nº de celdas que componen la súper-baldosa (período de repetición grande). */
function repeatFactor(unit: number): number {
  return Math.max(2, Math.min(6, Math.round(150 / unit)));
}

export function buildGroundPatternTile(
  sectionIndex: number,
  isDark: boolean,
  tilePx: number = PARK_MAP_VIS.groundTilePx,
): HTMLCanvasElement {
  const unit = clampGroundTilePx(tilePx);
  const span = unit * repeatFactor(unit);
  const canvas = document.createElement('canvas');
  canvas.width = span;
  canvas.height = span;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const palette = paletteForSection(sectionIndex, isDark);
  const seed = sectionIndex * 991 + (isDark ? 17 : 0) + unit * 5;
  const rand = seededRand(seed);

  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, span, span);
  paintSection(ctx, sectionIndex, palette, rand, span, unit);

  return canvas;
}

export class GroundPatternCache {
  private readonly patterns = new Map<string, CanvasPattern | null>();
  private tilePx: number = PARK_MAP_VIS.groundTilePx;

  getTilePx(): number {
    return this.tilePx;
  }

  setTilePx(px: number): void {
    const next = clampGroundTilePx(px);
    if (next === this.tilePx) return;
    this.tilePx = next;
    this.clear();
  }

  getPattern(ctx: CanvasRenderingContext2D, sectionIndex: number, isDark: boolean): CanvasPattern | null {
    const key = `${sectionIndex}_${isDark ? 'd' : 'l'}_${this.tilePx}`;
    const cached = this.patterns.get(key);
    if (cached !== undefined) return cached;

    const pattern = ctx.createPattern(buildGroundPatternTile(sectionIndex, isDark, this.tilePx), 'repeat');
    this.patterns.set(key, pattern);
    return pattern;
  }

  clear(): void {
    this.patterns.clear();
  }
}

function fillMapRectWithPattern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pattern: CanvasPattern | null,
  mapScale: number,
): void {
  if (!pattern) return;
  const dens = parkGroundPatternDensity(mapScale);
  ctx.save();
  ctx.scale(1 / dens, 1 / dens);
  ctx.fillStyle = pattern;
  ctx.fillRect(x * dens, y * dens, w * dens, h * dens);
  ctx.restore();
}

/**
 * Variación macro: manchas grandes en coordenadas del MUNDO, deterministas por
 * polígono. No se repiten → de lejos el suelo parece terreno natural, no grilla.
 */
function paintMacroVariation(
  ctx: CanvasRenderingContext2D,
  p: GroundTexturePalette,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  sectionIndex: number,
  style: ZoneGroundStyle,
): void {
  if (style.macroDensity <= 0 || style.macroAlpha <= 0) return;
  const w = maxX - minX;
  const h = maxY - minY;
  const area = w * h;
  if (area <= 0) return;
  const seed = Math.floor(minX) * 73856093 ^ Math.floor(minY) * 19349663 ^ (sectionIndex + 5) * 83492791;
  const rand = seededRand(seed >>> 0);
  const blobs = Math.max(4, Math.min(28, Math.round((area / 9000) * style.macroDensity)));
  const baseR = Math.max(24, Math.min(w, h) * 0.32);
  for (let i = 0; i < blobs; i++) {
    const cx = minX + rand() * w;
    const cy = minY + rand() * h;
    const r = baseR * (0.6 + rand() * 1.1);
    const col = rand() > 0.5 ? p.light : p.accent;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, col);
    g.addColorStop(1, 'transparent');
    ctx.globalAlpha = (0.07 + rand() * 0.07) * style.macroAlpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * (0.7 + rand() * 0.3), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // sombreado suave de relieve (un par de bandas oscuras grandes)
  for (let i = 0; i < 2; i++) {
    const cx = minX + rand() * w;
    const cy = minY + rand() * h;
    const r = baseR * (1.2 + rand() * 0.8);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, p.line);
    g.addColorStop(1, 'transparent');
    ctx.globalAlpha = (0.05 + rand() * 0.05) * style.macroAlpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function fillPolygonWithGroundTexture(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  sectionIndex: number,
  isDark: boolean,
  tintColor: string,
  tintOpacity: number,
  cache: GroundPatternCache,
  mapScale: number = PARK_MAP_VIS.groundRefZoom,
): void {
  if (points.length < 3) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 3;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.save();
  ctx.clip();

  const pattern = cache.getPattern(ctx, sectionIndex, isDark);
  fillMapRectWithPattern(ctx, minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2, pattern, mapScale);

  paintMacroVariation(ctx, paletteForSection(sectionIndex, isDark), minX, minY, maxX, maxY, sectionIndex, styleForSection(sectionIndex));

  if (tintOpacity > 0) {
    ctx.fillStyle = tintColor;
    ctx.globalAlpha = tintOpacity;
    ctx.fillRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export class MapBackdropCache {
  private readonly inner = new GroundPatternCache();

  setTilePx(px: number): void {
    this.inner.setTilePx(px);
  }

  getPattern(ctx: CanvasRenderingContext2D, isDark: boolean): CanvasPattern | null {
    return this.inner.getPattern(ctx, -2, isDark);
  }

  clear(): void {
    this.inner.clear();
  }
}

export function fillMapRectWithBackdrop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  isDark: boolean,
  cache: MapBackdropCache,
  mapScale: number,
): void {
  const pattern = cache.getPattern(ctx, isDark);
  fillMapRectWithPattern(ctx, x, y, w, h, pattern, mapScale);
}
