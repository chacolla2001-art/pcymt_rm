const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ValidationError } = require('../../shared/errors');

/**
 * Park bounds (WGS84) — matches frontend and mobile
 */
const PARK_BOUNDS = {
  minLat: -16.4921,
  maxLat: -16.4866,
  minLng: -68.1469,
  maxLng: -68.1446,
};

const TILE_SIZE = 512;
const MAX_ZOOM = 2;

class MapTileService {
  constructor(anchorPointRepository, virtualAssetRepository, uploadDir) {
    this.anchorPointRepo = anchorPointRepository;
    this.virtualAssetRepo = virtualAssetRepository;
    this.uploadDir = uploadDir;
    this.tilesDir = path.join(uploadDir, 'map-tiles');
  }

  /**
   * Get current manifest (or null if no tiles published yet)
   * @returns {Promise<object|null>}
   */
  async getManifest() {
    const manifestPath = this._currentManifestPath();
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    const raw = fs.readFileSync(manifestPath, 'utf8');
    return JSON.parse(raw);
  }

  /**
   * Get manifest ETag (sha256 hash of manifest content)
   * @returns {Promise<string|null>}
   */
  async getManifestETag() {
    const manifestPath = this._currentManifestPath();
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    const content = fs.readFileSync(manifestPath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get a specific tile file path
   * @param {number} z - Zoom level
   * @param {number} x - Column
   * @param {number} y - Row
   * @returns {string|null} absolute path or null
   */
  getTilePath(z, x, y) {
    const currentVersion = this._getCurrentVersion();
    if (!currentVersion) {
      return null;
    }

    const tilePath = path.join(
      this.tilesDir,
      `v${currentVersion}`,
      'tiles',
      `z${z}`,
      `${x}_${y}.png`,
    );

    // Prevent path traversal
    const resolved = path.resolve(tilePath);
    if (!resolved.startsWith(path.resolve(this.tilesDir))) {
      return null;
    }

    return fs.existsSync(tilePath) ? tilePath : null;
  }

  /**
   * Get an overlay JSON
   * @param {string} name - zones|anchors|pois|stickers
   * @returns {Promise<object|null>}
   */
  async getOverlay(name) {
    const allowed = ['zones', 'anchors', 'pois', 'stickers'];
    if (!allowed.includes(name)) {
      throw new ValidationError(`Invalid overlay name: ${name}. Must be one of: ${allowed.join(', ')}`);
    }

    // For anchors, generate dynamically from database
    if (name === 'anchors') {
      return this._generateAnchorsOverlay();
    }

    const currentVersion = this._getCurrentVersion();
    if (!currentVersion) {
      return null;
    }

    const overlayPath = path.join(
      this.tilesDir,
      `v${currentVersion}`,
      'overlays',
      `${name}.json`,
    );

    const resolved = path.resolve(overlayPath);
    if (!resolved.startsWith(path.resolve(this.tilesDir))) {
      return null;
    }

    if (!fs.existsSync(overlayPath)) {
      return null;
    }

    const raw = fs.readFileSync(overlayPath, 'utf8');
    return JSON.parse(raw);
  }

  /**
   * Get overlay ETag
   * @param {string} name
   * @returns {Promise<string|null>}
   */
  async getOverlayETag(name) {
    const overlay = await this.getOverlay(name);
    if (!overlay) {
      return null;
    }
    const content = JSON.stringify(overlay);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Publish a new tile version
   * Receives tile files + overlay JSON data + metadata
   * @param {object} params
   * @param {object[]} params.tileFiles - Array of multer file objects
   * @param {object} params.overlays - { zones, pois, stickers } JSON objects
   * @param {string} params.createdBy - user email
   * @returns {Promise<object>} The new manifest
   */
  async publish({ tileFiles, overlays, createdBy }) {
    const newVersion = (this._getCurrentVersion() || 0) + 1;
    const versionDir = path.join(this.tilesDir, `v${newVersion}`);

    // Create directory structure
    this._ensureDir(path.join(versionDir, 'tiles', 'z0'));
    this._ensureDir(path.join(versionDir, 'tiles', 'z1'));
    this._ensureDir(path.join(versionDir, 'tiles', 'z2'));
    this._ensureDir(path.join(versionDir, 'overlays'));
    this._ensureDir(path.join(versionDir, 'assets', 'custom-stickers'));
    this._ensureDir(path.join(versionDir, 'assets', 'tilesets'));

    // Move uploaded tile files to proper locations
    let totalSize = 0;
    for (const file of (tileFiles || [])) {
      // Expected originalname format: "z{level}_{x}_{y}.png"
      const match = file.originalname.match(/^z(\d+)_(\d+)_(\d+)\.png$/);
      if (!match) {
        continue;
      }

      const [, zLevel, xCol, yRow] = match;
      const destPath = path.join(versionDir, 'tiles', `z${zLevel}`, `${xCol}_${yRow}.png`);

      // Validate destination is within tiles dir
      const resolvedDest = path.resolve(destPath);
      if (!resolvedDest.startsWith(path.resolve(this.tilesDir))) {
        continue;
      }

      fs.copyFileSync(file.path, destPath);
      totalSize += file.size;
    }

    // Write overlay JSON files
    const overlayHashes = {};
    for (const [name, data] of Object.entries(overlays || {})) {
      if (!['zones', 'pois', 'stickers'].includes(name)) {
        continue;
      }
      const overlayPath = path.join(versionDir, 'overlays', `${name}.json`);
      const content = JSON.stringify(data, null, 2);
      fs.writeFileSync(overlayPath, content, 'utf8');
      overlayHashes[name] = crypto.createHash('sha256').update(content).digest('hex');
    }

    // Generate anchors overlay from database
    const anchorsOverlay = await this._generateAnchorsOverlay();
    const anchorsContent = JSON.stringify(anchorsOverlay, null, 2);
    fs.writeFileSync(
      path.join(versionDir, 'overlays', 'anchors.json'),
      anchorsContent,
      'utf8',
    );
    overlayHashes.anchors = crypto.createHash('sha256').update(anchorsContent).digest('hex');

    // Count tiles per zoom level
    const zoomLevels = [];
    for (let z = 0; z <= MAX_ZOOM; z++) {
      const zDir = path.join(versionDir, 'tiles', `z${z}`);
      const tiles = fs.existsSync(zDir)
        ? fs.readdirSync(zDir).filter((f) => f.endsWith('.png'))
        : [];
      const cols = Math.pow(2, z);
      const rows = cols;
      zoomLevels.push({ z, cols, rows, totalTiles: tiles.length });
    }

    // Build manifest
    const manifest = {
      version: newVersion,
      hash: '', // will be filled after computing
      createdAt: new Date().toISOString(),
      createdBy,
      bounds: PARK_BOUNDS,
      tileSize: TILE_SIZE,
      zoomLevels,
      totalSize,
      overlayVersions: overlayHashes,
    };

    // Compute manifest hash
    const manifestContent = JSON.stringify(manifest);
    manifest.hash = `sha256:${crypto.createHash('sha256').update(manifestContent).digest('hex')}`;

    // Write manifest
    fs.writeFileSync(
      path.join(versionDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8',
    );

    // Update "current" pointer
    fs.writeFileSync(
      path.join(this.tilesDir, 'current-version.txt'),
      String(newVersion),
      'utf8',
    );

    return manifest;
  }

  /**
   * Save an uploaded tileset asset
   * @param {object} file - multer file object
   * @returns {object} { filename, url }
   */
  saveTileset(file) {
    const currentVersion = this._getCurrentVersion() || 1;
    const versionDir = path.join(this.tilesDir, `v${currentVersion}`);
    this._ensureDir(path.join(versionDir, 'assets', 'tilesets'));

    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `tileset_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const destPath = path.join(versionDir, 'assets', 'tilesets', safeName);

    const resolved = path.resolve(destPath);
    if (!resolved.startsWith(path.resolve(this.tilesDir))) {
      throw new ValidationError('Invalid file path');
    }

    fs.copyFileSync(file.path, destPath);

    return {
      filename: safeName,
      url: `/api/map/tilesets/${safeName}`,
    };
  }

  /**
   * Save an uploaded custom sticker
   * @param {object} file - multer file object
   * @returns {object} { filename, url }
   */
  saveSticker(file) {
    const currentVersion = this._getCurrentVersion() || 1;
    const versionDir = path.join(this.tilesDir, `v${currentVersion}`);
    this._ensureDir(path.join(versionDir, 'assets', 'custom-stickers'));

    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `sticker_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const destPath = path.join(versionDir, 'assets', 'custom-stickers', safeName);

    const resolved = path.resolve(destPath);
    if (!resolved.startsWith(path.resolve(this.tilesDir))) {
      throw new ValidationError('Invalid file path');
    }

    fs.copyFileSync(file.path, destPath);

    return {
      filename: safeName,
      url: `/api/map/stickers/${safeName}`,
    };
  }

  /**
   * Get ZIP path for all tiles at a zoom level
   * @param {number} z - Zoom level
   * @returns {string|null}
   */
  getZoomDir(z) {
    const currentVersion = this._getCurrentVersion();
    if (!currentVersion) {
      return null;
    }

    const zDir = path.join(this.tilesDir, `v${currentVersion}`, 'tiles', `z${z}`);
    const resolved = path.resolve(zDir);
    if (!resolved.startsWith(path.resolve(this.tilesDir))) {
      return null;
    }

    return fs.existsSync(zDir) ? zDir : null;
  }

  // ── Private helpers ────────────────────────────────────────

  _currentManifestPath() {
    const version = this._getCurrentVersion();
    if (!version) {
      return path.join(this.tilesDir, 'manifest.json');
    }
    return path.join(this.tilesDir, `v${version}`, 'manifest.json');
  }

  _getCurrentVersion() {
    const versionFile = path.join(this.tilesDir, 'current-version.txt');
    if (!fs.existsSync(versionFile)) {
      return null;
    }
    const v = parseInt(fs.readFileSync(versionFile, 'utf8').trim(), 10);
    return isNaN(v) ? null : v;
  }

  async _generateAnchorsOverlay() {
    const locations = await this.anchorPointRepo.findAll({
      where: { is_active: true },
    });

    const assets = await this.virtualAssetRepo.findAll({
      where: { is_active: true },
    });

    const assetMap = {};
    for (const a of assets) {
      assetMap[a.id] = a;
    }

    const anchors = locations.map((loc) => {
      const asset = loc.virtual_asset_id ? assetMap[loc.virtual_asset_id] : null;
      return {
        id: loc.id,
        lat: parseFloat(loc.latitude),
        lng: parseFloat(loc.longitude),
        name: loc.name,
        section: loc.section,
        anchorCode: loc.anchor_code || null,
        scale: loc.scale || 1.0,
        rotationY: loc.rotation_y || 0,
        assetId: loc.virtual_asset_id || null,
        assetIcon: asset?.icon_url || null,
        assetModel: asset?.model_url || null,
        assetName: asset?.name || null,
      };
    });

    const content = JSON.stringify({ anchors });
    return {
      hash: `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`,
      updatedAt: new Date().toISOString(),
      anchors,
    };
  }

  _ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

module.exports = MapTileService;
