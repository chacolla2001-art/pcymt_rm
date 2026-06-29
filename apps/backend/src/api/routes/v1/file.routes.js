const express = require('express');

/**
 * Create file serving routes
 *
 * Serves uploaded files through authenticated endpoints instead of
 * public static file serving. Supports JWT via Authorization header
 * or via ?token= query parameter (for <img> tags in browsers).
 *
 * @param {object} fileController - File controller instance
 * @param {Function} authMiddleware - JWT authentication middleware
 * @returns {Router}
 */
const createFileRoutes = (fileController, authMiddleware) => {
  const router = express.Router();

  /**
   * Middleware to extract JWT from query parameter
   * Allows <img src="/api/files/photo.png?token=JWT"> to work
   * since browsers don't send Authorization headers for <img> tags.
   *
   * Only sets the header if no Authorization header is already present.
   */
  const extractQueryToken = (req, res, next) => {
    if (req.query.token && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
  };

  // GET /api/files/:folder/:filename - Serve file from subfolder (must be before /:filename)
  router.get('/:folder/:filename',
    extractQueryToken,
    authMiddleware,
    fileController.serveFromFolder,
  );

  // GET /api/files/:filename - Serve file from uploads root
  router.get('/:filename',
    extractQueryToken,
    authMiddleware,
    fileController.serve,
  );

  return router;
};

module.exports = createFileRoutes;
