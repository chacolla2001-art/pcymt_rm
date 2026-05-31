const { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require('../constants');

/**
 * Pagination utility
 */
class PaginationUtil {
  /**
   * Parse pagination parameters from request query
   * @param {object} query - Request query object
   * @returns {object} Pagination parameters
   */
  static parse(query) {
    let page = parseInt(query.page, 10) || 1;
    let limit = parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE;

    // Ensure valid values
    page = Math.max(1, page);
    limit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);

    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * Calculate pagination metadata
   * @param {number} total - Total number of items
   * @param {number} page - Current page
   * @param {number} limit - Items per page
   * @returns {object} Pagination metadata
   */
  static getMeta(total, page, limit) {
    const totalPages = Math.ceil(total / limit);

    return {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * Build paginated result
   * @param {Array} data - Data array
   * @param {number} total - Total count
   * @param {number} page - Current page
   * @param {number} limit - Page size
   * @returns {object} Paginated result
   */
  static buildResult(data, total, page, limit) {
    return {
      data,
      ...this.getMeta(total, page, limit),
    };
  }
}

module.exports = PaginationUtil;
