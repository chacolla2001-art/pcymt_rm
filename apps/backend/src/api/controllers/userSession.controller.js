const { ResponseUtil } = require('../../shared/utils');

/**
 * UserSession Controller - HTTP request handlers
 */
class UserSessionController {
  constructor(userSessionService) {
    this.service = userSessionService;
  }

  /**
   * Get all sessions
   * GET /api/usersessions
   */
  getAll = async (req, res, next) => {
    try {
      const sessions = await this.service.getAll();
      return ResponseUtil.success(res, sessions, 'Sessions retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get session by ID
   * GET /api/usersessions/:id
   */
  getById = async (req, res, next) => {
    try {
      const session = await this.service.getById(req.params.id);
      return ResponseUtil.success(res, session, 'Session retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get sessions by user
   * GET /api/usersessions/user/:userId
   */
  getByUser = async (req, res, next) => {
    try {
      const sessions = await this.service.getByUser(req.params.userId);
      return ResponseUtil.success(res, sessions, 'User sessions retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * End a session
   * POST /api/usersessions/:id/end
   */
  endSession = async (req, res, next) => {
    try {
      const session = await this.service.endSession(req.params.id);
      return ResponseUtil.success(res, session, 'Session ended');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get session time series data
   * GET /api/usersessions/time-series
   * Query params: range (day|month|year), platform (web|mobile), userId
   */
  getTimeSeries = async (req, res, next) => {
    try {
      const { range = 'day', platform, userId, offset } = req.query;
      const data = await this.service.getTimeSeries(range, { platform, userId, offset });
      return ResponseUtil.success(res, data, 'Session time series retrieved');
    } catch (error) {
      next(error);
    }
  };
}

module.exports = UserSessionController;
