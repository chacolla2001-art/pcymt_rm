const express = require('express');
const { userSchemas } = require('../../../shared/validators');
const { validateBody, authLimiter } = require('../../middlewares');

/**
 * Create auth routes
 * @param {object} authController - Auth controller instance
 * @param {object} userController - User controller instance (for register)
 * @param {object} authMiddleware - Auth middleware
 * @param {object} uploadMiddleware - File upload middleware
 * @returns {Router}
 */
const createAuthRoutes = (authController, userController, authMiddleware, uploadMiddleware) => {
  const router = express.Router();

  // Login - rate limited to prevent brute force
  router.post('/login',
    authLimiter,
    validateBody(userSchemas.login),
    authController.login,
  );

  // Register - rate limited (delegates to user controller)
  router.post('/register',
    authLimiter,
    uploadMiddleware.single('profile_picture_url'),
    validateBody(userSchemas.create),
    userController.create,
  );

  // Google login - rate limited
  router.post('/google', authLimiter, authController.googleLogin);

  // Forgot password - rate limited
  router.post('/forgot-password', authLimiter, authController.forgotPassword);

  router.post('/resend-verification',
    authLimiter,
    validateBody(userSchemas.recoverPassword),
    authController.resendVerificationEmail,
  );

  router.post('/check-verification',
    authLimiter,
    validateBody(userSchemas.recoverPassword),
    authController.checkEmailVerification,
  );

  router.get('/verify-email', authController.verifyEmail);

  // Refresh token - rate limited
  router.post('/refresh', authLimiter, authController.refreshToken);

  // Logout
  router.post('/logout', authController.logout);

  // Get current user (protected)
  router.get('/me', authMiddleware, authController.getCurrentUser);

  return router;
};

module.exports = createAuthRoutes;
