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
  treeMinWorld: 3.2,
  /** Baldosa por defecto (px espacio mapa). Más bajo = grano más fino. */
  groundTilePx: 5,
  groundTileMin: 2,
  groundTileMax: 48,
  zoomMin: 0.08,
  zoomMax: 120,
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

/**
 * Compensa el zoom para que el grano en pantalla se mantenga ~constante.
 * Antes había tope 2.2: al acercar, las baldosas se “inflaban” y la textura desaparecía.
 */
export function parkGroundPatternDensity(mapScale: number): number {
  const ref = PARK_MAP_VIS.groundRefZoom;
  return Math.max(0.85, mapScale / ref);
}

export function parkGroundTintOpacity(sectionFillOpacity: number): number {
  return Math.min(sectionFillOpacity * PARK_MAP_VIS.groundTintMul, PARK_MAP_VIS.groundTintMax);
}

export function clampGroundTilePx(px: number): number {
  return Math.round(Math.min(PARK_MAP_VIS.groundTileMax, Math.max(PARK_MAP_VIS.groundTileMin, px)));
}
