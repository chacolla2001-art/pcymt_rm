const express = require('express');

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

  // PUT /api/config - Update mutable config (auth required)
  router.put('/', authMiddleware, configController.updateConfig);

  // POST /api/config/arcore-token - Generate ARCore session token (auth required)
  router.post('/arcore-token', authMiddleware, configController.getArcoreToken);

  return router;
};

module.exports = createConfigRoutes;
