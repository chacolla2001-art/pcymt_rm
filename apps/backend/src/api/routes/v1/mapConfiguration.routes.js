const express = require('express');
const { mapConfigurationSchemas } = require('../../../shared/validators');
const { validateBody } = require('../../middlewares');

/**
 * Create map configuration routes
 * @param {object} mapConfigurationController - MapConfiguration controller instance
 * @param {object} authMiddleware - Auth middleware
 * @returns {Router}
 */
const createMapConfigurationRoutes = (mapConfigurationController, authMiddleware) => {
  const router = express.Router();

  // All routes require authentication
  router.use(authMiddleware);

  // List routes
  router.get('/', mapConfigurationController.getAvailable);
  router.get('/mine', mapConfigurationController.getMine);
  router.get('/public', mapConfigurationController.getPublic);

  // Global single-record config (must be before /:id)
  router.get('/global', mapConfigurationController.getGlobal);
  router.put('/global', mapConfigurationController.upsertGlobal);

  router.get('/:id', mapConfigurationController.getById);

  // Write routes
  router.post('/',
    validateBody(mapConfigurationSchemas.create),
    mapConfigurationController.create,
  );

  router.put('/:id',
    validateBody(mapConfigurationSchemas.update),
    mapConfigurationController.update,
  );

  router.delete('/:id', mapConfigurationController.delete);

  return router;
};

module.exports = createMapConfigurationRoutes;
