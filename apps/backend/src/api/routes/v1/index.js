const express = require('express');

const createUserRoutes = require('./user.routes');
const createAuthRoutes = require('./auth.routes');
const createVirtualAssetRoutes = require('./virtualAsset.routes');
const createAnchorPointRoutes = require('./anchorPoint.routes');
const createUserInteractionRoutes = require('./userInteraction.routes');
const createUserSessionRoutes = require('./userSession.routes');
const createAnalyticsRoutes = require('./analytics.routes');
const createConfigRoutes = require('./config.routes');
const createFileRoutes = require('./file.routes');
const createMapConfigurationRoutes = require('./mapConfiguration.routes');
const createMapTileRoutes = require('./mapTile.routes');

/**
 * Create all v1 API routes
 * @param {object} container - Dependency injection container
 * @returns {Router}
 */
const createV1Routes = (container) => {
  const router = express.Router();

  const {
    userController,
    authController,
    virtualAssetController,
    anchorPointController,
    userInteractionController,
    userSessionController,
    analyticsController,
    configController,
    fileController,
    mapConfigurationController,
    mapTileController,
    authMiddleware,
    uploadMiddleware,
  } = container;

  // Public routes (no auth required for GET, auth required for PUT)
  router.use('/config', createConfigRoutes(configController, authMiddleware));

  // Mount routes - RESTful naming with kebab-case
  router.use('/auth', createAuthRoutes(authController, userController, authMiddleware, uploadMiddleware));
  router.use('/users', createUserRoutes(userController, authMiddleware, uploadMiddleware));
  router.use('/virtual-assets', createVirtualAssetRoutes(virtualAssetController, authMiddleware, uploadMiddleware));
  router.use('/anchor-points', createAnchorPointRoutes(anchorPointController, authMiddleware));
  router.use('/user-interactions', createUserInteractionRoutes(userInteractionController, authMiddleware));
  router.use('/user-sessions', createUserSessionRoutes(userSessionController, authMiddleware));
  router.use('/analytics', createAnalyticsRoutes(analyticsController, authMiddleware));
  router.use('/files', createFileRoutes(fileController, authMiddleware));
  router.use('/map-configurations', createMapConfigurationRoutes(mapConfigurationController, authMiddleware));
  router.use('/map', createMapTileRoutes(mapTileController, authMiddleware, uploadMiddleware));

  return router;
};

module.exports = createV1Routes;
