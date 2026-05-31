const archiver = require('archiver');
const { ResponseUtil } = require('../../shared/utils');

class MapTileController {
  constructor(mapTileService) {
    this.service = mapTileService;
  }

  /**
   * GET /api/map/manifest
   * Returns the current tile manifest with ETag support
   */
  getManifest = async (req, res, next) => {
    try {
      const manifest = await this.service.getManifest();
      if (!manifest) {
        return ResponseUtil.success(res, null, 'No map tiles published yet');
      }

      // ETag support for conditional requests
      const etag = await this.service.getManifestETag();
      if (etag) {
        res.set('ETag', `"${etag}"`);
        res.set('Cache-Control', 'no-cache'); // always validate with server

        const ifNoneMatch = req.get('If-None-Match');
        if (ifNoneMatch && ifNoneMatch === `"${etag}"`) {
          return res.status(304).end();
        }
      }

      return ResponseUtil.success(res, manifest, 'Map manifest retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/map/tiles/:z/:x_:y.png
   * Serves a tile image with aggressive caching
   */
  getTile = async (req, res, next) => {
    try {
      const { z } = req.params;
      // Parse x_y from the filename param
      const xyParam = req.params[0]; // captured by regex route
      const match = xyParam.match(/^(\d+)_(\d+)$/);
      if (!match) {
        return ResponseUtil.error(res, 'Invalid tile coordinates', 400);
      }

      const x = parseInt(match[1], 10);
      const y = parseInt(match[2], 10);
      const zLevel = parseInt(z, 10);

      if (isNaN(zLevel) || zLevel < 0 || zLevel > 2) {
        return ResponseUtil.error(res, 'Invalid zoom level (0-2)', 400);
      }

      const tilePath = this.service.getTilePath(zLevel, x, y);
      if (!tilePath) {
        return ResponseUtil.error(res, 'Tile not found', 404);
      }

      // Aggressive caching — tiles are immutable per version
      res.set('Cache-Control', 'public, max-age=86400, immutable');
      res.set('Content-Type', 'image/png');
      res.sendFile(tilePath);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/map/overlays/:name.json
   * Returns an overlay JSON with ETag support
   */
  getOverlay = async (req, res, next) => {
    try {
      const { name } = req.params;
      const overlay = await this.service.getOverlay(name);

      if (!overlay) {
        return ResponseUtil.success(res, null, `No ${name} overlay data available`);
      }

      // ETag for conditional requests
      const etag = await this.service.getOverlayETag(name);
      if (etag) {
        res.set('ETag', `"${etag}"`);
        res.set('Cache-Control', 'no-cache');

        const ifNoneMatch = req.get('If-None-Match');
        if (ifNoneMatch && ifNoneMatch === `"${etag}"`) {
          return res.status(304).end();
        }
      }

      return ResponseUtil.success(res, overlay, `${name} overlay retrieved`);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/map/publish
   * Publish a new map tile version (admin only)
   */
  publish = async (req, res, next) => {
    try {
      const createdBy = req.user?.email || 'unknown';
      const tileFiles = req.files || [];

      let overlays = {};
      if (req.body.overlays) {
        try {
          overlays = typeof req.body.overlays === 'string'
            ? JSON.parse(req.body.overlays)
            : req.body.overlays;
        } catch {
          return ResponseUtil.error(res, 'Invalid overlays JSON', 400);
        }
      }

      const manifest = await this.service.publish({
        tileFiles,
        overlays,
        createdBy,
      });

      return ResponseUtil.created(res, manifest, 'Map tiles published successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/map/tiles/:z/all.zip
   * Download all tiles for a zoom level as a ZIP
   */
  getZoomZip = async (req, res, next) => {
    try {
      const z = parseInt(req.params.z, 10);
      if (isNaN(z) || z < 0 || z > 2) {
        return ResponseUtil.error(res, 'Invalid zoom level (0-2)', 400);
      }

      const zoomDir = this.service.getZoomDir(z);
      if (!zoomDir) {
        return ResponseUtil.error(res, `No tiles at zoom level ${z}`, 404);
      }

      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', `attachment; filename="tiles_z${z}.zip"`);
      res.set('Cache-Control', 'public, max-age=86400');

      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.on('error', (err) => next(err));
      archive.pipe(res);
      archive.directory(zoomDir, false);
      await archive.finalize();
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/map/tilesets
   * Upload a custom tileset image (admin only)
   */
  uploadTileset = async (req, res, next) => {
    try {
      if (!req.file) {
        return ResponseUtil.error(res, 'No file uploaded', 400);
      }

      const result = this.service.saveTileset(req.file);
      return ResponseUtil.created(res, result, 'Tileset uploaded');
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/map/stickers
   * Upload a custom sticker (admin only)
   */
  uploadSticker = async (req, res, next) => {
    try {
      if (!req.file) {
        return ResponseUtil.error(res, 'No file uploaded', 400);
      }

      const result = this.service.saveSticker(req.file);
      return ResponseUtil.created(res, result, 'Custom sticker uploaded');
    } catch (error) {
      next(error);
    }
  };
}

module.exports = MapTileController;
