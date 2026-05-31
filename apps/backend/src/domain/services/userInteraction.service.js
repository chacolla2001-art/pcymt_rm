const { SYSTEM_USER } = require('../../shared/constants');
const { NotFoundError } = require('../../shared/errors');

/**
 * UserInteraction Service - Business logic for user interactions
 */
class UserInteractionService {
  constructor(userInteractionRepository) {
    this.repo = userInteractionRepository;
  }

  /**
   * Get all interactions
   * @returns {Promise<Array>}
   */
  async getAll() {
    return this.repo.findAll();
  }

  /**
   * Get interaction by ID
   * @param {string} id
   * @returns {Promise<object>}
   * @throws {NotFoundError}
   */
  async getById(id) {
    const interaction = await this.repo.findById(id);
    if (!interaction) {
      throw new NotFoundError('User Interaction');
    }
    return interaction;
  }

  /**
   * Get interactions by user
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async getByUser(userId) {
    return this.repo.findByUser(userId);
  }

  /**
   * Create interaction
   * @param {object} data
   * @param {string} changedBy
   * @returns {Promise<object>}
   */
  async create(data, changedBy = SYSTEM_USER) {
    return this.repo.create(
      {
        ...data,
        created_at: new Date(),
      },
    );
  }

  /**
   * Get interaction counts by type
   * @returns {Promise<Array>}
   */
  async countByType() {
    return this.repo.countByType();
  }

  /**
   * Get total interactions count
   * @returns {Promise<number>}
   */
  async getTotalCount() {
    return this.repo.getTotalCount();
  }

  /**
   * Get last access dates for users
   * @returns {Promise<Array>}
   */
  async getLastAccessDates() {
    return this.repo.getLastAccessDates();
  }

  /**
   * Get interactions by virtual asset with time series aggregation
   * @param {string} assetId - Virtual asset ID
   * @param {string} range - Time range: 'day', 'month', 'year'
   * @param {string} interactionType - Optional interaction type filter
   * @returns {Promise<Array>}
   */
  async getByVirtualAssetTimeSeries(assetId, range = 'day', interactionType, offset = 0) {
    return this.repo.getTimeSeriesByVirtualAsset(assetId, range, interactionType, offset);
  }

  /**
   * Reset game for a user: delete all their interactions
   * @param {string} userId
   * @returns {Promise<number>} number of deleted interactions
   */
  async resetGameForUser(userId) {
    return this.repo.deleteByUser(userId);
  }
}

module.exports = UserInteractionService;
