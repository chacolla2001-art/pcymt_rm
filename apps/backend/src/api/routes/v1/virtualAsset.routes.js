const express = require('express');
const { virtualAssetSchemas } = require('../../../shared/validators');
const { validateBody } = require('../../middlewares');

/**
 * Create virtual asset routes
 * @param {object} virtualAssetController - VirtualAsset controller instance
 * @param {object} authMiddleware - Auth middleware
 * @param {object} uploadMiddleware - File upload middleware
 * @returns {Router}
 */
const createVirtualAssetRoutes = (virtualAssetController, authMiddleware, uploadMiddleware) => {
  const router = express.Router();

  const fileFields = [
    { name: 'model_url', maxCount: 1 },
    { name: 'icon_url', maxCount: 1 },
  ];

  // Public routes
  router.get('/', virtualAssetController.getAll);
  router.get('/active', virtualAssetController.getActive);
  router.get('/:id', virtualAssetController.getById);

  // Protected routes
  router.post('/',
    authMiddleware,
    uploadMiddleware.fields(fileFields),
    validateBody(virtualAssetSchemas.create),
    virtualAssetController.create,
  );

  router.put('/:id',
    authMiddleware,
    uploadMiddleware.fields(fileFields),
    validateBody(virtualAssetSchemas.update),
    virtualAssetController.update,
  );

  router.delete('/:id', authMiddleware, virtualAssetController.delete);

  router.patch('/:id/deactivate', authMiddleware, virtualAssetController.deactivate);

  return router;
};

module.exports = createVirtualAssetRoutes;
