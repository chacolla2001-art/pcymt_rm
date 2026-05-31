const express = require('express');

const createMapTileRoutes = (mapTileController, authMiddleware, uploadMiddleware) => {
  const router = express.Router();

  // ── Public routes (no auth) — for mobile sync ──────────────
  // Manifest with ETag support
  router.get('/manifest', mapTileController.getManifest);

  // Individual tile (cached aggressively)
  // Route: /api/map/tiles/0/0_0.png  → params: z=0, 0=0_0 (regex capture)
  router.get('/tiles/:z/*', mapTileController.getTile);

  // Overlay JSON with ETag support
  router.get('/overlays/:name', mapTileController.getOverlay);

  // Bulk download tiles for a zoom level
  router.get('/tiles/:z/all.zip', mapTileController.getZoomZip);

  // ── Protected routes (auth required) — admin only ──────────
  // Publish new tile version (multipart: tile PNG files + overlays JSON)
  router.post('/publish',
    authMiddleware,
    uploadMiddleware.array('tiles', 50), // up to 50 tile files
    mapTileController.publish,
  );

  // Upload custom tileset (single file)
  router.post('/tilesets',
    authMiddleware,
    uploadMiddleware.single('tileset'),
    mapTileController.uploadTileset,
  );

  // Upload custom sticker (single file)
  router.post('/stickers',
    authMiddleware,
    uploadMiddleware.single('sticker'),
    mapTileController.uploadSticker,
  );

  return router;
};

module.exports = createMapTileRoutes;
