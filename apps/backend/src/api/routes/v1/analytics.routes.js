const express = require('express');
const { staffOnly } = require('../../middlewares/authorize.middleware');

/**
 * Create analytics routes
 * @param {object} analyticsController - Analytics controller instance
 * @param {object} authMiddleware - Auth middleware
 * @returns {Router}
 */
const createAnalyticsRoutes = (analyticsController, authMiddleware) => {
  const router = express.Router();

  // All routes are protected
  router.get('/users-by-role', authMiddleware, staffOnly, analyticsController.getUsersByRole);
  router.get('/active-users', authMiddleware, staffOnly, analyticsController.getActiveUsersCount);
  router.get('/interactions-by-type', authMiddleware, staffOnly, analyticsController.getInteractionsByType);
  router.get('/active-virtual-assets', authMiddleware, staffOnly, analyticsController.getActiveVirtualAssets);
  router.get('/locations', authMiddleware, staffOnly, analyticsController.getLocationsByArea);
  router.get('/users-status', authMiddleware, staffOnly, analyticsController.getUsersStatus);
  router.get('/total-interactions', authMiddleware, staffOnly, analyticsController.getTotalInteractions);
  router.get('/last-access', authMiddleware, staffOnly, analyticsController.getLastAccessDates);
  router.get('/totals', authMiddleware, staffOnly, analyticsController.getTotalCounts);
  router.get('/top-virtual-assets', authMiddleware, staffOnly, analyticsController.getTopVirtualAssets);
  router.get('/top-users', authMiddleware, staffOnly, analyticsController.getTopUsers);
  router.get('/interactions-by-section', authMiddleware, staffOnly, analyticsController.getInteractionsBySection);
  router.get('/time-series-by-section', authMiddleware, staffOnly, analyticsController.getTimeSeriesBySection);

  return router;
};

module.exports = createAnalyticsRoutes;
