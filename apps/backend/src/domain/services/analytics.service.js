const { Sequelize, Op } = require('sequelize');

/**
 * Analytics Service - Business logic for analytics and reporting
 * Provides aggregated statistics and reporting capabilities
 */
class AnalyticsService {
  constructor(userRepository, virtualAssetRepository, locationRepository, interactionRepository) {
    this.userRepo = userRepository;
    this.virtualAssetRepo = virtualAssetRepository;
    this.locationRepo = locationRepository;
    this.interactionRepo = interactionRepository;
  }

  /**
   * Get users count by role
   * @returns {Promise<Array<{role: string, count: number}>>}
   */
  async getUsersByRole() {
    // Use repository method if available, fallback to direct query
    if (typeof this.userRepo.countByRole === 'function') {
      return this.userRepo.countByRole();
    }

    // Fallback: access model directly (should be moved to repository)
    const User = this.userRepo.model;
    return User.findAll({
      attributes: ['role', [Sequelize.fn('COUNT', Sequelize.col('role')), 'count']],
      group: ['role'],
      where: { is_active: true, deleted_at: { [Op.is]: null } },
      raw: true,
    });
  }

  /**
   * Get active users count
   * @returns {Promise<number>}
   */
  async getActiveUsersCount() {
    return this.userRepo.count({ is_active: true, deleted_at: { [Op.is]: null } });
  }

  /**
   * Get interactions by type
   * @returns {Promise<Array>}
   */
  async getInteractionsByType() {
    return this.interactionRepo.countByType();
  }

  /**
   * Get active virtual assets count
   * @returns {Promise<number>}
   */
  async getActiveVirtualAssets() {
    return this.virtualAssetRepo.countActive();
  }

  /**
   * Get locations with area info
   * @returns {Promise<Array>}
   */
  async getLocationsByArea() {
    return this.locationRepo.findActive();
  }

  /**
   * Get users status (same as getUsersByRole for now)
   * @returns {Promise<Array>}
   */
  async getUsersStatus() {
    return this.getUsersByRole();
  }

  /**
   * Get total interactions
   * @returns {Promise<{ totalInteractions: number }>}
   */
  async getTotalInteractions() {
    const count = await this.interactionRepo.getTotalCount();
    return { totalInteractions: count };
  }

  /**
   * Get last access dates
   * @returns {Promise<Array>}
   */
  async getLastAccessDates() {
    return this.interactionRepo.getLastAccessDates();
  }

  /**
   * Get total counts for all entities
   * @returns {Promise<object>}
   */
  async getTotalCounts() {
    const [users, virtualAssets, locations, interactions] = await Promise.all([
      this.userRepo.count({ deleted_at: { [Op.is]: null } }),
      this.virtualAssetRepo.count(),
      this.locationRepo.count(),
      this.interactionRepo.count(),
    ]);

    return {
      users,
      virtualAssets,
      locations,
      interactions,
    };
  }

  /**
   * Get top virtual assets by interaction count
   * @param {number} limit - Number of results to return
   * @returns {Promise<Array>}
   */
  async getTopVirtualAssets(limit = 5) {
    return this.interactionRepo.getTopVirtualAssets(limit);
  }

  /**
   * Get top users by interaction count
   * @param {number} limit - Number of results to return
   * @returns {Promise<Array>}
   */
  async getTopUsers(limit = 5) {
    return this.interactionRepo.getTopUsers(limit);
  }

  /**
   * Get interactions grouped by section/area
   * @returns {Promise<Array>}
   */
  async getInteractionsBySection() {
    return this.interactionRepo.getInteractionsBySection();
  }

  /**
   * Get time series of interactions grouped by section
   * @param {string} sectionName - Normalized section name or null for all sections
   * @param {string} range - 'day' | 'month' | 'year'
   * @param {number} offset - Period offset
   * @returns {Promise<Array>}
   */
  async getTimeSeriesBySection(sectionName, range, offset) {
    return this.interactionRepo.getTimeSeriesBySection(sectionName, range, offset);
  }
}

module.exports = AnalyticsService;
