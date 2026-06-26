import spatialRefsJson from './spatial-references.json';
import type { GeoPoint } from './park-geometry';

export type SpatialReferenceAnimation = 'none' | 'bob' | 'pulse' | 'ripple';
export type SpatialReferenceCategory = 'acceso' | 'servicio' | 'cultura' | 'paisaje';
export type SpatialReferenceMarkerStyle = 'circle' | 'pin' | 'square' | 'marker';

/** Secuencia de frames en un PNG (strip horizontal o grilla). */
export interface SpatialReferenceSpriteSheet {
  url: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps?: number;
  columns?: number;
}

export interface SpatialReferenceEducation {
  summary: string;
  referenceImageUrl?: string;
}

export interface SpatialReference {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: SpatialReferenceCategory;
  icon: string;
  /** Animación procedural si no hay sprite/imagen. */
  animation?: SpatialReferenceAnimation;
  /** Resumen corto (legacy; también en education). */
  summary: string;
  education?: SpatialReferenceEducation;
  visible: boolean;
  /** Estilo del botón/marcador en mapa (default: circle). */
  markerStyle?: SpatialReferenceMarkerStyle;
  /** PNG estático (una sola imagen). */
  imageUrl?: string;
  /** Secuencia de frames en sprite sheet. */
  spriteSheet?: SpatialReferenceSpriteSheet;
  /** Tamaño en px de pantalla (default 48). */
  displaySize?: number;
}

export const SPATIAL_REFERENCE_MARKER_STYLES: SpatialReferenceMarkerStyle[] = [
  'circle', 'pin', 'square', 'marker',
];

export function spatialReferenceSummary(ref: SpatialReference): string {
  return ref.education?.summary?.trim() || ref.summary?.trim() || '';
}

export function spatialReferenceImageUrl(ref: SpatialReference): string | undefined {
  return ref.education?.referenceImageUrl || ref.imageUrl;
}

interface SpatialReferencesFile {
  version: number;
  references: SpatialReference[];
}

const file = spatialRefsJson as SpatialReferencesFile;

export function cloneSpatialReferences(): SpatialReference[] {
  return file.references.map((r) => ({ ...r }));
}

export const SPATIAL_REFERENCE_CATEGORY_COLORS: Record<SpatialReferenceCategory, string> = {
  acceso: '#2E7D32',
  servicio: '#FF9E67',
  cultura: '#7E57C2',
  paisaje: '#43A047',
};

/** Desplazamiento Y en px de pantalla según animación. */
export function   spatialReferenceAnimOffset(
  animation: SpatialReferenceAnimation | undefined,
  phase: number,
  index: number,
): { dy: number; scale: number; ripple: number } {
  const mode = animation ?? 'none';
  const t = phase + index * 0.7;
  switch (mode) {
    case 'bob':
      return { dy: Math.sin(t * 2.2) * 5, scale: 1, ripple: 0 };
    case 'pulse':
      return { dy: 0, scale: 1 + Math.sin(t * 3) * 0.06, ripple: 0 };
    case 'ripple':
      return { dy: 0, scale: 1, ripple: (Math.sin(t * 2.5) + 1) * 0.5 };
    default:
      return { dy: 0, scale: 1, ripple: 0 };
  }
}

export function exportSpatialReferencesJson(refs: SpatialReference[]): string {
  return JSON.stringify(
    {
      version: 1,
      source: 'web-admin-scene-editor',
      syncedAt: new Date().toISOString(),
      references: refs.map((r) => ({
        ...r,
        lat: Number(r.lat.toFixed(8)),
        lng: Number(r.lng.toFixed(8)),
      })),
    },
    null,
    2,
  );
}

export function isGeoInPark(geo: GeoPoint, boundary: GeoPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const xi = boundary[i].lng;
    const yi = boundary[i].lat;
    const xj = boundary[j].lng;
    const yj = boundary[j].lat;
    const intersect = (yi > geo.lat) !== (yj > geo.lat)
      && geo.lng < ((xj - xi) * (geo.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
