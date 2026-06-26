/**
 * Algoritmos de mapa del parque — fuente única web + scripts.
 * Android: ParkSectionResolver.kt (misma lógica, mantener en sync).
 */

/** @param {{ lat: number, lng: number }} point */
export function isPointInPolygon(point, polygon) {
  if (!polygon?.length || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Centroide simple del polígono (promedio de vértices). */
export function polygonCentroid(polygon) {
  if (!polygon?.length) return { lat: 0, lng: 0 };
  let sumLat = 0;
  let sumLng = 0;
  for (const p of polygon) {
    sumLat += p.lat;
    sumLng += p.lng;
  }
  return { lat: sumLat / polygon.length, lng: sumLng / polygon.length };
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {Array<{ name: string, polygon: Array<{lat,lng}> }>} sections
 * @returns {string|null}
 */
export function findSectionAtPoint(lat, lng, sections) {
  const point = { lat, lng };
  for (const section of sections) {
    if (isPointInPolygon(point, section.polygon)) {
      return section.name;
    }
  }
  return null;
}

/** Leyenda P0 — 3 ecosistemas (sin Mitos y Leyendas). */
export const PARK_MAP_LEGEND = [
  { name: 'Tierras Altas', swatch: '#8D6E63' },
  { name: 'Tierras Medias', swatch: '#66BB6A' },
  { name: 'Tierras Bajas', swatch: '#42A5F5' },
];
