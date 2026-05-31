const express = require('express');

/**
 * Create analytics routes
 * @param {object} analyticsController - Analytics controller instance
 * @param {object} authMiddleware - Auth middleware
 * @returns {Router}
 */
const createAnalyticsRoutes = (analyticsController, authMiddleware) => {
  const router = express.Router();

  // All routes are protected
  router.get('/users-by-role', authMiddleware, analyticsController.getUsersByRole);
  router.get('/active-users', authMiddleware, analyticsController.getActiveUsersCount);
  router.get('/interactions-by-type', authMiddleware, analyticsController.getInteractionsByType);
  router.get('/active-virtual-assets', authMiddleware, analyticsController.getActiveVirtualAssets);
  router.get('/locations', authMiddleware, analyticsController.getLocationsByArea);
  router.get('/users-status', authMiddleware, analyticsController.getUsersStatus);
  router.get('/total-interactions', authMiddleware, analyticsController.getTotalInteractions);
  router.get('/last-access', authMiddleware, analyticsController.getLastAccessDates);
  router.get('/totals', authMiddleware, analyticsController.getTotalCounts);
  router.get('/top-virtual-assets', authMiddleware, analyticsController.getTopVirtualAssets);
  router.get('/top-users', authMiddleware, analyticsController.getTopUsers);
  router.get('/interactions-by-section', authMiddleware, analyticsController.getInteractionsBySection);
  router.get('/time-series-by-section', authMiddleware, analyticsController.getTimeSeriesBySection);

  return router;
};

module.exports = createAnalyticsRoutes;
