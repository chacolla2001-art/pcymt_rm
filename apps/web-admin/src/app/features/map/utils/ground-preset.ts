import { clampGroundTilePx } from './map-park-visual-scale';
import type {
  EcotoneBridgeStyle,
  GroundElementSpec,
  GroundElementType,
  ZoneGroundStyle,
} from './draw-ground-texture';

/**
 * Presets de estilo del suelo.
 *
 * Modelo mental: el admin elige una RECETA (preset) y luego ajusta dos diales:
 *   • «Tamaño» (scalePercent): escala densidad + tamaño de iconos de forma
 *     proporcional — el único dial principal que pidió el usuario.
 *   • «Calidad» (qualityPercent): reduce SOLO el número de texturas para ganar
 *     rendimiento sin cambiar la apariencia/tamaño de cada elemento.
 *
 * El zoom aplica además LOD: al alejar, piedras/plantas finas desaparecen como
 * en la vida real (ver `groundLodTier`).
 */
export type GroundPresetId = 'performance' | 'subtle' | 'balanced' | 'rich' | 'carbot';

export interface GroundPresetDefinition {
  id: GroundPresetId;
  label: string;
  hint: string;
  /** Multiplicador de tamaño/densidad del preset (antes del dial «Tamaño»). */
  recipeScale: number;
  /** Calidad base sugerida (0–1). Más bajo = menos texturas = más rápido. */
  baseQuality: number;
  /** Grano base recomendado (px mundo). */
  baseTilePx: number;
}

export const GROUND_PRESETS: GroundPresetDefinition[] = [
  {
    id: 'performance',
    label: 'Rendimiento',
    hint: 'Menos texturas y grano grueso — prioriza fluidez en equipos lentos.',
    recipeScale: 0.85,
    baseQuality: 0.45,
    baseTilePx: 8,
  },
  {
    id: 'subtle',
    label: 'Sutil',
    hint: 'Poco detalle, transiciones suaves, ideal mapa alejado.',
    recipeScale: 0.78,
    baseQuality: 0.7,
    baseTilePx: 6,
  },
  {
    id: 'balanced',
    label: 'Equilibrado',
    hint: 'Preset recomendado — detalle medio y buen rendimiento.',
    recipeScale: 1,
    baseQuality: 0.85,
    baseTilePx: 5,
  },
  {
    id: 'rich',
    label: 'Rico',
    hint: 'Más iconos, puente ancho, para edición cercana.',
    recipeScale: 1.38,
    baseQuality: 1,
    baseTilePx: 4,
  },
  {
    id: 'carbot',
    label: 'Carbot',
    hint: 'Máximo detalle cartoon — usar con LOD activo.',
    recipeScale: 1.72,
    baseQuality: 1,
    baseTilePx: 4,
  },
];

export function findGroundPreset(id: GroundPresetId): GroundPresetDefinition {
  return GROUND_PRESETS.find((p) => p.id === id) ?? GROUND_PRESETS[2];
}

/** Configuración global del suelo (UI + persistencia). */
export interface GroundMapSettings {
  presetId: GroundPresetId;
  /** Tamaño general 50–200 % — escala densidades, iconos, ecotono y grano. */
  scalePercent: number;
  /** Calidad 25–100 % — reduce el número de texturas para mejorar rendimiento. */
  qualityPercent: number;
  lodEnabled: boolean;
  /** Por debajo de este zoom (escala mapa) se ocultan detalles finos (piedras, flores…). */
  lodFineZoom: number;
  /** Por debajo de este zoom se ocultan hierba, hojas, arbustos. */
  lodMediumZoom: number;
  /** Por debajo de este zoom el ecotono se simplifica mucho. */
  lodEcotoneZoom: number;
}

export const DEFAULT_GROUND_MAP_SETTINGS: GroundMapSettings = {
  presetId: 'balanced',
  scalePercent: 100,
  qualityPercent: 85,
  lodEnabled: true,
  lodFineZoom: 0.95,
  lodMediumZoom: 0.55,
  lodEcotoneZoom: 0.35,
};

/** Settings sugeridos al elegir un preset (calidad/grano coherentes con la receta). */
export function settingsForPreset(
  presetId: GroundPresetId,
  prev: GroundMapSettings,
): GroundMapSettings {
  const preset = findGroundPreset(presetId);
  return {
    ...prev,
    presetId,
    qualityPercent: Math.round(preset.baseQuality * 100),
    lodEnabled: presetId === 'performance' ? true : prev.lodEnabled,
  };
}

/** LOD — detalle fino (desaparece al alejar, como en la vida real). */
export const GROUND_LOD_FINE = new Set<GroundElementType>([
  'stone', 'pebbles', 'flower', 'petal', 'crack', 'dirt', 'reed',
]);

/** LOD — detalle medio. */
export const GROUND_LOD_MEDIUM = new Set<GroundElementType>([
  'grass', 'leaf', 'bush',
]);

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * `sizeFactor` escala tamaño y (parte de) densidad; `densityFactor` controla el
 * número de elementos (tamaño × calidad). Separarlos permite bajar calidad sin
 * achicar los iconos.
 */
function scaleElement(el: GroundElementSpec, sizeFactor: number, densityFactor: number): GroundElementSpec {
  const sizeMul = Math.pow(sizeFactor, 0.72);
  return {
    ...el,
    density: clamp(el.density * densityFactor, 0, 1.35),
    min: el.min != null ? Math.max(0, Math.round(el.min * densityFactor)) : undefined,
    sizeMin: el.sizeMin * sizeMul,
    sizeMax: el.sizeMax * sizeMul,
  };
}

function scaleBridge(b: EcotoneBridgeStyle, sizeFactor: number, densityFactor: number): EcotoneBridgeStyle {
  const sizeMul = Math.pow(sizeFactor, 0.72);
  return {
    paletteMix: b.paletteMix,
    basePatternMix: b.basePatternMix,
    zoneFade: b.zoneFade,
    elements: b.elements.map((e) => ({
      ...e,
      density: clamp(e.density * densityFactor, 0, 1.35),
      min: e.min != null ? Math.max(0, Math.round((e.min ?? 0) * densityFactor)) : undefined,
      sizeMin: e.sizeMin * sizeMul,
      sizeMax: e.sizeMax * sizeMul,
    })),
  };
}

function cloneZoneStyle(z: ZoneGroundStyle): ZoneGroundStyle {
  return {
    macroDensity: z.macroDensity,
    macroAlpha: z.macroAlpha,
    edgeBlend: z.edgeBlend,
    edgeBlendAlpha: z.edgeBlendAlpha,
    bridge: z.bridge ? scaleBridge(z.bridge, 1, 1) : undefined,
    elements: z.elements.map((e) => ({ ...e })),
  };
}

function cloneGroundStyleMapLocal(src: Record<number, ZoneGroundStyle>): Record<number, ZoneGroundStyle> {
  const out: Record<number, ZoneGroundStyle> = {};
  for (const [k, v] of Object.entries(src)) out[Number(k)] = cloneZoneStyle(v);
  return out;
}

export function scaleZoneStyle(
  zone: ZoneGroundStyle,
  sizeFactor: number,
  densityFactor: number = sizeFactor,
): ZoneGroundStyle {
  const edgeMul = Math.pow(sizeFactor, 0.85);
  return {
    macroDensity: clamp(zone.macroDensity * densityFactor, 0, 2.2),
    macroAlpha: zone.macroAlpha,
    edgeBlend: Math.round((zone.edgeBlend ?? 0) * edgeMul),
    edgeBlendAlpha: zone.edgeBlendAlpha,
    bridge: zone.bridge ? scaleBridge(zone.bridge, sizeFactor, densityFactor) : undefined,
    elements: zone.elements.map((e) => scaleElement(e, sizeFactor, densityFactor)),
  };
}

/** Factor de tamaño = receta del preset × dial «Tamaño» (50–200 %). */
export function groundScaleFactor(settings: GroundMapSettings): number {
  return findGroundPreset(settings.presetId).recipeScale * (settings.scalePercent / 100);
}

/** Factor de calidad (solo afecta cantidad de texturas, no su tamaño). */
export function groundQualityFactor(settings: GroundMapSettings): number {
  return clamp(settings.qualityPercent / 100, 0.25, 1.2);
}

/** Densidad final = tamaño × calidad. */
export function groundDensityFactor(settings: GroundMapSettings): number {
  return groundScaleFactor(settings) * groundQualityFactor(settings);
}

export function resolveTilePxFromSettings(settings: GroundMapSettings): number {
  const preset = findGroundPreset(settings.presetId);
  const factor = groundScaleFactor(settings);
  const tileMul = Math.pow(factor, 0.55);
  // Calidad baja → grano un poco más grueso (menos repetición = más rápido).
  const qualityTileBoost = 1 + (1 - groundQualityFactor(settings)) * 0.6;
  return clampGroundTilePx(Math.round((preset.baseTilePx / tileMul) * qualityTileBoost));
}

/** Estilos base del preset+escala+calidad (sin overrides manuales por zona). */
export function buildPresetGroundStyles(
  baseStyles: Record<number, ZoneGroundStyle>,
  bridgeDefaults: Record<number, EcotoneBridgeStyle>,
  settings: GroundMapSettings,
): Record<number, ZoneGroundStyle> {
  const sizeFactor = groundScaleFactor(settings);
  const densityFactor = groundDensityFactor(settings);
  const out: Record<number, ZoneGroundStyle> = {};
  for (const [k, zone] of Object.entries(baseStyles)) {
    const idx = Number(k);
    const scaled = scaleZoneStyle(zone, sizeFactor, densityFactor);
    const bridgeBase = bridgeDefaults[idx];
    if (bridgeBase && !scaled.bridge) {
      scaled.bridge = scaleBridge(bridgeBase, sizeFactor, densityFactor);
    }
    out[idx] = scaled;
  }
  return out;
}

export function mergeGroundStyles(
  base: Record<number, ZoneGroundStyle>,
  overrides: Record<number, ZoneGroundStyle> | null,
): Record<number, ZoneGroundStyle> {
  if (!overrides) return cloneGroundStyleMapLocal(base);
  const merged = cloneGroundStyleMapLocal(base);
  for (const [k, v] of Object.entries(overrides)) {
    merged[Number(k)] = { ...v, elements: v.elements.map((e) => ({ ...e })) };
  }
  return merged;
}

export type GroundLodTier = 'all' | 'medium' | 'coarse' | 'minimal';

export function groundLodTier(mapScale: number, settings: GroundMapSettings): GroundLodTier {
  if (!settings.lodEnabled) return 'all';
  if (mapScale < settings.lodEcotoneZoom * 0.85) return 'minimal';
  if (mapScale < settings.lodMediumZoom) return 'coarse';
  if (mapScale < settings.lodFineZoom) return 'medium';
  return 'all';
}

export function elementVisibleAtLod(type: GroundElementType, tier: GroundLodTier): boolean {
  if (tier === 'all') return true;
  if (tier === 'minimal') return type === 'patch';
  if (tier === 'coarse') return type === 'patch' || type === 'shadow';
  if (tier === 'medium') return !GROUND_LOD_FINE.has(type);
  return true;
}

export function ecotoneStepsForLod(tier: GroundLodTier): number {
  switch (tier) {
    case 'all': return 8;
    case 'medium': return 5;
    case 'coarse': return 3;
    default: return 0;
  }
}

export function ecotoneScatterMul(tier: GroundLodTier): number {
  switch (tier) {
    case 'all': return 1;
    case 'medium': return 0.55;
    case 'coarse': return 0.25;
    default: return 0;
  }
}

export function macroBlobCap(tier: GroundLodTier): number {
  switch (tier) {
    case 'all': return 28;
    case 'medium': return 16;
    case 'coarse': return 8;
    default: return 4;
  }
}
