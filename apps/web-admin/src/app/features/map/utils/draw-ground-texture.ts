import { clampGroundTilePx, PARK_MAP_VIS } from './map-park-visual-scale';
import {
  buildPresetGroundStyles,
  mergeGroundStyles,
  DEFAULT_GROUND_MAP_SETTINGS,
  groundQualityFactor,
  elementVisibleAtLod,
  ecotoneStepsForLod,
  ecotoneScatterMul,
  macroBlobCap,
  resolveTilePxFromSettings,
  type GroundLodTier,
  type GroundMapSettings,
} from './ground-preset';
import { effectiveGroundLodTier } from './map-lod';
import { DEFAULT_MAP_LOD_CATEGORIES } from './map-lod';

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

/** Racimo de guijarros pequeños (3–5 piedritas). Bueno para árido / orillas. */
function cartoonPebbles(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, rand: () => number, span: number, x: number, y: number, size: number, lw: number): void {
  const count = 3 + Math.floor(rand() * 3);
  wrapped(span, x, y, size * 2 + lw, (wx, wy) => {
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const d = rand() * size * 1.4;
      const r = size * (0.3 + rand() * 0.4);
      const px = wx + Math.cos(a) * d;
      const py = wy + Math.sin(a) * d * 0.7;
      ctx.beginPath();
      ctx.ellipse(px, py, r, r * 0.74, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.speck;
      ctx.globalAlpha = 0.92;
      ctx.fill();
      ctx.lineWidth = lw * 0.8;
      ctx.strokeStyle = p.line;
      ctx.globalAlpha = 0.7;
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;
}

/** Grieta de tierra seca: línea curva con una rama. Ideal para Tierras Altas. */
function cartoonCrack(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, rand: () => number, span: number, x: number, y: number, size: number, lw: number): void {
  wrapped(span, x, y, size + lw, (wx, wy) => {
    ctx.strokeStyle = p.line;
    ctx.lineWidth = lw * 0.9;
    ctx.globalAlpha = 0.5;
    ctx.lineCap = 'round';
    const ang = rand() * Math.PI * 2;
    const len = size;
    const ex = wx + Math.cos(ang) * len;
    const ey = wy + Math.sin(ang) * len;
    const mx = (wx + ex) / 2 + (rand() - 0.5) * size * 0.4;
    const my = (wy + ey) / 2 + (rand() - 0.5) * size * 0.4;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
    const ba = ang + (rand() - 0.5) * 1.4;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + Math.cos(ba) * len * 0.5, my + Math.sin(ba) * len * 0.5);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

/** Arbusto bajo cel-shaded (3 lóbulos + contorno + luz). */
function cartoonBush(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, span: number, x: number, y: number, size: number, lw: number): void {
  const lobes: [number, number, number][] = [[0, 0, 1], [-0.6, 0.12, 0.7], [0.6, 0.12, 0.7]];
  wrapped(span, x, y, size * 1.7 + lw, (wx, wy) => {
    ctx.fillStyle = p.line;
    ctx.globalAlpha = 0.9;
    for (const [ox, oy, s] of lobes) {
      ctx.beginPath();
      ctx.arc(wx + ox * size, wy + oy * size, size * s + lw, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = p.accent;
    ctx.globalAlpha = 1;
    for (const [ox, oy, s] of lobes) {
      ctx.beginPath();
      ctx.arc(wx + ox * size, wy + oy * size, size * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = p.light;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(wx - size * 0.3, wy - size * 0.32, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/** Juncos altos y finos (más altos que la hierba). Para selva / humedales. */
function cartoonReed(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, rand: () => number, span: number, x: number, y: number, size: number, lw: number): void {
  wrapped(span, x, y, size * 2 + lw, (wx, wy) => {
    ctx.lineCap = 'round';
    const blades = 2 + Math.floor(rand() * 2);
    for (let b = 0; b < blades; b++) {
      const lean = (rand() - 0.5) * 0.5;
      const h = size * (1.6 + rand() * 0.8);
      const tipX = wx + lean * size;
      const tipY = wy - h;
      const ctrlX = wx + lean * size * 1.2;
      const ctrlY = wy - h * 0.6;
      ctx.strokeStyle = p.line;
      ctx.lineWidth = lw * 1.8;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      ctx.stroke();
      ctx.strokeStyle = p.light;
      ctx.lineWidth = lw * 0.9;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;
}

/** Pétalos caídos: óvalos pequeños de color dispersos. */
function cartoonPetal(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, rand: () => number, span: number, x: number, y: number, size: number): void {
  wrapped(span, x, y, size * 2, (wx, wy) => {
    const count = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const d = rand() * size * 1.6;
      const px = wx + Math.cos(a) * d;
      const py = wy + Math.sin(a) * d * 0.8;
      ctx.beginPath();
      ctx.ellipse(px, py, size * 0.5, size * 0.32, a, 0, Math.PI * 2);
      ctx.fillStyle = p.speck;
      ctx.globalAlpha = 0.9;
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
}

/** Granos de tierra finos (motas oscuras). Ayuda a romper zonas planas. */
function dirtSpeck(ctx: CanvasRenderingContext2D, p: GroundTexturePalette, rand: () => number, span: number, x: number, y: number, size: number): void {
  wrapped(span, x, y, size, (wx, wy) => {
    const count = 4 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const px = wx + (rand() - 0.5) * size * 2;
      const py = wy + (rand() - 0.5) * size * 2;
      ctx.fillStyle = rand() > 0.5 ? p.line : p.accent;
      ctx.globalAlpha = 0.35 + rand() * 0.3;
      ctx.beginPath();
      ctx.arc(px, py, size * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
}

export type GroundElementType =
  | 'patch' | 'stone' | 'grass' | 'leaf' | 'flower' | 'shadow'
  | 'pebbles' | 'crack' | 'bush' | 'reed' | 'petal' | 'dirt';

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
  macroDensity: number;
  macroAlpha: number;
  /** Ancho del ecotono (px mundo). 0 = corte duro. */
  edgeBlend?: number;
  edgeBlendAlpha?: number;
  /** Puente elaborado (texturas + paleta). Si falta, usa DEFAULT_ECOTONE_BRIDGE. */
  bridge?: EcotoneBridgeStyle;
}

/** Texturas y mezcla del puente ecotonal en el borde de cada zona. */
export interface EcotoneBridgeStyle {
  /** Iconos del puente (se siembran en la franja con alpha decreciente). */
  elements: GroundElementSpec[];
  /** Mezcla de paleta zona→base en el borde (0..1). */
  paletteMix: number;
  /** Cuánto patrón de la capa inferior cubre la franja (0..1). */
  basePatternMix: number;
  /** Intensidad del fade de la textura de zona en el borde (0..1). */
  zoneFade: number;
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
  pebbles: 'Guijarros',
  crack: 'Grietas (tierra seca)',
  bush: 'Arbustos',
  reed: 'Juncos',
  petal: 'Pétalos',
  dirt: 'Granos de tierra',
};

/** Orden canónico de tipos (para selector «añadir textura» en la UI). */
export const GROUND_ELEMENT_TYPES: GroundElementType[] = [
  'patch', 'grass', 'stone', 'pebbles', 'dirt', 'crack',
  'leaf', 'flower', 'petal', 'bush', 'reed', 'shadow',
];

export const GROUND_ZONE_KEYS = [0, 1, 2, -1, -2] as const;

/** Capas interiores del parque (zonas + base); sin el fondo exterior (-2). */
export const GROUND_PARK_LAYER_KEYS = [0, 1, 2, -1] as const;

export const GROUND_ZONE_LABELS: Record<number, string> = {
  0: 'Tierras Altas',
  1: 'Tierras Medias',
  2: 'Tierras Bajas',
  [-1]: 'Base parque',
  [-2]: 'Fondo mapa',
};

/** Estilo de suelo sin elementos, macro ni ecotono (solo color base de la paleta). */
export function emptyZoneGroundStyle(): ZoneGroundStyle {
  return {
    elements: [],
    macroDensity: 0,
    macroAlpha: 0,
    edgeBlend: 0,
    edgeBlendAlpha: 0,
  };
}

export function emptyEcotoneBridge(): EcotoneBridgeStyle {
  return {
    elements: [],
    paletteMix: 0,
    basePatternMix: 0,
    zoneFade: 0,
  };
}

function buildEmptyGroundStyleMap(): Record<number, ZoneGroundStyle> {
  const out: Record<number, ZoneGroundStyle> = {};
  for (const k of GROUND_ZONE_KEYS) {
    out[k] = { ...emptyZoneGroundStyle(), elements: [] };
  }
  return out;
}

/** Defaults de fábrica: piso vacío en todas las capas (sin piedras/hierba/macro/ecotono). */
export const GROUND_STYLE: Record<number, ZoneGroundStyle> = buildEmptyGroundStyleMap();

/** Alias explícito de los valores de fábrica (código / reset UI). */
export const DEFAULT_GROUND_STYLE = GROUND_STYLE;

const ECOTONE_BRIDGE_KEYS = [0, 1, 2, -1] as const;

/** Puente ecotonal vacío por defecto (sin iconos ni mezcla en el borde). */
export const DEFAULT_ECOTONE_BRIDGE: Record<number, EcotoneBridgeStyle> = Object.fromEntries(
  ECOTONE_BRIDGE_KEYS.map((k) => [k, emptyEcotoneBridge()]),
) as Record<number, EcotoneBridgeStyle>;

function bridgeForSection(sectionIndex: number, style: ZoneGroundStyle): EcotoneBridgeStyle {
  return style.bridge ?? DEFAULT_ECOTONE_BRIDGE[sectionIndex] ?? DEFAULT_ECOTONE_BRIDGE[1];
}

function cloneBridge(b: EcotoneBridgeStyle): EcotoneBridgeStyle {
  return {
    paletteMix: b.paletteMix,
    basePatternMix: b.basePatternMix,
    zoneFade: b.zoneFade,
    elements: b.elements.map((e) => ({ ...e })),
  };
}

function cloneZoneStyle(z: ZoneGroundStyle): ZoneGroundStyle {
  return {
    macroDensity: z.macroDensity,
    macroAlpha: z.macroAlpha,
    edgeBlend: z.edgeBlend,
    edgeBlendAlpha: z.edgeBlendAlpha,
    bridge: z.bridge ? cloneBridge(z.bridge) : undefined,
    elements: z.elements.map((e) => ({ ...e })),
  };
}

/** JSON/API devuelve claves numéricas como string ("-1"); normaliza a number. */
export function normalizeGroundStyleMapKeys(
  src: Record<number | string, ZoneGroundStyle>,
): Record<number, ZoneGroundStyle> {
  const out: Record<number, ZoneGroundStyle> = {};
  for (const [k, v] of Object.entries(src)) {
    if (v == null) continue;
    out[Number(k)] = cloneZoneStyle(v);
  }
  return out;
}

export function cloneGroundStyleMap(src: Record<number, ZoneGroundStyle>): Record<number, ZoneGroundStyle> {
  return normalizeGroundStyleMapKeys(src);
}

let activeGroundStyleOverride: Record<number, ZoneGroundStyle> | null = null;
let activeGroundMapSettings: GroundMapSettings = { ...DEFAULT_GROUND_MAP_SETTINGS };
let manualGroundTilePx: number | null = null;

export function getGroundMapSettings(): GroundMapSettings {
  return { ...activeGroundMapSettings };
}

export function setGroundMapSettings(settings: GroundMapSettings): void {
  activeGroundMapSettings = { ...settings };
}

export function exportGroundMapSettings(): GroundMapSettings {
  return getGroundMapSettings();
}

export function importGroundMapSettings(settings: Partial<GroundMapSettings> | null | undefined): void {
  activeGroundMapSettings = settings
    ? {
        ...DEFAULT_GROUND_MAP_SETTINGS,
        ...settings,
        lodCategories: { ...DEFAULT_MAP_LOD_CATEGORIES, ...settings.lodCategories },
      }
    : { ...DEFAULT_GROUND_MAP_SETTINGS };
}

export function resolveGroundTilePx(): number {
  if (manualGroundTilePx != null) return clampGroundTilePx(manualGroundTilePx);
  return resolveTilePxFromSettings(activeGroundMapSettings);
}

export function setManualGroundTilePx(px: number | null): void {
  manualGroundTilePx = px != null ? clampGroundTilePx(px) : null;
}

export function getManualGroundTilePx(): number | null {
  return manualGroundTilePx;
}

function presetBaseStyles(): Record<number, ZoneGroundStyle> {
  return buildPresetGroundStyles(GROUND_STYLE, DEFAULT_ECOTONE_BRIDGE, activeGroundMapSettings);
}

/** Estilo resuelto (preset + escala + overrides de UI). */
export function getActiveGroundStyleMap(): Record<number, ZoneGroundStyle> {
  return mergeGroundStyles(presetBaseStyles(), activeGroundStyleOverride);
}

export function getGroundStyleOverride(): Record<number, ZoneGroundStyle> | null {
  if (!activeGroundStyleOverride) return null;
  backfillParkBaseLayerFromZones(activeGroundStyleOverride);
  return cloneGroundStyleMap(activeGroundStyleOverride);
}

export function setGroundStyleOverride(style: Record<number, ZoneGroundStyle> | null): void {
  activeGroundStyleOverride = style ? cloneGroundStyleMap(style) : null;
}

/** Vacía todas las capas del piso (zonas, base parque, fondo): sin elementos, macro ni ecotono. */
export function clearAllGroundLayers(): Record<number, ZoneGroundStyle> {
  const out: Record<number, ZoneGroundStyle> = {};
  const empty = emptyZoneGroundStyle();
  for (const k of GROUND_ZONE_KEYS) out[k] = cloneZoneStyle(empty);
  setGroundStyleOverride(out);
  return exportGroundStyleSnapshot();
}

export function resetGroundStyleToDefaults(): void {
  activeGroundStyleOverride = null;
  activeGroundMapSettings = { ...DEFAULT_GROUND_MAP_SETTINGS };
  manualGroundTilePx = null;
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

/** Aplica el mismo estilo a varias capas (p. ej. zonas + base parque). */
export function applyGroundStyleToLayerKeys(
  layerKeys: readonly number[],
  style: ZoneGroundStyle,
): void {
  const layerStyle = cloneZoneStyle(style);
  if (!activeGroundStyleOverride) activeGroundStyleOverride = {};
  for (const key of layerKeys) {
    activeGroundStyleOverride[key] = cloneZoneStyle(layerStyle);
  }
  const keys = layerKeys as readonly number[];
  if (keys.includes(0) && keys.includes(1) && keys.includes(2)) {
    backfillParkBaseLayerFromZones(activeGroundStyleOverride);
  }
}

/** Snapshot completo para persistencia / panel UI. */
export function exportGroundStyleSnapshot(): Record<number, ZoneGroundStyle> {
  return cloneGroundStyleMap(getActiveGroundStyleMap());
}

/** Restaura desde snapshot guardado (null = defaults de código). */
export function importGroundStyleSnapshot(
  snapshot: Record<number | string, ZoneGroundStyle> | null | undefined,
): void {
  if (!snapshot || Object.keys(snapshot).length === 0) {
    resetGroundStyleToDefaults();
    return;
  }
  const normalized = normalizeGroundStyleMapKeys(snapshot);
  backfillParkBaseLayerFromZones(normalized);
  setGroundStyleOverride(normalized);
}

/** Configs antiguas guardaban 0/1/2 pero no -1; alinear base si las zonas coinciden. */
function backfillParkBaseLayerFromZones(map: Record<number, ZoneGroundStyle>): void {
  if (map[-1] != null) return;
  const z0 = map[0];
  const z1 = map[1];
  const z2 = map[2];
  if (!z0 || !z1 || !z2) return;
  if (!zoneGroundStylesEqual(z0, z1) || !zoneGroundStylesEqual(z0, z2)) return;
  map[-1] = cloneZoneStyle(z0);
}

function parkZonesShareOverrideStyle(): ZoneGroundStyle | null {
  const o = activeGroundStyleOverride;
  if (!o) return null;
  const z0 = o[0];
  const z1 = o[1];
  const z2 = o[2];
  if (!z0 || !z1 || !z2) return null;
  if (!zoneGroundStylesEqual(z0, z1) || !zoneGroundStylesEqual(z0, z2)) return null;
  return z0;
}

function zoneGroundStylesEqual(a: ZoneGroundStyle, b: ZoneGroundStyle): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function styleForSection(sectionIndex: number): ZoneGroundStyle {
  const styles = getActiveGroundStyleMap();
  const override = activeGroundStyleOverride;

  if (sectionIndex === -1) {
    if (override && ('-1' in override || Object.prototype.hasOwnProperty.call(override, -1))) {
      return styles[-1];
    }
    const parkSync = parkZonesShareOverrideStyle();
    if (parkSync) return parkSync;
    return styles[0] ?? styles[-1] ?? emptyZoneGroundStyle();
  }

  if (styles[sectionIndex]) return styles[sectionIndex];
  if (sectionIndex === -2) return styles[-2] ?? emptyZoneGroundStyle();
  return styles[1] ?? styles[0] ?? emptyZoneGroundStyle();
}

function drawGroundElementAt(
  ctx: CanvasRenderingContext2D,
  type: GroundElementType,
  p: GroundTexturePalette,
  rand: () => number,
  span: number,
  unit: number,
  x: number,
  y: number,
  sizeMin: number,
  sizeMax: number,
  lw: number,
): void {
  const size = unit * (sizeMin + rand() * (sizeMax - sizeMin));
  switch (type) {
    case 'patch': flatPatchOne(ctx, p, rand, span, x, y, size); break;
    case 'stone': cartoonStone(ctx, p, span, x, y, size, lw); break;
    case 'grass': cartoonGrass(ctx, p, rand, span, x, y, size, lw); break;
    case 'leaf': cartoonLeaf(ctx, p, rand, span, x, y, size, lw); break;
    case 'flower': cartoonFlower(ctx, p, span, x, y, size, lw); break;
    case 'shadow': shadowSpot(ctx, p, span, x, y, size); break;
    case 'pebbles': cartoonPebbles(ctx, p, rand, span, x, y, size, lw); break;
    case 'crack': cartoonCrack(ctx, p, rand, span, x, y, size, lw); break;
    case 'bush': cartoonBush(ctx, p, span, x, y, size, lw); break;
    case 'reed': cartoonReed(ctx, p, rand, span, x, y, size, lw); break;
    case 'petal': cartoonPetal(ctx, p, rand, span, x, y, size); break;
    case 'dirt': dirtSpeck(ctx, p, rand, span, x, y, size); break;
  }
}

function paletteForSection(sectionIndex: number, isDark: boolean): GroundTexturePalette {
  if (sectionIndex === -2) return mapBackdropPalette(isDark);
  if (sectionIndex < 0) return parkBasePalette(isDark);
  return groundPaletteForSection(sectionIndex, isDark);
}

/**
 * Shell de compatibilidad: el suelo ya no usa patrón raster repetido (causaba
 * borrosidad al ampliar y deriva al hacer zoom). Los elementos se dibujan como
 * vectores en `scatterGroundElements`. Se conserva la clase para no romper a los
 * llamadores (guarda el tamaño base `tilePx` de los elementos).
 */
export class GroundPatternCache {
  private tilePx: number = resolveGroundTilePx();
  getTilePx(): number { return this.tilePx; }
  setTilePx(px: number): void { this.tilePx = clampGroundTilePx(px); }
  setLodTier(_tier: GroundLodTier): void { /* sin caché de patrón */ }
  clear(): void { /* sin caché de patrón */ }
}

/** Región rectangular en espacio mundo (para sembrar/cull de elementos). */
export interface GroundViewport {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Constante de densidad por área (heredada del sistema de baldosa: span²/64). */
const SCATTER_AREA_CONST = 64;
/** Separación mínima entre elementos (px mundo) — evita amontonar. */
const SCATTER_MIN_CELL = 5;
/** Tope de celdas iteradas por tipo de elemento (acota el coste por frame). */
const SCATTER_BUDGET = 2200;

/**
 * Dibuja UN elemento del suelo como vector en coordenadas del MUNDO, reutilizando
 * las primitivas cartoon sin su teselado (`wrapped`). El truco: trasladar el lienzo
 * y pasar un `span` enorme para que `wrapped` nunca duplique.
 */
function drawElementWorld(
  ctx: CanvasRenderingContext2D,
  type: GroundElementType,
  palette: GroundTexturePalette,
  rand: () => number,
  worldX: number,
  worldY: number,
  sizeWorld: number,
  lw: number,
): void {
  const BIG = 1e6;
  ctx.save();
  ctx.translate(worldX - BIG, worldY - BIG);
  drawGroundElementAt(ctx, type, palette, rand, BIG * 4, sizeWorld, BIG, BIG, 1, 1, lw);
  ctx.restore();
}

function intersectRegion(bbox: GroundViewport, viewport?: GroundViewport): GroundViewport {
  if (!viewport) return bbox;
  return {
    minX: Math.max(bbox.minX, viewport.minX),
    minY: Math.max(bbox.minY, viewport.minY),
    maxX: Math.min(bbox.maxX, viewport.maxX),
    maxY: Math.min(bbox.maxY, viewport.maxY),
  };
}

/**
 * Siembra elementos del suelo (piedras, hierba, hojas…) como vectores directos en
 * espacio mundo, anclados a una grilla absoluta por celda → nítidos a cualquier
 * zoom y SIN deriva al hacer pan/zoom. El número de celdas se acota por presupuesto.
 */
function scatterGroundElements(
  ctx: CanvasRenderingContext2D,
  palette: GroundTexturePalette,
  style: ZoneGroundStyle,
  sectionIndex: number,
  unit: number,
  lodTier: GroundLodTier,
  quality: number,
  region: GroundViewport,
): void {
  const rw = region.maxX - region.minX;
  const rh = region.maxY - region.minY;
  if (rw <= 0 || rh <= 0) return;
  const lw = Math.max(0.4, unit * 0.06);

  for (let ei = 0; ei < style.elements.length; ei++) {
    const el = style.elements[ei];
    if (!elementVisibleAtLod(el.type, lodTier)) continue;
    const d = Math.max(1e-4, el.density * quality) / SCATTER_AREA_CONST;
    let cell = Math.max(SCATTER_MIN_CELL, 1 / Math.sqrt(d));
    let cols = Math.ceil(rw / cell) + 1;
    let rows = Math.ceil(rh / cell) + 1;
    if (cols * rows > SCATTER_BUDGET) {
      cell *= Math.sqrt((cols * rows) / SCATTER_BUDGET);
      cols = Math.ceil(rw / cell) + 1;
      rows = Math.ceil(rh / cell) + 1;
    }
    const gx0 = Math.floor(region.minX / cell);
    const gy0 = Math.floor(region.minY / cell);
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const cellX = gx0 + gx;
        const cellY = gy0 + gy;
        const seed = (cellX * 73856093) ^ (cellY * 19349663)
          ^ ((sectionIndex + 7) * 83492791) ^ ((ei + 1) * 0x9e3779b1);
        const rand = seededRand(seed >>> 0);
        const px = (cellX + rand()) * cell;
        const py = (cellY + rand()) * cell;
        if (px < region.minX || px > region.maxX || py < region.minY || py > region.maxY) continue;
        const sizeWorld = unit * (el.sizeMin + rand() * (el.sizeMax - el.sizeMin));
        drawElementWorld(ctx, el.type, palette, rand, px, py, sizeWorld, lw);
      }
    }
  }
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
  lodTier: GroundLodTier,
): void {
  if (style.macroDensity <= 0 || style.macroAlpha <= 0) return;
  if (lodTier === 'minimal') return;
  const w = maxX - minX;
  const h = maxY - minY;
  const area = w * h;
  if (area <= 0) return;
  const seed = Math.floor(minX) * 73856093 ^ Math.floor(minY) * 19349663 ^ (sectionIndex + 5) * 83492791;
  const rand = seededRand(seed >>> 0);
  const cap = macroBlobCap(lodTier);
  const blobs = Math.max(2, Math.min(cap, Math.round((area / 9000) * style.macroDensity)));
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
  const reliefPasses = lodTier === 'all' ? 2 : 1;
  for (let i = 0; i < reliefPasses; i++) {
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

function tracePolygon(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]): void {
  ctx.beginPath();
  appendPolygonPath(ctx, points);
}

function appendPolygonPath(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]): void {
  if (points.length < 3) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function appendPolygonPathReversed(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]): void {
  if (points.length < 3) return;
  ctx.moveTo(points[points.length - 1].x, points[points.length - 1].y);
  for (let i = points.length - 2; i >= 0; i--) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function hexChannel(hex: string, i: number): number {
  const h = hex.replace('#', '');
  return parseInt(h.substring(i * 2, i * 2 + 2), 16);
}

function hexLerp(a: string, b: string, t: number): string {
  const ch = [0, 1, 2].map((i) => Math.round(hexChannel(a, i) * (1 - t) + hexChannel(b, i) * t));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function lerpPalette(a: GroundTexturePalette, b: GroundTexturePalette, t: number): GroundTexturePalette {
  return {
    base: hexLerp(a.base, b.base, t),
    accent: hexLerp(a.accent, b.accent, t),
    speck: hexLerp(a.speck, b.speck, t),
    line: hexLerp(a.line, b.line, t),
    light: hexLerp(a.light, b.light, t),
  };
}

function polygonCentroid(points: { x: number; y: number }[]): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (const p of points) { sx += p.x; sy += p.y; }
  return { x: sx / points.length, y: sy / points.length };
}

/** Iconos de transición sembrados a lo largo del perímetro, hacia el interior. */
function paintBridgeScatter(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  zonePal: GroundTexturePalette,
  basePal: GroundTexturePalette,
  bridge: EcotoneBridgeStyle,
  band: number,
  strength: number,
  sectionIndex: number,
  unit: number,
  lodTier: GroundLodTier,
  qualityMul: number,
): void {
  const scatterMul = ecotoneScatterMul(lodTier) * qualityMul;
  if (!bridge.elements.length || band <= 0 || scatterMul <= 0) return;
  const visible = bridge.elements.filter((e) => elementVisibleAtLod(e.type, lodTier));
  if (!visible.length) return;
  const lw = Math.max(0.4, unit * 0.06);
  const rand = seededRand(sectionIndex * 48271 + Math.floor(band) * 997);
  const cx = polygonCentroid(points);

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const edgeLen = Math.hypot(b.x - a.x, b.y - a.y);
    const count = Math.max(1, Math.floor(edgeLen / (unit * 2.8) * scatterMul));
    const edx = b.x - a.x;
    const edy = b.y - a.y;
    const elen = Math.hypot(edx, edy) || 1;
    let nx = -edy / elen;
    let ny = edx / elen;
    const mx = (a.x + b.x) * 0.5;
    const my = (a.y + b.y) * 0.5;
    if ((cx.x - mx) * nx + (cx.y - my) * ny < 0) { nx = -nx; ny = -ny; }

    for (let j = 0; j < count; j++) {
      const u = rand();
      const px = a.x + edx * u;
      const py = a.y + edy * u;
      const depth = rand() * band * 0.92;
      const bx = px + nx * depth;
      const by = py + ny * depth;
      const falloff = smoothstep(1 - depth / band);
      const mixT = falloff * bridge.paletteMix;
      const pal = lerpPalette(zonePal, basePal, mixT * 0.65 + 0.2);
      const el = visible[Math.floor(rand() * visible.length)];
      const sizeWorld = unit * (el.sizeMin + rand() * (el.sizeMax - el.sizeMin));
      ctx.save();
      ctx.globalAlpha = falloff * strength * 0.95;
      drawElementWorld(ctx, el.type, pal, rand, bx, by, sizeWorld, lw);
      ctx.restore();
    }
  }
}

/**
 * Puente ecotonal elaborado: fade de textura de zona + patrón de base + lavado
 * de paleta + iconos de transición en la franja del borde.
 */
function paintEcotoneBridge(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  sectionIndex: number,
  isDark: boolean,
  style: ZoneGroundStyle,
  mapScale: number,
): void {
  const band = style.edgeBlend ?? 0;
  const strength = style.edgeBlendAlpha ?? 0.85;
  if (band <= 0 || strength <= 0 || points.length < 3) return;

  const lodTier = effectiveGroundLodTier(mapScale, activeGroundMapSettings);
  const steps = ecotoneStepsForLod(lodTier);
  if (steps <= 0) return;

  const bridge = bridgeForSection(sectionIndex, style);
  const zonePal = paletteForSection(sectionIndex, isDark);
  const baseSection = sectionIndex >= 0 ? -1 : -2;
  const basePal = paletteForSection(baseSection, isDark);
  const unit = resolveGroundTilePx();

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1) Fade hacia el color de la zona vecina (anillos de color base, nítidos)
  if (bridge.basePatternMix > 0) {
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const lw = band * (1 - t) * 2 + 0.4;
      if (lw < 0.25) continue;
      ctx.strokeStyle = basePal.base;
      ctx.lineWidth = lw;
      ctx.globalAlpha = smoothstep(t) * strength * bridge.basePatternMix * 0.6;
      tracePolygon(ctx, points);
      ctx.stroke();
    }
  }

  // 2) Lavado de paleta mezclada (color plano que suaviza el salto café↔verde)
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const mixT = smoothstep(t) * bridge.paletteMix;
    const mixed = lerpPalette(zonePal, basePal, mixT);
    const lw = band * (1 - t) * 2 + 0.4;
    if (lw < 0.25) continue;
    ctx.strokeStyle = mixed.base;
    ctx.lineWidth = lw;
    ctx.globalAlpha = (0.06 + smoothstep(t) * 0.38) * strength * bridge.zoneFade;
    tracePolygon(ctx, points);
    ctx.stroke();
  }

  // 3) Acentos de luz/sombra en la franja (relieve cartoon)
  const accentSteps = lodTier === 'all' ? 4 : 2;
  for (let i = 0; i < accentSteps; i++) {
    const t = accentSteps > 1 ? i / (accentSteps - 1) : 0;
    const mixed = lerpPalette(zonePal, basePal, smoothstep(t) * 0.5);
    ctx.strokeStyle = mixed.light;
    ctx.lineWidth = band * (1 - t) * 0.55;
    ctx.globalAlpha = 0.08 * strength * (1 - t);
    tracePolygon(ctx, points);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;

  // 4) Iconos de puente (hierba, tierra, guijarros…) sembrados en la franja
  const qualityMul = groundQualityFactor(activeGroundMapSettings);
  paintBridgeScatter(ctx, points, zonePal, basePal, bridge, band, strength, sectionIndex, unit, lodTier, qualityMul);

  ctx.restore();
}

export interface GroundFillOptions {
  /** Solo color base + macro (los elementos van en pasada aparte). */
  skipElements?: boolean;
  /** Sin velo de color de contorno/zona encima de la textura. */
  skipTint?: boolean;
  skipEcotone?: boolean;
}

/**
 * Recorta al contorno del parque menos los polígonos de zona (caminos y bordes visibles).
 * Usa regla even-odd: contorno exterior + huecos por zona.
 */
export function clipParkBaseExcludingZones(
  ctx: CanvasRenderingContext2D,
  parkPoints: { x: number; y: number }[],
  zonePolygons: { x: number; y: number }[][],
): void {
  ctx.beginPath();
  appendPolygonPath(ctx, parkPoints);
  for (const hole of zonePolygons) {
    appendPolygonPathReversed(ctx, hole);
  }
  ctx.clip('evenodd');
}

/** Siembra elementos de suelo dentro del clip actual del contexto. */
export function paintSectionGroundElements(
  ctx: CanvasRenderingContext2D,
  sectionIndex: number,
  isDark: boolean,
  bbox: GroundViewport,
  mapScale: number,
  viewport?: GroundViewport,
): void {
  const style = styleForSection(sectionIndex);
  if (!style.elements.length) return;
  const palette = paletteForSection(sectionIndex, isDark);
  const lodTier = effectiveGroundLodTier(mapScale, activeGroundMapSettings);
  const quality = groundQualityFactor(activeGroundMapSettings);
  const unit = resolveGroundTilePx();
  const region = intersectRegion(bbox, viewport);
  scatterGroundElements(ctx, palette, style, sectionIndex, unit, lodTier, quality, region);
}

/**
 * Pinta el suelo de un polígono (zona o base del parque):
 *   1) color base sólido (nítido, sin deriva)  2) variación macro de relieve
 *   3) elementos vectoriales sembrados (piedras, hierba…)  4) tinte de sección
 *   5) ecotono/puente con la zona vecina.
 * `cache` se mantiene por compatibilidad de firma (ya no se usa patrón raster).
 */
export function fillPolygonWithGroundTexture(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  sectionIndex: number,
  isDark: boolean,
  tintColor: string,
  tintOpacity: number,
  _cache: GroundPatternCache,
  mapScale: number = PARK_MAP_VIS.groundRefZoom,
  viewport?: GroundViewport,
  opts?: GroundFillOptions,
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

  const style = styleForSection(sectionIndex);
  const palette = paletteForSection(sectionIndex, isDark);
  const lodTier = effectiveGroundLodTier(mapScale, activeGroundMapSettings);
  const quality = groundQualityFactor(activeGroundMapSettings);
  const unit = resolveGroundTilePx();

  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.base;
  ctx.fillRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);

  paintMacroVariation(ctx, palette, minX, minY, maxX, maxY, sectionIndex, style, lodTier);

  const region = intersectRegion({ minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad }, viewport);
  if (!opts?.skipElements) {
    scatterGroundElements(ctx, palette, style, sectionIndex, unit, lodTier, quality, region);
  }

  if (!opts?.skipTint && tintOpacity > 0) {
    ctx.fillStyle = tintColor;
    ctx.globalAlpha = tintOpacity;
    ctx.fillRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
    ctx.globalAlpha = 1;
  }

  if (!opts?.skipEcotone && (style.edgeBlend ?? 0) > 0 && sectionIndex >= -1) {
    paintEcotoneBridge(ctx, points, sectionIndex, isDark, style, mapScale);
  }

  ctx.restore();
}

/** Shell de compatibilidad — el backdrop ya no usa patrón raster. */
export class MapBackdropCache {
  private tilePx: number = resolveGroundTilePx();
  setTilePx(px: number): void { this.tilePx = clampGroundTilePx(px); }
  getTilePx(): number { return this.tilePx; }
  clear(): void { /* sin caché de patrón */ }
}

export function fillMapRectWithBackdrop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  isDark: boolean,
  _cache: MapBackdropCache,
  mapScale: number,
  viewport?: GroundViewport,
): void {
  const palette = mapBackdropPalette(isDark);
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.base;
  ctx.fillRect(x, y, w, h);

  const style = styleForSection(-2);
  const lodTier = effectiveGroundLodTier(mapScale, activeGroundMapSettings);
  const quality = groundQualityFactor(activeGroundMapSettings);
  const unit = resolveGroundTilePx();
  const region = intersectRegion({ minX: x, minY: y, maxX: x + w, maxY: y + h }, viewport);
  scatterGroundElements(ctx, palette, style, -2, unit, lodTier, quality, region);
}
