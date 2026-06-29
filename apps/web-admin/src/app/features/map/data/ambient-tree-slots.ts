import type { GeoPoint } from './park-geometry';
import { isPointInPolygon } from '../utils/park-map.util';
import {
  GROUND_PARK_LAYER_KEYS,
  GROUND_ZONE_KEYS,
  GROUND_ZONE_LABELS,
} from '../utils/draw-ground-texture';

/** Mismas capas que el suelo: 0/1/2 zonas, -1 base parque, -2 fondo mapa. */
export const TREE_BASE_PARK_SECTION = -1;
export const TREE_BACKDROP_SECTION = -2;

/** @deprecated alias v2 — usar TREE_BACKDROP_SECTION */
export const BACKDROP_TREE_SECTION = TREE_BACKDROP_SECTION;

export type TreeEditorTarget = number | 'park';

export { GROUND_ZONE_KEYS as TREE_ZONE_KEYS, GROUND_ZONE_LABELS as TREE_ZONE_LABELS };
export { GROUND_PARK_LAYER_KEYS as TREE_PARK_LAYER_KEYS };

export function isTreeInParkLayers(section: number): boolean {
  return (GROUND_PARK_LAYER_KEYS as readonly number[]).includes(section);
}

export function treeMatchesEditorTarget(section: number, target: TreeEditorTarget): boolean {
  if (target === 'park') {
    return isTreeInParkLayers(section) || section === TREE_BACKDROP_SECTION;
  }
  return section === target;
}

export function treeSectionLabel(section: number): string {
  if (section >= 0 && section <= 2) return GROUND_ZONE_LABELS[section] ?? `Zona ${section}`;
  return GROUND_ZONE_LABELS[section] ?? `Capa ${section}`;
}

export interface AmbientTreeSlot {
  lat: number;
  lng: number;
  /** 0/1/2 ecosistema, -1 base parque, -2 fondo (igual que capas del suelo). */
  section: number;
  variant: 0 | 1 | 2;
  seed: number;
  scale: number;
  /** Paleta cuando section es -1 o -2. */
  styleSection?: number;
}

export const TREE_VARIANT_LABELS: ReadonlyArray<string> = ['Silueta A', 'Silueta B', 'Silueta C'];
export const TREE_ECO_LABELS: ReadonlyArray<string> = ['Tierras Altas', 'Tierras Medias', 'Tierras Bajas'];

export const AMBIENT_TREE_SLOTS: AmbientTreeSlot[] = [
  { lat: -16.48822279, lng: -68.14600518, section: 0, variant: 2, seed: 4.75, scale: 1.138 },
  { lat: -16.48702826, lng: -68.14591436, section: 0, variant: 2, seed: 11.26, scale: 0.891 },
  { lat: -16.48804369, lng: -68.14604306, section: 0, variant: 1, seed: 28.62, scale: 1.18 },
  { lat: -16.48819447, lng: -68.14649306, section: 0, variant: 0, seed: 32.96, scale: 1.069 },
  { lat: -16.48810112, lng: -68.14576065, section: 0, variant: 2, seed: 37.3, scale: 0.885 },
  { lat: -16.48673272, lng: -68.14592364, section: 0, variant: 1, seed: 41.64, scale: 1.095 },
  { lat: -16.48771081, lng: -68.14622691, section: 0, variant: 2, seed: 50.32, scale: 1.178 },
  { lat: -16.48800473, lng: -68.1461106, section: 0, variant: 1, seed: 54.66, scale: 1.208 },
  { lat: -16.4874639, lng: -68.14626919, section: 0, variant: 2, seed: 56.83, scale: 1.188 },
  { lat: -16.48831249, lng: -68.14617144, section: 0, variant: 2, seed: 63.34, scale: 0.983 },
  { lat: -16.49011044, lng: -68.14558842, section: 1, variant: 0, seed: 72.02, scale: 1.173 },
  { lat: -16.48954292, lng: -68.14551637, section: 1, variant: 1, seed: 74.19, scale: 1.08 },
  { lat: -16.49011318, lng: -68.14549336, section: 1, variant: 0, seed: 78.53, scale: 0.909 },
  { lat: -16.48842893, lng: -68.14615452, section: 1, variant: 1, seed: 80.7, scale: 0.864 },
  { lat: -16.48861154, lng: -68.1456705, section: 1, variant: 1, seed: 87.21, scale: 0.971 },
  { lat: -16.48918207, lng: -68.14552846, section: 1, variant: 0, seed: 91.55, scale: 0.953 },
  { lat: -16.49007822, lng: -68.14523871, section: 1, variant: 0, seed: 111.08, scale: 1.106 },
  { lat: -16.48961432, lng: -68.14533963, section: 1, variant: 0, seed: 117.59, scale: 1.052 },
  { lat: -16.49005652, lng: -68.14542795, section: 1, variant: 0, seed: 124.1, scale: 1.197 },
  { lat: -16.48939389, lng: -68.14512466, section: 1, variant: 1, seed: 126.27, scale: 1.055 },
  { lat: -16.49039611, lng: -68.14533905, section: 2, variant: 0, seed: 130.61, scale: 1.126 },
  { lat: -16.49067518, lng: -68.14503949, section: 2, variant: 2, seed: 134.95, scale: 1.151 },
  { lat: -16.49049368, lng: -68.14506696, section: 2, variant: 1, seed: 139.29, scale: 1.004 },
  { lat: -16.49080794, lng: -68.14524387, section: 2, variant: 2, seed: 141.46, scale: 1.132 },
  { lat: -16.49070896, lng: -68.14520687, section: 2, variant: 0, seed: 143.63, scale: 0.903 },
  { lat: -16.49036277, lng: -68.14548612, section: 2, variant: 2, seed: 154.48, scale: 1.095 },
  { lat: -16.49065775, lng: -68.14496965, section: 2, variant: 0, seed: 156.65, scale: 0.974 },
  { lat: -16.49037134, lng: -68.1453246, section: 2, variant: 1, seed: 158.82, scale: 1.028 },
  { lat: -16.49034909, lng: -68.14470357, section: 2, variant: 1, seed: 171.84, scale: 1.21 },
  { lat: -16.49040532, lng: -68.14535393, section: 2, variant: 2, seed: 174.01, scale: 0.89 },
];

export function isBackdropTreeSlot(slot: AmbientTreeSlot): boolean {
  return slot.section === TREE_BACKDROP_SECTION;
}

export function isBaseParkTreeSlot(slot: AmbientTreeSlot): boolean {
  return slot.section === TREE_BASE_PARK_SECTION;
}

export function needsTreeStyleSection(section: number): boolean {
  return section === TREE_BASE_PARK_SECTION || section === TREE_BACKDROP_SECTION;
}

export function paletteSectionForTree(slot: AmbientTreeSlot): number {
  if (needsTreeStyleSection(slot.section)) {
    const s = slot.styleSection ?? 1;
    return Math.min(2, Math.max(0, Math.floor(s)));
  }
  return Math.min(2, Math.max(0, slot.section));
}

/** v2 usaba -1=fondo y -2=base; v3 alinea con capas del suelo. */
export function migrateTreeSectionFromV2(section: number): number {
  if (section === -1) return TREE_BACKDROP_SECTION;
  if (section === -2) return TREE_BASE_PARK_SECTION;
  return section;
}

export function migrateAmbientTreeSlots(
  slots: AmbientTreeSlot[],
  fileVersion = 3,
): AmbientTreeSlot[] {
  if (fileVersion >= 3) {
    return slots.map((s) => ({ ...s }));
  }
  return slots.map((s) => ({
    ...s,
    section: migrateTreeSectionFromV2(s.section),
  }));
}

/** Dentro del parque: zona 0/1/2 o base (-1). null = fuera del contorno. */
export function resolveTreePlacementSection(
  geo: GeoPoint,
  sections: Array<{ name: string; polygon: GeoPoint[] }>,
  boundary: GeoPoint[],
): number | null {
  if (!boundary.length || !isPointInPolygon(geo, boundary)) return null;
  for (let i = 0; i < sections.length; i++) {
    if (isPointInPolygon(geo, sections[i].polygon)) return i;
  }
  return TREE_BASE_PARK_SECTION;
}

/** Fuera del contorno pero en el marco cercano (misma zona visual que el suelo -2). */
export function isGeoInParkBackdropFrame(
  geo: GeoPoint,
  boundary: GeoPoint[],
  paddingDeg = 0.004,
): boolean {
  return isGeoInBackdropFrame(geo, boundary, paddingDeg);
}

/** @deprecated usar isGeoInParkBackdropFrame */
export function isTreeParkBaseFrame(
  geo: GeoPoint,
  boundary: GeoPoint[],
): boolean {
  return isGeoInParkBackdropFrame(geo, boundary);
}

/** Click válido en capa base (-1): solo dentro del contorno del parque. */
export function canPlaceTreeOnBaseParkLayer(
  geo: GeoPoint,
  boundary: GeoPoint[],
): boolean {
  return boundary.length > 0 && isPointInPolygon(geo, boundary);
}

/** Click válido en fondo (-2): marco exterior inmediato (fuera del contorno). */
export function canPlaceTreeOnBackdropLayer(
  geo: GeoPoint,
  boundary: GeoPoint[],
): boolean {
  return isGeoInParkBackdropFrame(geo, boundary);
}

/**
 * Modo «Todo el parque (sin fondo)»: zonas + base interior + marco (-2).
 * No incluye el fondo lejano fuera del marco.
 */
export function resolveTreePlacementForParkMode(
  geo: GeoPoint,
  sections: Array<{ name: string; polygon: GeoPoint[] }>,
  boundary: GeoPoint[],
): number | null {
  const inside = resolveTreePlacementSection(geo, sections, boundary);
  if (inside !== null) return inside;
  if (isGeoInParkBackdropFrame(geo, boundary)) return TREE_BACKDROP_SECTION;
  return null;
}

export function canPlaceTreeInParkMode(
  geo: GeoPoint,
  sections: Array<{ name: string; polygon: GeoPoint[] }>,
  boundary: GeoPoint[],
): boolean {
  return resolveTreePlacementForParkMode(geo, sections, boundary) !== null;
}

export function isGeoInBackdropFrame(
  geo: GeoPoint,
  boundary: GeoPoint[],
  paddingDeg = 0.004,
): boolean {
  if (!boundary.length) return false;
  if (isPointInPolygon(geo, boundary)) return false;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of boundary) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return geo.lat >= minLat - paddingDeg
    && geo.lat <= maxLat + paddingDeg
    && geo.lng >= minLng - paddingDeg
    && geo.lng <= maxLng + paddingDeg;
}

export function cloneAmbientTreeSlots(slots: AmbientTreeSlot[]): AmbientTreeSlot[] {
  return slots.map((s) => ({ ...s }));
}

export function exportAmbientTreesJson(slots: AmbientTreeSlot[]): string {
  return JSON.stringify(
    {
      version: 3,
      source: 'web-admin-manual-edit',
      syncedAt: new Date().toISOString(),
      trees: slots.map((t) => ({
        lat: Number(t.lat.toFixed(8)),
        lng: Number(t.lng.toFixed(8)),
        section: t.section,
        variant: t.variant,
        seed: t.seed,
        scale: t.scale,
        ...(t.styleSection != null ? { styleSection: t.styleSection } : {}),
      })),
    },
    null,
    2,
  );
}
