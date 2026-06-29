const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../../../../../shared/data');

let cache = null;

function readJson(filename) {
  const filePath = path.join(DATA_DIR, filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Load park geometry from shared/data (single source of truth).
 * @returns {{ boundary: object, sections: object, pois: object }}
 */
function loadParkData() {
  if (cache) return cache;

  cache = {
    boundary: readJson('park-boundary.json'),
    boundaryGeoJson: readJson('park-boundary.geojson'),
    sections: readJson('park-sections.json'),
    pois: readJson('park-pois.json'),
  };

  return cache;
}

module.exports = { loadParkData, DATA_DIR };
