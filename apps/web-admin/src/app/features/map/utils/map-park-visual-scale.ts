/**
 * Escala visual unificada — mapa geográfico de parque completo
 * (~500–700 px de ancho en canvas con zoom típico 1.0–1.5).
 */
export const PARK_MAP_VIS = {
  ambientScreen: 0.36,
  ambientZoomExp: 0.4,
  planRadius: 0.52,
  particleCount: 0.62,
  treeBaseWorld: 8,
  /** Altura mínima dibujada de un árbol (px mundo), tras escala global y por-slot. */
  treeMinWorld: 0.5,
  /** Baldosa por defecto (px espacio mapa). Más bajo = grano más fino. */
  groundTilePx: 5,
  groundTileMin: 0.25,
  groundTileMax: 128,
  /** Sliders «Tamaño mín/máx» de cada elemento (% de unit; 0 = suelo mínimo). */
  groundElementSizePctMin: 0,
  groundElementSizePctMax: 600,
  /** Fracción mínima de unit (0.1 % cuando el slider está en 0). */
  groundElementMinFrac: 0.001,
  /** Slider «Tamaño general» del preset de suelo. */
  groundScalePercentMin: 5,
  groundScalePercentMax: 400,
  /** Escala global de árboles (multiplicador; 0.02 = 2 % en UI). */
  treesSizeMulMin: 0.02,
  treesSizeMulMax: 2.5,
  treesSizePctMin: 2,
  treesSizePctMax: 200,
  /** Escala por árbol colocado (slot.scale). */
  treeSlotScaleMin: 0.12,
  treeSlotScaleMax: 2,
  treeSlotScalePctMin: 12,
  treeSlotScalePctMax: 200,
  zoomMin: 0.03,
  zoomMax: 240,
  zoomWheelOut: 0.8,
  zoomWheelIn: 1.25,
  zoomButtonFactor: 1.5,
  parkBaseTintDark: 0.12,
  parkBaseTintLight: 0.14,
  groundRefZoom: 1.15,
  /** Tinte de zona — si es alto, tapa la textura procedural. */
  groundTintMax: 0.16,
  groundTintMul: 0.22,
  sectionStroke: 1.6,
  sectionStrokeHover: 2.4,
  sectionStrokeActive: 2.1,
} as const;

export function parkAmbientScreenScale(screenScale: number, sizeMul: number): number {
  const zoom = Math.pow(Math.max(0.22, screenScale), PARK_MAP_VIS.ambientZoomExp);
  return zoom * sizeMul * PARK_MAP_VIS.ambientScreen;
}

export function parkPlanSize(base: number): number {
  return base * PARK_MAP_VIS.planRadius;
}

export function parkParticleTarget(low: number, high: number, intensity: number): number {
  const t = Math.max(0.12, intensity);
  return Math.max(1, Math.floor((low + (high - low) * t) * PARK_MAP_VIS.particleCount));
}

export function parkGroundTintOpacity(sectionFillOpacity: number): number {
  return Math.min(sectionFillOpacity * PARK_MAP_VIS.groundTintMul, PARK_MAP_VIS.groundTintMax);
}

export function clampGroundTilePx(px: number): number {
  const v = Math.min(PARK_MAP_VIS.groundTileMax, Math.max(PARK_MAP_VIS.groundTileMin, px));
  return Math.round(v * 4) / 4;
}

/** Convierte % del slider de elemento de suelo → fracción de unit (mín. 0.1 %). */
export function groundElementSizeFrac(percent: number): number {
  const p = Number(percent) || 0;
  if (p <= 0) return PARK_MAP_VIS.groundElementMinFrac;
  return Math.max(PARK_MAP_VIS.groundElementMinFrac, p / 100);
}
