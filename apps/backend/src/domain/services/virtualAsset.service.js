const { NotFoundError } = require('../../shared/errors');
const { SYSTEM_USER } = require('../../shared/constants');

/**
 * VirtualAsset Service - Business logic for virtual assets
 */
class VirtualAssetService {
  constructor(virtualAssetRepository) {
    this.repo = virtualAssetRepository;
  }

  /**
   * Get all virtual assets
   * @returns {Promise<Array>}
   */
  async getAll(filters = {}) {
    const options = {};
    if (filters.is_active !== undefined) {
      options.where = { is_active: filters.is_active };
    }
    return this.repo.findAll(options);
  }

  /**
   * Get active virtual assets
   * @returns {Promise<Array>}
   */
  async getActive() {
    return this.repo.findActive();
  }

  /**
   * Get virtual asset by ID
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getById(id) {
    const asset = await this.repo.findById(id);
    if (!asset) {
      throw new NotFoundError('Virtual Asset');
    }
    return asset;
  }

  /**
   * Create virtual asset
   * @param {object} data
   * @param {string} changedBy
   * @returns {Promise<object>}
   */
  async create(data, changedBy = SYSTEM_USER) {
    return this.repo.create(
      {
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
      },
      { audit: { changedBy } },
    );
  }

  /**
   * Update virtual asset
   * @param {string} id
   * @param {object} data
   * @param {string} changedBy
   * @returns {Promise<object>}
   */
  async update(id, data, changedBy = SYSTEM_USER) {
    const asset = await this.getById(id);
    data.updated_at = new Date();
    return asset.update(data, { audit: { changedBy } });
  }

  /**
   * Delete virtual asset
   * @param {string} id
   * @param {string} changedBy
   * @returns {Promise<boolean>}
   */
  async delete(id, changedBy = SYSTEM_USER) {
    return this.repo.delete(id, { audit: { changedBy } });
  }

  /**
   * Soft delete virtual asset
   * @param {string} id
   * @param {string} changedBy
   * @returns {Promise<object>}
   */
  async softDelete(id, changedBy = SYSTEM_USER) {
    return this.repo.softDelete(id, { audit: { changedBy } });
  }

  /**
   * Count active assets
   * @returns {Promise<number>}
   */
  async countActive() {
    return this.repo.countActive();
  }
}

module.exports = VirtualAssetService;
