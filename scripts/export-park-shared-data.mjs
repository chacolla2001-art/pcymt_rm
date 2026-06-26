#!/usr/bin/env node
/**
 * @deprecated Usar scripts/sync-park-geometry-from-osm.mjs (fuente: OpenStreetMap way/641677241).
 * Regenera shared/data/park-*.json desde map-control.component.ts (legacy).
 * Uso: node scripts/export-park-shared-data.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = fs.readFileSync(
  path.join(root, 'apps/web-admin/src/app/features/map/components/map-control.component.ts'),
  'utf8',
);

function extractArray(name) {
  const re = new RegExp(`const ${name}[\\s\\S]*?=\\s*(\\[[\\s\\S]*?\\n\\]);`);
  const m = src.match(re);
  if (!m) throw new Error(`Array not found: ${name}`);
  return eval(m[1]);
}

const boundary = extractArray('PARK_BOUNDARY');
const sections = extractArray('PARK_SECTIONS');
const outDir = path.join(root, 'shared/data');
fs.mkdirSync(outDir, { recursive: true });

const coords = boundary.map((p) => [p.lng, p.lat]);
if (
  coords.length &&
  (coords[0][0] !== coords.at(-1)[0] || coords[0][1] !== coords.at(-1)[1])
) {
  coords.push(coords[0]);
}

fs.writeFileSync(
  path.join(outDir, 'park-boundary.geojson'),
  JSON.stringify(
    {
      type: 'FeatureCollection',
      version: 1,
      features: [
        {
          type: 'Feature',
          properties: { name: 'Parque de las Culturas y la Madre Tierra' },
          geometry: { type: 'Polygon', coordinates: [coords] },
        },
      ],
    },
    null,
    2,
  ),
);

fs.writeFileSync(
  path.join(outDir, 'park-boundary.json'),
  JSON.stringify({ version: 1, coordinates: boundary }, null, 2),
);

const sectionMeta = {
  'Tierras Altas': { id: '1', code: 'highlands', semanticKey: 'section-1', chartColor: '#8D6E63' },
  'Tierras Medias': { id: '2', code: 'mediumlands', semanticKey: 'section-2', chartColor: '#66BB6A' },
  'Tierras Bajas': { id: '3', code: 'lowlands', semanticKey: 'section-3', chartColor: '#42A5F5' },
};

fs.writeFileSync(
  path.join(outDir, 'park-sections.json'),
  JSON.stringify(
    {
      version: 1,
      sections: sections.map((s) => ({
        ...sectionMeta[s.name],
        name: s.name,
        colors: { webFill: s.color, webFillLight: s.colorLight },
        polygon: s.polygon,
      })),
    },
    null,
    2,
  ),
);

console.log(`OK: ${boundary.length} boundary points, ${sections.length} sections → shared/data/`);

const webMapData = path.join(root, 'apps/web-admin/src/app/features/map/data');
fs.mkdirSync(webMapData, { recursive: true });
for (const file of ['park-boundary.json', 'park-sections.json']) {
  fs.copyFileSync(path.join(outDir, file), path.join(webMapData, file));
}
console.log(`OK: synced → apps/web-admin/src/app/features/map/data/`);
