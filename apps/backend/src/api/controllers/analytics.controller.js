const { ResponseUtil } = require('../../shared/utils');

/**
 * Analytics Controller - HTTP request handlers
 */
class AnalyticsController {
  constructor(analyticsService) {
    this.service = analyticsService;
  }

  /**
   * Get users by role
   * GET /api/analytics/users-by-role
   */
  getUsersByRole = async (req, res, next) => {
    try {
      const data = await this.service.getUsersByRole();
      return ResponseUtil.success(res, data, 'Users by role retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get active users count
   * GET /api/analytics/active-users
   */
  getActiveUsersCount = async (req, res, next) => {
    try {
      const count = await this.service.getActiveUsersCount();
      return ResponseUtil.success(res, { activeUsers: count }, 'Active users count retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get interactions by type
   * GET /api/analytics/interactions-by-type
   */
  getInteractionsByType = async (req, res, next) => {
    try {
      const data = await this.service.getInteractionsByType();
      return ResponseUtil.success(res, data, 'Interactions by type retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get active virtual assets count
   * GET /api/analytics/active-virtual-assets
   */
  getActiveVirtualAssets = async (req, res, next) => {
    try {
      const count = await this.service.getActiveVirtualAssets();
      return ResponseUtil.success(res, { activeVirtualAssets: count }, 'Active virtual assets count retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get locations by area
   * GET /api/analytics/locations
   */
  getLocationsByArea = async (req, res, next) => {
    try {
      const data = await this.service.getLocationsByArea();
      return ResponseUtil.success(res, data, 'Locations retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get users status
   * GET /api/analytics/users-status
   */
  getUsersStatus = async (req, res, next) => {
    try {
      const data = await this.service.getUsersStatus();
      return ResponseUtil.success(res, data, 'Users status retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get total interactions
   * GET /api/analytics/total-interactions
   */
  getTotalInteractions = async (req, res, next) => {
    try {
      const data = await this.service.getTotalInteractions();
      return ResponseUtil.success(res, data, 'Total interactions retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get last access dates
   * GET /api/analytics/last-access
   */
  getLastAccessDates = async (req, res, next) => {
    try {
      const data = await this.service.getLastAccessDates();
      return ResponseUtil.success(res, data, 'Last access dates retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get total counts for all entities
   * GET /api/analytics/totals
   */
  getTotalCounts = async (req, res, next) => {
    try {
      const data = await this.service.getTotalCounts();
      return ResponseUtil.success(res, data, 'Total counts retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get top virtual assets by interaction count
   * GET /api/analytics/top-virtual-assets
   */
  getTopVirtualAssets = async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 5;
      const data = await this.service.getTopVirtualAssets(limit);
      return ResponseUtil.success(res, data, 'Top virtual assets retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get top users by interaction count
   * GET /api/analytics/top-users
   */
  getTopUsers = async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 5;
      const data = await this.service.getTopUsers(limit);
      return ResponseUtil.success(res, data, 'Top users retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get interactions grouped by section/area
   * GET /api/analytics/interactions-by-section
   */
  getInteractionsBySection = async (req, res, next) => {
    try {
      const data = await this.service.getInteractionsBySection();
      return ResponseUtil.success(res, data, 'Interactions by section retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get time series of interactions by section
   * GET /api/analytics/time-series-by-section?section=Tierras Bajas&range=day&offset=0
   */
  getTimeSeriesBySection = async (req, res, next) => {
    try {
      const { section, range = 'day', offset = 0 } = req.query;
      const data = await this.service.getTimeSeriesBySection(section || null, range, offset);
      return ResponseUtil.success(res, data, 'Time series by section retrieved');
    } catch (error) {
      next(error);
    }
  };
}

module.exports = AnalyticsController;
