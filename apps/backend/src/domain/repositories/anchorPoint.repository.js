const { Op } = require('sequelize');
const BaseRepository = require('./base.repository');

/**
 * Location Repository
 * Handles data access for AR locations (physical markers)
 */
class LocationRepository extends BaseRepository {
  constructor(locationModel) {
    super(locationModel);
  }

  /**
   * Find all active locations
   * @returns {Promise<Array>}
   */
  async findActive() {
    return this.findAll({
      where: { is_active: true },
    });
  }

  /**
   * Find by virtual asset ID
   * @param {string} virtualAssetId
   * @returns {Promise<Array>}
   */
  async findByVirtualAsset(virtualAssetId) {
    return this.findAll({
      where: { virtual_asset_id: virtualAssetId, is_active: true },
    });
  }

  /**
   * Find locations within a bounding box
   * @param {object} bounds - { minLat, maxLat, minLng, maxLng }
   * @returns {Promise<Array>}
   */
  async findInBounds({ minLat, maxLat, minLng, maxLng }) {
    return this.findAll({
      where: {
        is_active: true,
        latitude: { [Op.between]: [minLat, maxLat] },
        longitude: { [Op.between]: [minLng, maxLng] },
      },
    });
  }

  /**
   * Find active locations grouped by virtual_asset_id for cluster detection.
   * Only includes locations that have a virtual_asset_id assigned.
   * @returns {Promise<Array>}
   */
  async findActiveGroupedByAsset() {
    return this.findAll({
      where: {
        is_active: true,
        virtual_asset_id: { [Op.ne]: null },
      },
      order: [['virtual_asset_id', 'ASC'], ['name', 'ASC']],
    });
  }
}

module.exports = LocationRepository;
