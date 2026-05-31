const express = require('express');
const { anchorPointSchemas } = require('../../../shared/validators');
const { validateBody } = require('../../middlewares');

/**
 * Create anchor point routes
 * @param {object} anchorPointController - AnchorPoint controller instance
 * @param {object} authMiddleware - Auth middleware
 * @returns {Router}
 */
const createAnchorPointRoutes = (anchorPointController, authMiddleware) => {
  const router = express.Router();

  // Public routes
  router.get('/', anchorPointController.getAll);
  router.get('/active', anchorPointController.getActive);
  router.get('/clusters', anchorPointController.getClusters);
  router.get('/:id', anchorPointController.getById);
  router.get('/animal/:animalModelId', anchorPointController.getByVirtualAsset);

  // Protected routes
  router.post('/',
    authMiddleware,
    validateBody(anchorPointSchemas.create),
    anchorPointController.create,
  );

  router.put('/:id',
    authMiddleware,
    validateBody(anchorPointSchemas.update),
    anchorPointController.update,
  );

  router.delete('/:id', authMiddleware, anchorPointController.delete);

  return router;
};

module.exports = createAnchorPointRoutes;
