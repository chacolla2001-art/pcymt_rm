/**
 * Base Repository class with common CRUD operations
 * Implements the Repository Pattern for data access abstraction
 */
class BaseRepository {
  // Maximum records to return without explicit pagination
  static MAX_UNPAGINATED_RESULTS = 1000;
  static DEFAULT_PAGE_SIZE = 20;

  constructor(model) {
    if (!model) {
      throw new Error('BaseRepository requires a Sequelize model');
    }
    this.model = model;
    this.primaryKey = model.primaryKeyAttribute || 'id';
  }

  /**
   * Find all records with mandatory limit
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findAll(options = {}) {
    // Enforce maximum limit to prevent unbounded queries
    const limit = Math.min(
      options.limit || BaseRepository.MAX_UNPAGINATED_RESULTS,
      BaseRepository.MAX_UNPAGINATED_RESULTS,
    );

    return this.model.findAll({
      ...options,
      limit,
    });
  }

  /**
   * Find all with pagination
   * @param {object} pagination - Pagination params { limit, offset }
   * @param {object} options - Additional query options
   * @returns {Promise<{ rows: Array, count: number }>}
   */
  async findAndCountAll(pagination = {}, options = {}) {
    const { limit = 10, offset = 0 } = pagination;

    return this.model.findAndCountAll({
      ...options,
      limit,
      offset,
      // Optimize: don't count with associations
      distinct: true,
    });
  }

  /**
   * Find by primary key
   * @param {string} id - Primary key value
   * @param {object} options - Query options
   * @returns {Promise<object|null>}
   */
  async findById(id, options = {}) {
    if (!id) {
      return null;
    }
    return this.model.findByPk(id, options);
  }

  /**
   * Find one record by conditions
   * @param {object} where - Where conditions
   * @param {object} options - Query options
   * @returns {Promise<object|null>}
   */
  async findOne(where, options = {}) {
    return this.model.findOne({ where, ...options });
  }

  /**
   * Find or create a record
   * @param {object} where - Where conditions
   * @param {object} defaults - Default values if creating
   * @param {object} options - Create options
   * @returns {Promise<[object, boolean]>} [record, wasCreated]
   */
  async findOrCreate(where, defaults = {}, options = {}) {
    return this.model.findOrCreate({
      where,
      defaults,
      ...options,
    });
  }

  /**
   * Create a new record
   * @param {object} data - Record data
   * @param {object} options - Create options
   * @returns {Promise<object>}
   */
  async create(data, options = {}) {
    return this.model.create(data, options);
  }

  /**
   * Bulk create records
   * @param {Array} records - Array of record data
   * @param {object} options - Create options
   * @returns {Promise<Array>}
   */
  async bulkCreate(records, options = {}) {
    return this.model.bulkCreate(records, {
      validate: true,
      ...options,
    });
  }

  /**
   * Update a record by id
   * @param {string} id - Primary key value
   * @param {object} data - Update data
   * @param {object} options - Update options
   * @returns {Promise<object|null>}
   */
  async update(id, data, options = {}) {
    const record = await this.findById(id);
    if (!record) {
      return null;
    }
    return record.update(data, options);
  }

  /**
   * Update multiple records
   * @param {object} where - Where conditions
   * @param {object} data - Update data
   * @param {object} options - Update options
   * @returns {Promise<number>} Number of affected rows
   */
  async updateWhere(where, data, options = {}) {
    const [affectedRows] = await this.model.update(data, { where, ...options });
    return affectedRows;
  }

  /**
   * Delete a record by id
   * @param {string} id - Primary key value
   * @param {object} options - Delete options
   * @returns {Promise<boolean>}
   */
  async delete(id, options = {}) {
    const record = await this.findById(id);
    if (!record) {
      return false;
    }
    await record.destroy(options);
    return true;
  }

  /**
   * Soft delete (set active = false)
   * @param {string} id - Primary key value
   * @param {object} options - Update options
   * @returns {Promise<object|null>}
   */
  async softDelete(id, options = {}) {
    return this.update(id, { active: false, deleted_at: new Date() }, options);
  }

  /**
   * Restore soft deleted record
   * @param {string} id - Primary key value
   * @param {object} options - Update options
   * @returns {Promise<object|null>}
   */
  async restore(id, options = {}) {
    return this.update(id, { active: true, deleted_at: null }, options);
  }

  /**
   * Count records
   * @param {object} where - Where conditions
   * @returns {Promise<number>}
   */
  async count(where = {}) {
    return this.model.count({ where });
  }

  /**
   * Check if record exists
   * @param {object} where - Where conditions
   * @returns {Promise<boolean>}
   */
  async exists(where) {
    const count = await this.model.count({ where, limit: 1 });
    return count > 0;
  }

  /**
   * Execute raw query (use sparingly)
   * @param {string} sql - SQL query
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async raw(sql, options = {}) {
    const { sequelize } = this.model;
    return sequelize.query(sql, options);
  }

  /**
   * Execute within a transaction
   * @param {Function} callback - Async function receiving transaction
   * @returns {Promise<*>}
   */
  async transaction(callback) {
    const { sequelize } = this.model;
    return sequelize.transaction(callback);
  }
}

module.exports = BaseRepository;
