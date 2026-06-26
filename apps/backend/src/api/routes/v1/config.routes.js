const express = require('express');
const { staffOnly } = require('../../middlewares/authorize.middleware');

/**
 * Create config routes
 * @param {ConfigController} configController
 * @param {Function} authMiddleware
 * @returns {Router}
 */
const createConfigRoutes = (configController, authMiddleware) => {
  const router = express.Router();

  // GET /api/config - Get public configuration (no auth)
  router.get('/', configController.getPublicConfig);

  // GET /api/config/park-data - Shared park geometry (no auth)
  router.get('/park-data', configController.getParkData);

  // PUT /api/config - Update mutable config (auth required)
  router.put('/', authMiddleware, staffOnly, configController.updateConfig);

  // POST /api/config/arcore-token - Generate ARCore session token (staff only)
  router.post('/arcore-token', authMiddleware, staffOnly, configController.getArcoreToken);

  return router;
};

module.exports = createConfigRoutes;
