const BaseRepository = require('./base.repository');
const { Sequelize } = require('sequelize');

/**
 * Interaction Repository
 */
class InteractionRepository extends BaseRepository {
  constructor(interactionModel) {
    super(interactionModel);
  }

  /**
   * Find interactions by user
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async findByUser(userId) {
    return this.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
    });
  }

  /**
   * Delete all interactions for a user (game reset)
   * @param {string} userId
   * @returns {Promise<number>} number of deleted records
   */
  async deleteByUser(userId) {
    return this.model.destroy({ where: { user_id: userId } });
  }

  /**
   * Find interactions by type
   * @param {string} interactionType
   * @returns {Promise<Array>}
   */
  async findByType(interactionType) {
    return this.findAll({
      where: { interaction_type: interactionType },
    });
  }

  /**
   * Count interactions by type
   * @returns {Promise<Array>}
   */
  async countByType() {
    return this.model.findAll({
      attributes: [
        'interaction_type',
        [Sequelize.fn('COUNT', Sequelize.col('interaction_type')), 'count'],
      ],
      group: ['interaction_type'],
    });
  }

  /**
   * Get last access dates for users
   * @returns {Promise<Array>}
   */
  async getLastAccessDates() {
    return this.model.findAll({
      attributes: [
        'user_id',
        [Sequelize.fn('MAX', Sequelize.col('created_at')), 'lastAccessDate'],
      ],
      group: ['user_id'],
      order: [[Sequelize.fn('MAX', Sequelize.col('created_at')), 'DESC']],
    });
  }

  /**
   * Get total interaction count
   * @returns {Promise<number>}
   */
  async getTotalCount() {
    return this.count();
  }

  /**
   * Get time series of interactions for a virtual asset
   * @param {string} assetId - Virtual asset ID
   * @param {string} range - Time range: 'day', 'month', 'year'
   * @param {string} interactionType - Optional interaction type filter
   * @returns {Promise<Array>} Array of { date, interactionType, count }
   */
  async getTimeSeriesByVirtualAsset(assetId, range = 'day', interactionType, offset = 0) {
    const dateFormat = range === 'year' ? 'YYYY' : range === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
    const now = new Date();
    const parsedOffset = parseInt(offset) || 0;

    const where = { virtual_asset_id: assetId };

    // Add date range based on period + offset
    if (range === 'day') {
      const start = new Date(now.getFullYear(), now.getMonth() + parsedOffset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + parsedOffset + 1, 0, 23, 59, 59, 999);
      where.created_at = { [Sequelize.Op.gte]: start, [Sequelize.Op.lte]: end };
    } else if (range === 'month') {
      const start = new Date(now.getFullYear() + parsedOffset, 0, 1);
      const end = new Date(now.getFullYear() + parsedOffset, 11, 31, 23, 59, 59, 999);
      where.created_at = { [Sequelize.Op.gte]: start, [Sequelize.Op.lte]: end };
    } else {
      const start = new Date(now.getFullYear() - 4 + parsedOffset, 0, 1);
      const end = new Date(now.getFullYear() + parsedOffset, 11, 31, 23, 59, 59, 999);
      where.created_at = { [Sequelize.Op.gte]: start, [Sequelize.Op.lte]: end };
    }

    if (interactionType !== undefined && interactionType !== null && interactionType !== '') {
      where.interaction_type = interactionType;
    }

    const results = await this.model.findAll({
      attributes: [
        [Sequelize.fn('to_char', Sequelize.col('created_at'), dateFormat), 'date'],
        ['interaction_type', 'interactionType'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
      ],
      where,
      group: [Sequelize.fn('to_char', Sequelize.col('created_at'), dateFormat), 'interaction_type'],
      order: [[Sequelize.fn('to_char', Sequelize.col('created_at'), dateFormat), 'ASC']],
      raw: true,
    });

    // Convert to proper types
    return results.map(r => ({
      date: r.date,
      interactionType: r.interactionType,
      count: Number(r.count),
    }));
  }

  /**
   * Get top virtual assets by interaction count (with name)
   * @param {number} limit - Number of results to return
   * @returns {Promise<Array>}
   */
  async getTopVirtualAssets(limit = 5) {
    return this.model.sequelize.query(`
      SELECT
        i.virtual_asset_id,
        va.name,
        va.icon_url,
        COUNT(i.id) as "interactionCount"
      FROM interactions i
      LEFT JOIN virtual_assets va ON i.virtual_asset_id = va.id
      WHERE i.virtual_asset_id IS NOT NULL
      GROUP BY i.virtual_asset_id, va.name, va.icon_url
      ORDER BY "interactionCount" DESC
      LIMIT :limit
    `, {
      replacements: { limit },
      type: Sequelize.QueryTypes.SELECT,
    });
  }

  /**
   * Get top users by interaction count (with name)
   * @param {number} limit - Number of results to return
   * @returns {Promise<Array>}
   */
  async getTopUsers(limit = 5) {
    return this.model.sequelize.query(`
      SELECT
        i.user_id,
        u.name,
        COUNT(i.id) as "interactionCount"
      FROM interactions i
      LEFT JOIN users u ON i.user_id = u.id
      GROUP BY i.user_id, u.name
      ORDER BY "interactionCount" DESC
      LIMIT :limit
    `, {
      replacements: { limit },
      type: Sequelize.QueryTypes.SELECT,
    });
  }

  /**
   * Get time series of interactions grouped by section
   * @param {string} sectionName - Normalized section name (e.g. 'Tierras Bajas') or null for ALL sections
   * @param {string} range - 'day' | 'month' | 'year'
   * @param {number} offset - Period offset (0 = current)
   * @returns {Promise<Array>} Array of { date, section?, count }
   */
  async getTimeSeriesBySection(sectionName, range = 'day', offset = 0) {
    const dateFormat = range === 'year' ? 'YYYY' : range === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
    const now = new Date();
    const parsedOffset = parseInt(offset) || 0;

    let startDate, endDate;
    if (range === 'day') {
      startDate = new Date(now.getFullYear(), now.getMonth() + parsedOffset, 1);
      endDate   = new Date(now.getFullYear(), now.getMonth() + parsedOffset + 1, 0, 23, 59, 59, 999);
    } else if (range === 'month') {
      startDate = new Date(now.getFullYear() + parsedOffset, 0, 1);
      endDate   = new Date(now.getFullYear() + parsedOffset, 11, 31, 23, 59, 59, 999);
    } else {
      startDate = new Date(now.getFullYear() - 4 + parsedOffset, 0, 1);
      endDate   = new Date(now.getFullYear() + parsedOffset, 11, 31, 23, 59, 59, 999);
    }

    const sectionCase = `
      CASE
        WHEN l.section IN ('1', 'Tierras Altas')     THEN 'Tierras Altas'
        WHEN l.section IN ('2', 'Tierras Medias')    THEN 'Tierras Medias'
        WHEN l.section IN ('3', 'Tierras Bajas')     THEN 'Tierras Bajas'
        WHEN l.section IN ('4', 'Mitos y Leyendas')  THEN 'Mitos y Leyendas'
        ELSE 'Sin clasificar'
      END`;

    if (sectionName) {
      // Single section: return [{ date, count }]
      const rows = await this.model.sequelize.query(`
        SELECT
          to_char(i.created_at, :dateFormat) AS date,
          COUNT(i.id) AS count
        FROM interactions i
        LEFT JOIN virtual_assets va ON i.virtual_asset_id = va.id
        LEFT JOIN locations l ON l.virtual_asset_id = va.id
        WHERE i.created_at >= :startDate AND i.created_at <= :endDate
          AND ${sectionCase} = :sectionName
        GROUP BY to_char(i.created_at, :dateFormat)
        ORDER BY date ASC
      `, {
        replacements: { dateFormat, startDate, endDate, sectionName },
        type: Sequelize.QueryTypes.SELECT,
      });
      return rows.map(r => ({ date: r.date, count: Number(r.count) }));
    } else {
      // All sections: return [{ date, section, count }]
      const rows = await this.model.sequelize.query(`
        SELECT
          to_char(i.created_at, :dateFormat) AS date,
          ${sectionCase} AS section,
          COUNT(i.id) AS count
        FROM interactions i
        LEFT JOIN virtual_assets va ON i.virtual_asset_id = va.id
        LEFT JOIN locations l ON l.virtual_asset_id = va.id
        WHERE i.created_at >= :startDate AND i.created_at <= :endDate
        GROUP BY to_char(i.created_at, :dateFormat), ${sectionCase}
        ORDER BY date ASC
      `, {
        replacements: { dateFormat, startDate, endDate },
        type: Sequelize.QueryTypes.SELECT,
      });
      return rows.map(r => ({ date: r.date, section: r.section, count: Number(r.count) }));
    }
  }

  /**
   * Get interactions grouped by section (based on virtual asset location)
   * Handles both section codes ('1', '2', '3', '4') and full names
   * Sections: Tierras Altas, Tierras Medias, Tierras Bajas, Mitos y Leyendas
   * @returns {Promise<Array>}
   */
  async getInteractionsBySection() {
    return this.model.sequelize.query(`
      SELECT
        CASE
          WHEN l.section IN ('1', 'Tierras Altas') THEN 'Tierras Altas'
          WHEN l.section IN ('2', 'Tierras Medias') THEN 'Tierras Medias'
          WHEN l.section IN ('3', 'Tierras Bajas') THEN 'Tierras Bajas'
          WHEN l.section IN ('4', 'Mitos y Leyendas') THEN 'Mitos y Leyendas'
          ELSE 'Sin clasificar'
        END as section,
        COUNT(i.id) as "interactionCount"
      FROM interactions i
      LEFT JOIN virtual_assets va ON i.virtual_asset_id = va.id
      LEFT JOIN locations l ON l.virtual_asset_id = va.id
      GROUP BY
        CASE
          WHEN l.section IN ('1', 'Tierras Altas') THEN 'Tierras Altas'
          WHEN l.section IN ('2', 'Tierras Medias') THEN 'Tierras Medias'
          WHEN l.section IN ('3', 'Tierras Bajas') THEN 'Tierras Bajas'
          WHEN l.section IN ('4', 'Mitos y Leyendas') THEN 'Mitos y Leyendas'
          ELSE 'Sin clasificar'
        END
      ORDER BY "interactionCount" DESC
    `, { type: Sequelize.QueryTypes.SELECT });
  }
}

module.exports = InteractionRepository;
