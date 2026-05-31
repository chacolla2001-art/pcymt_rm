const express = require('express');

/**
 * Create user session routes
 * @param {object} userSessionController - UserSession controller instance
 * @param {object} authMiddleware - Auth middleware
 * @returns {Router}
 */
const createUserSessionRoutes = (userSessionController, authMiddleware) => {
  const router = express.Router();

  // All routes are protected
  router.get('/', authMiddleware, userSessionController.getAll);
  
  // Specific routes BEFORE parameterized routes to avoid :id capturing them
  router.get('/time-series', authMiddleware, userSessionController.getTimeSeries);
  router.get('/user/:userId', authMiddleware, userSessionController.getByUser);
  
  // Parameterized routes last
  router.get('/:id', authMiddleware, userSessionController.getById);
  router.post('/:id/end', authMiddleware, userSessionController.endSession);

  return router;
};

module.exports = createUserSessionRoutes;
