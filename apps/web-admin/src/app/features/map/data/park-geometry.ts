import boundaryJson from './park-boundary.json';
import sectionsJson from './park-sections.json';
import { syncSectionFillColors } from '../utils/section-color.util';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ParkSection {
  name: string;
  color: string;
  colorLight: string;
  polygon: GeoPoint[];
}

interface ParkBoundaryFile {
  coordinates: GeoPoint[];
  centroid?: GeoPoint;
  boundingBox?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

export interface SectionEducation {
  summary: string;
  referenceImageUrl?: string;
}

export interface ParkSectionRecord {
  id: string;
  code: string;
  semanticKey: string;
  chartColor: string;
  name: string;
  /** Opacidad del relleno del polígono en mapa (tema oscuro), 0 = solo contorno. */
  fillOpacity?: number;
  /** Opacidad del relleno en tema claro. */
  fillOpacityLight?: number;
  colors: { webFill: string; webFillLight: string };
  polygon: GeoPoint[];
  education?: SectionEducation;
}

interface ParkSectionsFile {
  version?: number;
  source?: string;
  partition?: string;
  sections: ParkSectionRecord[];
}

const boundaryFile = boundaryJson as ParkBoundaryFile;
const sectionsFile = sectionsJson as ParkSectionsFile;

/** Polígono del parque — fuente única: shared/data/park-boundary.json */
export const PARK_BOUNDARY: GeoPoint[] = boundaryFile.coordinates;

/** Centroide por área (OSM way/641677241) — proyección WGS84 del mapa. */
export const PARK_CENTER: GeoPoint = boundaryFile.centroid ?? {
  lat: -16.48890769,
  lng: -68.14567761,
};

export const PARK_BOUNDS = boundaryFile.boundingBox ?? {
  minLat: -16.4919539,
  maxLat: -16.4866356,
  minLng: -68.146852,
  maxLng: -68.1446378,
};

/** Secciones completas (metadatos + polígono) — shared/data/park-sections.json */
export const PARK_SECTION_RECORDS: ParkSectionRecord[] = sectionsFile.sections;

/** Secciones del parque — fuente única: shared/data/park-sections.json */
export const PARK_SECTIONS: ParkSection[] = sectionsFile.sections.map((section) => ({
  name: section.name,
  color: section.colors.webFill,
  colorLight: section.colors.webFillLight,
  polygon: section.polygon,
}));

/** Copia editable para el editor de polígonos en web-admin. */
export function cloneParkSectionRecords(): ParkSectionRecord[] {
  return sectionsFile.sections.map((section) => {
    const copy: ParkSectionRecord = {
      ...section,
      colors: { ...section.colors },
      polygon: section.polygon.map((p) => ({ ...p })),
      education: {
        summary: section.education?.summary ?? defaultEducationSummary(section.name),
        referenceImageUrl: section.education?.referenceImageUrl ?? '',
      },
    };
    return syncSectionFillColors(copy);
  });
}

function defaultEducationSummary(name: string): string {
  const defaults: Record<string, string> = {
    'Tierras Altas':
      'Zona del altiplano y bosques nublados: frío, viento y especies adaptadas a la altura, como el oso andino.',
    'Tierras Medias':
      'Valles interandinos y Yungas: clima templado, agricultura y fauna de transición entre montaña y llanura.',
    'Tierras Bajas':
      'Selva amazónica y llanos orientales: humedad, biodiversidad y especies de las tierras bajas bolivianas.',
  };
  return defaults[name] ?? '';
}

/** Colores de gráficos por sección */
export const PARK_SECTION_CHART_COLORS: Record<string, string> = Object.fromEntries(
  sectionsFile.sections.map((s) => [
    s.name,
    (s as { chartColor?: string }).chartColor ?? '#9E9E9E',
  ]),
);
