#!/usr/bin/env node
/**
 * Sincroniza park-boundary.json y park-sections.json desde OpenStreetMap (way/641677241).
 * Fuente equivalente a Google Maps (imagen satélite + contribuidores OSM).
 *
 * Uso: node scripts/sync-park-geometry-from-osm.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  isPointInPolygon,
  polygonCentroid,
} from '../shared/map/park-map-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'shared/data');
const OSM_WAY_ID = 641677241;
const PRECISION = 8;

const SECTION_META = [
  {
    name: 'Tierras Altas',
    id: '1',
    code: 'highlands',
    semanticKey: 'section-1',
    chartColor: '#8D6E63',
    colors: {
      webFill: 'rgba(139, 90, 43, 0.12)',
      webFillLight: 'rgba(139, 90, 43, 0.08)',
    },
    /** Norte del parque (mayor latitud = menos negativo en hemisferio sur). */
    band: 'north',
  },
  {
    name: 'Tierras Medias',
    id: '2',
    code: 'mediumlands',
    semanticKey: 'section-2',
    chartColor: '#66BB6A',
    colors: {
      webFill: 'rgba(102, 187, 106, 0.12)',
      webFillLight: 'rgba(102, 187, 106, 0.08)',
    },
    band: 'middle',
  },
  {
    name: 'Tierras Bajas',
    id: '3',
    code: 'lowlands',
    semanticKey: 'section-3',
    chartColor: '#42A5F5',
    colors: {
      webFill: 'rgba(66, 165, 245, 0.12)',
      webFillLight: 'rgba(66, 165, 245, 0.08)',
    },
    band: 'south',
  },
];

function roundCoord(n) {
  return Number(n.toFixed(PRECISION));
}

function toLatLng(ring) {
  // GeoJSON ring is [lng, lat]; drop closing duplicate if present
  const pts = ring.map(([lng, lat]) => ({
    lat: roundCoord(lat),
    lng: roundCoord(lng),
  }));
  if (pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first.lat === last.lat && first.lng === last.lng) pts.pop();
  }
  return pts;
}

/** Centroide por área (shoelace) — más preciso que promedio de vértices. */
function areaCentroid(polygon) {
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross =
      polygon[i].lng * polygon[j].lat - polygon[j].lng * polygon[i].lat;
    area2 += cross;
    cx += (polygon[i].lng + polygon[j].lng) * cross;
    cy += (polygon[i].lat + polygon[j].lat) * cross;
  }
  if (Math.abs(area2) < 1e-14) return polygonCentroid(polygon);
  return {
    lng: roundCoord(cx / (3 * area2)),
    lat: roundCoord(cy / (3 * area2)),
  };
}

function bboxOf(polygon) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of polygon) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return { minLat, maxLat, minLng, maxLng };
}

/** Intersección de arista con línea horizontal lat = clipLat. */
function intersectLatEdge(p1, p2, clipLat) {
  const t = (clipLat - p1.lat) / (p2.lat - p1.lat);
  return {
    lat: roundCoord(clipLat),
    lng: roundCoord(p1.lng + t * (p2.lng - p1.lng)),
  };
}

/** Sutherland–Hodgman: conservar puntos con lat >= clipLat si keepAbove. */
function clipAgainstLat(polygon, clipLat, keepAbove) {
  if (!polygon.length) return [];
  const out = [];
  for (let i = 0; i < polygon.length; i++) {
    const curr = polygon[i];
    const prev = polygon[(i + polygon.length - 1) % polygon.length];
    const currIn = keepAbove ? curr.lat >= clipLat - 1e-12 : curr.lat <= clipLat + 1e-12;
    const prevIn = keepAbove ? prev.lat >= clipLat - 1e-12 : prev.lat <= clipLat + 1e-12;
    if (currIn) {
      if (!prevIn) out.push(intersectLatEdge(prev, curr, clipLat));
      out.push(curr);
    } else if (prevIn) {
      out.push(intersectLatEdge(prev, curr, clipLat));
    }
  }
  return dedupeAdjacent(out);
}

function dedupeAdjacent(points) {
  if (points.length < 2) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1];
    const p = points[i];
    if (prev.lat !== p.lat || prev.lng !== p.lng) out.push(p);
  }
  return out;
}

/** Partición en 3 bandas latitudinales recortadas al polígono OSM. */
function splitSections(boundary) {
  const { minLat, maxLat } = bboxOf(boundary);
  const third = (maxLat - minLat) / 3;
  const latHigh = roundCoord(maxLat - third);
  const latLow = roundCoord(minLat + third);

  const bands = [
    { latMin: latHigh, latMax: maxLat },
    { latMin: latLow, latMax: latHigh },
    { latMin: minLat, latMax: latLow },
  ];

  return bands.map((band, i) => {
    let poly = clipAgainstLat(boundary, band.latMin, true);
    poly = clipAgainstLat(poly, band.latMax, false);
    if (poly.length < 3) {
      throw new Error(`Section ${i + 1} clip produced < 3 vertices`);
    }
    return { ...SECTION_META[i], polygon: poly };
  });
}

async function fetchOsmPolygon() {
  const url = `https://nominatim.openstreetmap.org/lookup?osm_ids=W${OSM_WAY_ID}&format=json&polygon_geojson=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'pcymt-rm-geometry-sync/1.0 (academic project)' },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.[0]?.geojson?.coordinates?.[0]) {
    throw new Error('OSM polygon not found in Nominatim response');
  }
  return {
    displayName: data[0].display_name,
    osmLat: data[0].lat,
    osmLon: data[0].lon,
    ring: data[0].geojson.coordinates[0],
    boundingbox: data[0].boundingbox,
  };
}

function writeOutputs(boundary, sections, meta) {
  fs.mkdirSync(outDir, { recursive: true });

  const boundaryDoc = {
    version: 2,
    source: `openstreetmap:way/${OSM_WAY_ID}`,
    name: 'Parque de las Culturas y de la Madre Tierra',
    syncedAt: new Date().toISOString(),
    centroid: meta.centroid,
    boundingBox: meta.boundingBox,
    vertexCount: boundary.length,
    coordinates: boundary,
  };

  const geoRing = boundary.map((p) => [p.lng, p.lat]);
  geoRing.push(geoRing[0]);

  const geojson = {
    type: 'FeatureCollection',
    version: 2,
    source: boundaryDoc.source,
    features: [
      {
        type: 'Feature',
        properties: {
          name: boundaryDoc.name,
          osm_id: OSM_WAY_ID,
          centroid: meta.centroid,
        },
        geometry: { type: 'Polygon', coordinates: [geoRing] },
      },
    ],
  };

  const sectionsDoc = {
    version: 2,
    source: boundaryDoc.source,
    partition: 'latitude-thirds-clipped-to-boundary',
    sections: sections.map(({ name, id, code, semanticKey, chartColor, colors, polygon }) => ({
      id,
      code,
      semanticKey,
      chartColor,
      name,
      colors,
      polygon,
    })),
  };

  fs.writeFileSync(path.join(outDir, 'park-boundary.json'), JSON.stringify(boundaryDoc, null, 2));
  fs.writeFileSync(path.join(outDir, 'park-boundary.geojson'), JSON.stringify(geojson, null, 2));
  fs.writeFileSync(path.join(outDir, 'park-sections.json'), JSON.stringify(sectionsDoc, null, 2));

  const webMapData = path.join(root, 'apps/web-admin/src/app/features/map/data');
  fs.mkdirSync(webMapData, { recursive: true });
  for (const file of ['park-boundary.json', 'park-sections.json']) {
    fs.copyFileSync(path.join(outDir, file), path.join(webMapData, file));
  }

  const backendData = path.join(root, 'apps/backend/src/shared/data');
  fs.mkdirSync(backendData, { recursive: true });
  for (const file of ['park-boundary.json', 'park-boundary.geojson', 'park-sections.json', 'park-pois.json']) {
    const src = path.join(outDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(backendData, file));
    }
  }

  return { boundaryDoc, sectionsDoc };
}

function validateSections(boundary, sections) {
  const c = areaCentroid(boundary);
  for (const s of sections) {
    const sc = areaCentroid(s.polygon);
    if (!isPointInPolygon(sc, boundary)) {
      console.warn(`WARN: section "${s.name}" centroid outside boundary`);
    }
    if (!isPointInPolygon(sc, s.polygon)) {
      console.warn(`WARN: section "${s.name}" centroid outside its polygon`);
    }
  }
  return c;
}

async function main() {
  console.log(`Fetching OSM way ${OSM_WAY_ID}…`);
  const osm = await fetchOsmPolygon();
  const boundary = toLatLng(osm.ring);
  const boundingBox = bboxOf(boundary);
  const centroid = areaCentroid(boundary);
  const sections = splitSections(boundary);
  validateSections(boundary, sections);

  const { boundaryDoc, sectionsDoc } = writeOutputs(boundary, sections, {
    centroid,
    boundingBox: {
      minLat: roundCoord(boundingBox.minLat),
      maxLat: roundCoord(boundingBox.maxLat),
      minLng: roundCoord(boundingBox.minLng),
      maxLng: roundCoord(boundingBox.maxLng),
    },
  });

  console.log('OK:', osm.displayName);
  console.log(`  boundary: ${boundary.length} vertices`);
  console.log(`  centroid: ${centroid.lat}, ${centroid.lng}`);
  console.log(`  OSM pin:  ${osm.osmLat}, ${osm.osmLon}`);
  console.log(
    `  bbox: lat [${boundaryDoc.boundingBox.minLat}, ${boundaryDoc.boundingBox.maxLat}] lng [${boundaryDoc.boundingBox.minLng}, ${boundaryDoc.boundingBox.maxLng}]`,
  );
  for (const s of sectionsDoc.sections) {
    const c = areaCentroid(s.polygon);
    console.log(`  ${s.name}: ${s.polygon.length} pts, centroid ${c.lat}, ${c.lng}`);
  }
  console.log('Synced → shared/data, web-admin/map/data, backend/src/shared/data');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
