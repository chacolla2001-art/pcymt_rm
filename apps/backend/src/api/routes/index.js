const express = require('express');
const createV1Routes = require('./v1');

/**
 * Create all API routes
 * @param {object} container - Dependency injection container
 * @returns {Router}
 */
const createRoutes = (container) => {
  const router = express.Router();

  // Health check / ping
  router.get('/ping', (req, res) => {
    res.status(200).json({ message: 'pong', timestamp: new Date().toISOString() });
  });

  // API v1 routes
  router.use('/', createV1Routes(container));

  // Future: API v2 routes
  // router.use('/v2', createV2Routes(container));

  return router;
};

module.exports = createRoutes;
