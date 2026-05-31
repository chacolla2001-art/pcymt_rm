const express = require('express');
const { userSchemas } = require('../../../shared/validators');
const { validateBody, authLimiter, passwordResetLimiter } = require('../../middlewares');
const { adminOnly } = require('../../middlewares/authorize.middleware');

/**
 * Create user routes
 * @param {object} userController - User controller instance
 * @param {object} authMiddleware - Auth middleware
 * @param {object} uploadMiddleware - File upload middleware
 * @returns {Router}
 */
const createUserRoutes = (userController, authMiddleware, uploadMiddleware) => {
  const router = express.Router();

  // Public routes with rate limiting
  router.post('/register',
    authLimiter,
    uploadMiddleware.single('profile_picture_url'),
    validateBody(userSchemas.create),
    userController.create,
  );

  router.post('/recover-password',
    passwordResetLimiter,
    validateBody(userSchemas.recoverPassword),
    userController.recoverPassword,
  );

  router.post('/verify-password', authLimiter, userController.verifyPassword);

  router.post('/change-password',
    authLimiter,
    validateBody(userSchemas.changePassword),
    userController.changePassword,
  );

  // Rate limit check routes to prevent user enumeration attacks
  router.post('/check-email', authLimiter, userController.checkEmail);

  // Protected routes
  router.delete('/me',
    authMiddleware,
    validateBody(userSchemas.deleteOwnAccount),
    userController.deleteOwnAccount,
  );

  router.get('/', authMiddleware, userController.getAll);
  router.get('/:id', authMiddleware, userController.getById);

  router.put('/:id',
    authMiddleware,
    uploadMiddleware.single('profile_picture_url'),
    validateBody(userSchemas.update),
    userController.update,
  );

  router.delete('/:id', authMiddleware, userController.delete);

  router.patch('/:id/toggle-active', authMiddleware, userController.toggleActive);

  router.patch('/:id/set-password',
    authMiddleware,
    adminOnly,
    validateBody(userSchemas.adminSetPassword),
    userController.adminSetPassword,
  );

  router.patch('/:id/profile-picture',
    authMiddleware,
    uploadMiddleware.single('profile_picture_url'),
    userController.updateProfilePicture,
  );

  return router;
};

module.exports = createUserRoutes;
