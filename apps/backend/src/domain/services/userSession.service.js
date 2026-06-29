const { NotFoundError } = require('../../shared/errors');

/**
 * UserSession Service - Business logic for user sessions
 */
class UserSessionService {
  constructor(userSessionRepository) {
    this.repo = userSessionRepository;
  }

  /**
   * Get all sessions
   * @returns {Promise<Array>}
   */
  async getAll() {
    return this.repo.findAll();
  }

  /**
   * Get session by ID
   * @param {string} id
   * @returns {Promise<object>}
   * @throws {NotFoundError}
   */
  async getById(id) {
    const session = await this.repo.findById(id);
    if (!session) {
      throw new NotFoundError('User Session');
    }
    return session;
  }

  /**
   * Get sessions by user
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async getByUser(userId) {
    return this.repo.findByUser(userId);
  }

  /**
   * Create a session
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(data) {
    return this.repo.create({
      ...data,
      logged_in_at: new Date(),
    });
  }

  /**
   * End a session
   * @param {string} sessionId
   * @returns {Promise<object>}
   */
  async endSession(sessionId) {
    return this.repo.endSession(sessionId);
  }

  /**
   * End all user sessions
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async endAllUserSessions(userId) {
    return this.repo.endAllUserSessions(userId);
  }

  /**
   * Get active sessions for user
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async getActiveSessions(userId) {
    return this.repo.findActiveSessions(userId);
  }

  /**
   * Get session time series data
   * @param {string} range - 'day', 'month', 'year'
   * @param {object} filters - { platform, userId }
   * @returns {Promise<Array>}
   */
  async getTimeSeries(range, filters = {}) {
    return this.repo.getTimeSeries(range, filters);
  }
}

module.exports = UserSessionService;
