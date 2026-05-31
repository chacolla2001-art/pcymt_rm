const { NotFoundError } = require('../../shared/errors');
const { SYSTEM_USER } = require('../../shared/constants');

/**
 * Canonical section labels (must match seeder, mobile, and frontend)
 */
const SECTION_MAP = {
  '1': 'Tierras Altas',
  '2': 'Tierras Medias',
  '3': 'Tierras Bajas',
  '4': 'Mitos y Leyendas',
  // Identity mappings — already canonical
  'Tierras Altas': 'Tierras Altas',
  'Tierras Medias': 'Tierras Medias',
  'Tierras Bajas': 'Tierras Bajas',
  'Mitos y Leyendas': 'Mitos y Leyendas',
};

/**
 * Normalize data from frontend (camelCase) to database (snake_case)
 */
const normalizeData = (data) => {
  const normalized = {};
  const fieldMap = {
    virtualAssetId: 'virtual_asset_id',
    animalModelId: 'virtual_asset_id',
    showInMap: 'show_in_map',
    isActive: 'is_active',
    active: 'is_active',
    anchorCode: 'anchor_code',
    rotationY: 'rotation_y',
    spatialData: 'spatial_data',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };

  for (const [key, value] of Object.entries(data)) {
    // Skip undefined/null values for update operations
    if (value === undefined) {
      continue;
    }

    const normalizedKey = fieldMap[key] || key;

    // Convert string numbers to actual numbers for lat/lng
    if ((normalizedKey === 'latitude' || normalizedKey === 'longitude') && typeof value === 'string') {
      normalized[normalizedKey] = parseFloat(value);
    } else if (normalizedKey === 'section' && typeof value === 'string') {
      // Normalize section to canonical text label (backward-compat for numeric codes)
      normalized[normalizedKey] = SECTION_MAP[value] || value;
    } else {
      normalized[normalizedKey] = value;
    }
  }

  return normalized;
};

/**
 * AnchorPoint Service - Business logic for anchor points
 */
class AnchorPointService {
  constructor(anchorPointRepository) {
    this.repo = anchorPointRepository;
  }

  /**
   * Get all anchor points
   * @param {object} filters - Optional filters (e.g. { is_active: true })
   * @returns {Promise<Array>}
   */
  async getAll(filters = {}) {
    const options = {};
    if (filters.is_active !== undefined) {
      options.where = { is_active: filters.is_active };
    }
    return this.repo.findAll(options);
  }

  /**
   * Get active anchor points
   * @returns {Promise<Array>}
   */
  async getActive() {
    return this.repo.findActive();
  }

  /**
   * Get anchor point by ID
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getById(id) {
    const point = await this.repo.findById(id);
    if (!point) {
      throw new NotFoundError('Anchor Point');
    }
    return point;
  }

  /**
   * Get anchor points by virtual asset
   * @param {string} virtualAssetId
   * @returns {Promise<Array>}
   */
  async getByVirtualAsset(virtualAssetId) {
    return this.repo.findByVirtualAsset(virtualAssetId);
  }

  /**
   * Create anchor point
   * @param {object} data
   * @param {string} changedBy
   * @returns {Promise<object>}
   */
  async create(data, changedBy = SYSTEM_USER) {
    const normalized = normalizeData(data);
    return this.repo.create({
      ...normalized,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  /**
   * Update anchor point
   * @param {string} id
   * @param {object} data
   * @param {string} changedBy
   * @returns {Promise<object>}
   */
  async update(id, data, changedBy = SYSTEM_USER) {
    const point = await this.getById(id);
    const normalized = normalizeData(data);
    normalized.updated_at = new Date();

    // Remove fields that shouldn't be updated
    delete normalized.id;
    delete normalized.created_at;

    return point.update(normalized);
  }

  /**
   * Delete anchor point
   * @param {string} id
   * @param {string} changedBy
   * @returns {Promise<boolean>}
   */
  async delete(id, changedBy = SYSTEM_USER) {
    return this.repo.delete(id);
  }

  /**
   * Get anchor points in geographic bounds
   * @param {object} bounds
   * @returns {Promise<Array>}
   */
  async getInBounds(bounds) {
    return this.repo.findInBounds(bounds);
  }

  /**
   * Get clusters — groups of locations that share the same virtual_asset_id.
   *
   * For each virtual asset with 1+ locations, returns:
   *  - virtualAssetId: the shared asset id
   *  - locations: array of location records
   *  - count: number of locations in cluster
   *  - center: { lat, lng } centroid of all locations
   *  - polygon: array of {lat, lng} forming the convex hull (only if 3+ points)
   *  - bounds: { minLat, maxLat, minLng, maxLng }
   *
   * @returns {Promise<Array>} cluster objects
   */
  async getClusters() {
    const locations = await this.repo.findActiveGroupedByAsset();

    // Group by virtual_asset_id
    const groups = {};
    for (const loc of locations) {
      const assetId = loc.virtual_asset_id;
      if (!groups[assetId]) {
        groups[assetId] = [];
      }
      groups[assetId].push(loc);
    }

    // Build cluster data for each group
    return Object.entries(groups).map(([virtualAssetId, locs]) => {
      const points = locs.map(l => ({
        lat: parseFloat(l.latitude),
        lng: parseFloat(l.longitude),
      }));

      const centerLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
      const centerLng = points.reduce((s, p) => s + p.lng, 0) / points.length;

      const minLat = Math.min(...points.map(p => p.lat));
      const maxLat = Math.max(...points.map(p => p.lat));
      const minLng = Math.min(...points.map(p => p.lng));
      const maxLng = Math.max(...points.map(p => p.lng));

      // Compute convex hull if 3+ points
      let polygon = null;
      if (points.length >= 3) {
        polygon = convexHull(points);
      }

      return {
        virtualAssetId,
        section: locs[0].section,
        count: locs.length,
        isCluster: locs.length > 1,
        center: { lat: centerLat, lng: centerLng },
        bounds: { minLat, maxLat, minLng, maxLng },
        polygon,
        locations: locs.map(l => ({
          id: l.id,
          name: l.name,
          latitude: parseFloat(l.latitude),
          longitude: parseFloat(l.longitude),
          anchorCode: l.anchor_code,
          showInMap: l.show_in_map,
          scale: l.scale,
          rotationY: l.rotation_y,
        })),
      };
    });
  }
}

/**
 * Compute the convex hull of a set of 2D points using the Jarvis march
 * (gift wrapping) algorithm. Returns points in counter-clockwise order.
 *
 * @param {{lat: number, lng: number}[]} points
 * @returns {{lat: number, lng: number}[]}
 */
function convexHull(points) {
  if (points.length < 3) {
    return [...points];
  }

  // Find leftmost point
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].lng < points[start].lng ||
       (points[i].lng === points[start].lng && points[i].lat < points[start].lat)) {
      start = i;
    }
  }

  const hull = [];
  let current = start;
  do {
    hull.push(points[current]);
    let next = 0;
    for (let i = 1; i < points.length; i++) {
      if (i === current) {
        continue;
      }
      if (next === current) {
        next = i;
        continue;
      }
      const cross = crossProduct(points[current], points[next], points[i]);
      if (cross < 0 || (cross === 0 && dist2(points[current], points[i]) > dist2(points[current], points[next]))) {
        next = i;
      }
    }
    current = next;
  } while (current !== start && hull.length < points.length + 1);

  return hull;
}

function crossProduct(o, a, b) {
  return (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
}

function dist2(a, b) {
  return (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2;
}

module.exports = AnchorPointService;
