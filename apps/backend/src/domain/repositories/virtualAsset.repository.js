const BaseRepository = require('./base.repository');

/**
 * VirtualAsset Repository
 */
class VirtualAssetRepository extends BaseRepository {
  constructor(virtualAsset) {
    super(virtualAsset);
  }

  /**
   * Find all active virtual assets
   * @returns {Promise<Array>}
   */
  async findActive() {
    return this.findAll({
      where: { is_active: true },
    });
  }

  /**
   * Find by name
   * @param {string} name
   * @returns {Promise<object|null>}
   */
  async findByName(name) {
    return this.findOne({ name });
  }

  /**
   * Find by category
   * @param {string} category
   * @returns {Promise<Array>}
   */
  async findByCategory(category) {
    return this.findAll({
      where: { category, is_active: true },
    });
  }

  /**
   * Count active assets
   * @returns {Promise<number>}
   */
  async countActive() {
    return this.count({ is_active: true });
  }
}

module.exports = VirtualAssetRepository;
