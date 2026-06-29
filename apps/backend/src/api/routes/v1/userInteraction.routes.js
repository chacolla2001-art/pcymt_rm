const express = require('express');
const { userInteractionSchemas } = require('../../../shared/validators');
const { validateBody } = require('../../middlewares');

/**
 * Create user interaction routes
 * @param {object} userInteractionController - UserInteraction controller instance
 * @param {object} authMiddleware - Auth middleware
 * @returns {Router}
 */
const createUserInteractionRoutes = (userInteractionController, authMiddleware) => {
  const router = express.Router();

  // All routes are protected
  router.get('/', authMiddleware, userInteractionController.getAll);
  // Specific routes first, then parameterized routes
  router.delete('/user/:userId/reset', authMiddleware, userInteractionController.resetGame);
  router.get('/user/:userId', authMiddleware, userInteractionController.getByUser);
  router.get('/by-virtual-asset/:assetId', authMiddleware, userInteractionController.getByVirtualAsset);
  router.get('/:id', authMiddleware, userInteractionController.getById);

  router.post('/',
    authMiddleware,
    validateBody(userInteractionSchemas.create),
    userInteractionController.create,
  );

  return router;
};

module.exports = createUserInteractionRoutes;
