const { NotFoundError } = require('../errors');
const { appCache } = require('./index');

/**
 * Base Service class with common business logic patterns
 * Provides caching and standard CRUD operations
 */
class BaseService {
  /**
   * @param {object} repository - Repository instance
   * @param {object} options - Service options
   */
  constructor(repository, options = {}) {
    if (!repository) {
      throw new Error('BaseService requires a repository instance');
    }

    this.repo = repository;
    this.entityName = options.entityName || 'Resource';
    this.cacheEnabled = options.cacheEnabled !== false;
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes
    this.cachePrefix = options.cachePrefix || this.entityName.toLowerCase();
  }

  /**
   * Get cache key for entity
   * @protected
   */
  _getCacheKey(id) {
    return `${this.cachePrefix}:${id}`;
  }

  /**
   * Get cache key for list
   * @protected
   */
  _getListCacheKey(params = {}) {
    return `${this.cachePrefix}:list:${JSON.stringify(params)}`;
  }

  /**
   * Invalidate entity cache
   * @protected
   */
  _invalidateCache(id) {
    if (!this.cacheEnabled) {
      return;
    }

    appCache.delete(this._getCacheKey(id));
    appCache.deletePattern(`${this.cachePrefix}:list:*`);
  }

  /**
   * Get all entities
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async getAll(options = {}) {
    if (!this.cacheEnabled) {
      return this.repo.findAll(options);
    }

    return appCache.getOrSet(
      this._getListCacheKey(options),
      () => this.repo.findAll(options),
      this.cacheTTL,
    );
  }

  /**
   * Get entity by ID
   * @param {string} id - Entity ID
   * @param {object} options - Query options
   * @returns {Promise<object>}
   * @throws {NotFoundError}
   */
  async getById(id, options = {}) {
    const fetchFn = async () => {
      const entity = await this.repo.findById(id, options);
      if (!entity) {
        throw new NotFoundError(this.entityName);
      }
      return entity;
    };

    if (!this.cacheEnabled) {
      return fetchFn();
    }

    // Don't cache null results
    const cached = appCache.get(this._getCacheKey(id));
    if (cached) {
      return cached;
    }

    const entity = await fetchFn();
    appCache.set(this._getCacheKey(id), entity, this.cacheTTL);
    return entity;
  }

  /**
   * Create entity
   * @param {object} data - Entity data
   * @param {string} changedBy - User making the change
   * @returns {Promise<object>}
   */
  async create(data, changedBy = 'system') {
    const entity = await this.repo.create(
      {
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
      },
    );

    this._invalidateCache(entity[this.repo.primaryKey]);
    return entity;
  }

  /**
   * Update entity
   * @param {string} id - Entity ID
   * @param {object} data - Update data
   * @param {string} changedBy - User making the change
   * @returns {Promise<object>}
   */
  async update(id, data, changedBy = 'system') {
    const entity = await this.getById(id);

    const updated = await entity.update(
      { ...data, updated_at: new Date() },
    );

    this._invalidateCache(id);
    return updated;
  }

  /**
   * Delete entity (hard delete)
   * @param {string} id - Entity ID
   * @param {string} changedBy - User making the change
   * @returns {Promise<boolean>}
   */
  async delete(id, changedBy = 'system') {
    const result = await this.repo.delete(id);

    if (result) {
      this._invalidateCache(id);
    }

    return result;
  }

  /**
   * Soft delete entity
   * @param {string} id - Entity ID
   * @param {string} changedBy - User making the change
   * @returns {Promise<object>}
   */
  async softDelete(id, changedBy = 'system') {
    const result = await this.repo.softDelete(id);
    this._invalidateCache(id);
    return result;
  }

  /**
   * Check if entity exists
   * @param {object} where - Where conditions
   * @returns {Promise<boolean>}
   */
  async exists(where) {
    return this.repo.exists(where);
  }

  /**
   * Count entities
   * @param {object} where - Where conditions
   * @returns {Promise<number>}
   */
  async count(where = {}) {
    return this.repo.count(where);
  }

  /**
   * Get paginated results
   * @param {object} pagination - { page, limit }
   * @param {object} options - Query options
   * @returns {Promise<{ data: Array, pagination: object }>}
   */
  async getPaginated(pagination = {}, options = {}) {
    const page = Math.max(1, parseInt(pagination.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(pagination.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const { rows, count } = await this.repo.findAndCountAll(
      { limit, offset },
      options,
    );

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
        hasNext: page * limit < count,
        hasPrev: page > 1,
      },
    };
  }
}

module.exports = BaseService;
