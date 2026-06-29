const BaseRepository = require('./base.repository');

/**
 * MapConfiguration Repository
 * Handles data access for map layer configurations
 */
class MapConfigurationRepository extends BaseRepository {
  constructor(mapConfigurationModel) {
    super(mapConfigurationModel);
  }

  /**
   * Find all configurations by user
   * @param {string} userId
   * @param {string} platform - 'mobile' | 'web' | null (all)
   * @returns {Promise<Array>}
   */
  async findByUser(userId, platform = null) {
    const where = { user_id: userId };
    if (platform) where.platform = platform;
    return this.findAll({
      where,
      order: [['updated_at', 'DESC']],
    });
  }

  /**
   * Find public configurations (shareable layers)
   * @param {string} platform - 'mobile' | 'web' | null (all)
   * @returns {Promise<Array>}
   */
  async findPublic(platform = null) {
    const where = { is_public: true };
    if (platform) where.platform = platform;
    return this.findAll({
      where,
      order: [['updated_at', 'DESC']],
    });
  }

  /**
   * Find configs available to a user (own + public)
   * @param {string} userId
   * @param {string} platform
   * @returns {Promise<Array>}
   */
  async findAvailable(userId, platform = null) {
    const { Op } = require('sequelize');
    const where = {
      [Op.or]: [
        { user_id: userId },
        { is_public: true },
      ],
    };
    if (platform) where.platform = platform;
    return this.findAll({
      where,
      order: [['updated_at', 'DESC']],
    });
  }

  /**
   * Find the single global web config
   * @returns {Promise<object|null>}
   */
  async findGlobal() {
    return this.model.findOne({
      where: { name: '__global__', platform: 'web' },
    });
  }

  /**
   * Create or update the single global web config
   * @param {object} configData - raw config_data JSON
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async upsertGlobal(configData, userId) {
    let record = await this.model.findOne({
      where: { name: '__global__', platform: 'web' },
    });
    if (record) {
      await record.update({
        config_data: configData,
        user_id: userId,
        updated_at: new Date(),
      });
      // Reload from DB so the returned record reflects the actual persisted JSONB value
      await record.reload();
      return record;
    }
    return this.model.create({
      name: '__global__',
      platform: 'web',
      config_data: configData,
      is_public: true,
      user_id: userId,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }
}

module.exports = MapConfigurationRepository;
