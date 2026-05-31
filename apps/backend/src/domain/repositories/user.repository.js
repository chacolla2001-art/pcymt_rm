const { Sequelize, Op } = require('sequelize');
const BaseRepository = require('./base.repository');

/**
 * User Repository
 * Handles data access for user entities
 */
class UserRepository extends BaseRepository {
  constructor(userModel) {
    super(userModel);
  }

  /**
   * Find user by email
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async findByEmail(email) {
    if (!email) {
      return null;
    }
    return this.findOne({
      email: email.toLowerCase(),
      deleted_at: { [Op.is]: null },
    });
  }

  /**
   * Find user by name (partial match)
   * @param {string} name
   * @returns {Promise<object|null>}
   */
  async findByUsername(name) {
    if (!name) {
      return null;
    }
    return this.findOne({
      name,
      deleted_at: { [Op.is]: null },
    });
  }

  /**
   * Find all active users
   * @returns {Promise<Array>}
   */
  async findActive() {
    return this.findAll({
      where: { is_active: true, deleted_at: { [Op.is]: null } },
    });
  }

  /**
   * Find user by Google ID
   * @param {string} googleId
   * @returns {Promise<object|null>}
   */
  async findByGoogleId(googleId) {
    if (!googleId) {
      return null;
    }
    return this.findOne({
      google_id: googleId,
      deleted_at: { [Op.is]: null },
    });
  }

  /**
   * Find user by Google ID including soft-deleted records
   * @param {string} googleId
   * @returns {Promise<object|null>}
   */
  async findByGoogleIdAny(googleId) {
    if (!googleId) return null;
    return this.model.findOne({ where: { google_id: googleId }, paranoid: false });
  }

  /**
   * Count users grouped by role
   * @returns {Promise<Array<{role: string, count: number}>>}
   */
  async countByRole() {
    return this.model.findAll({
      attributes: [
        'role',
        [Sequelize.fn('COUNT', Sequelize.col('role')), 'count'],
      ],
      group: ['role'],
      where: { is_active: true, deleted_at: null },
      raw: true,
    });
  }

  /**
   * Update user password
   * @param {string} id - User ID
   * @param {string} hashedPassword - New hashed password
   * @param {object} options - Update options
   * @returns {Promise<object|null>}
   */
  async updatePassword(id, hashedPassword, options = {}) {
    return this.update(id, { password_hash: hashedPassword }, options);
  }

  /**
   * Toggle user active status
   * @param {string} id - User ID
   * @param {boolean} isActive - Active status
   * @param {object} options - Update options
   * @returns {Promise<object|null>}
   */
  async toggleActive(id, isActive, options = {}) {
    return this.update(id, { is_active: isActive }, options);
  }

  /**
   * Check if email exists
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  async emailExists(email) {
    return this.exists({ email, deleted_at: { [Op.is]: null } });
  }

  /**
   * Find user by email including soft-deleted records
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async findByEmailAny(email) {
    if (!email) return null;
    return this.model.findOne({ where: { email }, paranoid: false });
  }

  /**
   * Find a soft-deleted user by id (paranoid: bypass deleted_at filter)
   * Needed to restore a user or inspect deleted records.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findDeleted(id) {
    if (!id) return null;
    return this.model.findOne({
      where: { id, deleted_at: { [Op.ne]: null } },
      paranoid: false,
    });
  }

  /**
   * Find all soft-deleted users
   * @returns {Promise<Array>}
   */
  async findAllDeleted() {
    return this.model.findAll({
      where: { deleted_at: { [Op.ne]: null } },
      paranoid: false,
    });
  }

}

module.exports = UserRepository;
