import { PARK_BOUNDARY, PARK_SECTIONS, GeoPoint, ParkSection } from '../data/park-geometry';
import {
  findSectionAtPoint,
  isPointInPolygon,
  polygonCentroid,
  PARK_MAP_LEGEND,
} from '../../../../../../../shared/map/park-map-core.mjs';

export { isPointInPolygon, polygonCentroid, PARK_MAP_LEGEND };

export function findParkSectionAt(
  lat: number,
  lng: number,
  sections: Array<{ name: string; polygon: GeoPoint[] }> = PARK_SECTIONS,
): string | null {
  return findSectionAtPoint(lat, lng, sections);
}

export function isInsidePark(point: GeoPoint): boolean {
  return isPointInPolygon(point, PARK_BOUNDARY);
}

/** Dentro del plano cuadrado del mapa (esquinas en geo). */
export function isGeoInMapPlate(geo: GeoPoint, plateCorners: GeoPoint[]): boolean {
  return plateCorners.length >= 3 && isPointInPolygon(geo, plateCorners);
}

export function sectionLabelCentroids(
  sections: Array<{ name: string; polygon: GeoPoint[] }> = PARK_SECTIONS,
): Array<{ name: string; geo: GeoPoint }> {
  return sections.map((section) => ({
    name: section.name,
    geo: polygonCentroid(section.polygon),
  }));
}

/** Vista ligera para dibujo del mapa. */
export function toParkSectionsView(records: Array<{ name: string; colors: { webFill: string; webFillLight: string }; polygon: GeoPoint[] }>): ParkSection[] {
  return records.map((s) => ({
    name: s.name,
    color: s.colors.webFill,
    colorLight: s.colors.webFillLight,
    polygon: s.polygon,
  }));
}
