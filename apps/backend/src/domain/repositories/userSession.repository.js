const BaseRepository = require('./base.repository');
const { Op, fn, col, literal } = require('sequelize');

/**
 * Session Repository
 */
class SessionRepository extends BaseRepository {
  constructor(sessionModel) {
    super(sessionModel);
  }

  /**
   * Find sessions by user
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async findByUser(userId) {
    return this.findAll({
      where: { user_id: userId },
      order: [['logged_in_at', 'DESC']],
    });
  }

  /**
   * Find active sessions (not logged out)
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async findActiveSessions(userId) {
    return this.findAll({
      where: {
        user_id: userId,
        logged_out_at: null,
      },
    });
  }

  /**
   * End a session (set logout time)
   * @param {string} sessionId
   * @returns {Promise<object|null>}
   */
  async endSession(sessionId) {
    return this.update(sessionId, { logged_out_at: new Date() });
  }

  /**
   * End all user sessions
   * @param {string} userId
   * @returns {Promise<number>} Number of sessions ended
   */
  async endAllUserSessions(userId) {
    const [count] = await this.model.update(
      { logged_out_at: new Date() },
      { where: { user_id: userId, logged_out_at: null } },
    );
    return count;
  }

  /**
   * Get session time series data
   * @param {string} range - 'day', 'month', 'year'
   * @param {object} filters - { platform, userId }
   * @returns {Promise<Array>} - Array of { date, count }
   */
  async getTimeSeries(range = 'day', filters = {}) {
    const now = new Date();
    const offset = parseInt(filters.offset) || 0;
    let startDate;
    let endDate;
    let dateFormat;

    // Calculate date range based on view type with offset navigation
    switch (range) {
      case 'month':
        // All months of selected year (offset: 0=current, -1=last year, etc.)
        startDate = new Date(now.getFullYear() + offset, 0, 1);
        endDate = new Date(now.getFullYear() + offset, 11, 31, 23, 59, 59, 999);
        dateFormat = 'YYYY-MM';
        break;
      case 'year':
        // Last 5 years from offset base
        startDate = new Date(now.getFullYear() - 4 + offset, 0, 1);
        endDate = new Date(now.getFullYear() + offset, 11, 31, 23, 59, 59, 999);
        dateFormat = 'YYYY';
        break;
      default: // day - all days of selected month
        startDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
        dateFormat = 'YYYY-MM-DD';
    }

    const groupBy = literal(`to_char(logged_in_at, '${dateFormat}')`);

    // Build where clause
    const whereClause = {
      logged_in_at: { [Op.gte]: startDate, [Op.lte]: endDate },
    };

    if (filters.platform) {
      whereClause.platform = filters.platform;
    }

    if (filters.userId) {
      whereClause.user_id = filters.userId;
    }

    const results = await this.model.findAll({
      attributes: [
        [groupBy, 'date'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: whereClause,
      group: [groupBy],
      order: [[groupBy, 'ASC']],
      raw: true,
    });

    // Convert count to number
    return results.map(r => ({
      date: r.date,
      count: Number(r.count),
    }));
  }
}

module.exports = SessionRepository;
