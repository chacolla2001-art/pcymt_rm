const { NotFoundError } = require('../../shared/errors');

/**
 * Normalize data from frontend (camelCase) to database (snake_case)
 */
const normalizeData = (data) => {
  const normalized = {};
  const fieldMap = {
    userId: 'user_id',
    configData: 'config_data',
    isPublic: 'is_public',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    const normalizedKey = fieldMap[key] || key;
    normalized[normalizedKey] = value;
  }

  return normalized;
};

/**
 * MapConfiguration Service - Business logic for map layer configurations
 */
class MapConfigurationService {
  constructor(mapConfigurationRepository) {
    this.repo = mapConfigurationRepository;
  }

  /**
   * Get all configurations for a user (own + public)
   * @param {string} userId
   * @param {string} platform - 'mobile' | 'web' | null
   * @returns {Promise<Array>}
   */
  async getAvailable(userId, platform = null) {
    return this.repo.findAvailable(userId, platform);
  }

  /**
   * Get user's own configurations
   * @param {string} userId
   * @param {string} platform - 'mobile' | 'web' | null
   * @returns {Promise<Array>}
   */
  async getByUser(userId, platform = null) {
    return this.repo.findByUser(userId, platform);
  }

  /**
   * Get public configurations
   * @param {string} platform - 'mobile' | 'web' | null
   * @returns {Promise<Array>}
   */
  async getPublic(platform = null) {
    return this.repo.findPublic(platform);
  }

  /**
   * Get configuration by ID
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getById(id) {
    const config = await this.repo.findById(id);
    if (!config) {
      throw new NotFoundError('Map Configuration');
    }
    return config;
  }

  /**
   * Create a new map configuration
   * @param {object} data
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async create(data, userId) {
    const normalized = normalizeData(data);
    return this.repo.create({
      ...normalized,
      user_id: userId,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  /**
   * Update a map configuration
   * @param {string} id
   * @param {object} data
   * @param {string} userId - Must be owner
   * @returns {Promise<object>}
   */
  async update(id, data, userId) {
    const config = await this.getById(id);

    // Only owner can update
    if (config.user_id !== userId) {
      throw new Error('No tienes permiso para editar esta configuración');
    }

    const normalized = normalizeData(data);
    normalized.updated_at = new Date();
    delete normalized.id;
    delete normalized.user_id;
    delete normalized.created_at;

    return config.update(normalized);
  }

  /**
   * Delete a map configuration
   * @param {string} id
   * @param {string} userId - Must be owner
   * @returns {Promise<boolean>}
   */
  async delete(id, userId) {
    const config = await this.getById(id);

    if (config.user_id !== userId) {
      throw new Error('No tienes permiso para eliminar esta configuración');
    }

    return this.repo.delete(id);
  }

  /**
   * Get the single global web configuration (null if not saved yet)
   * @returns {Promise<object|null>}
   */
  async getGlobal() {
    return this.repo.findGlobal();
  }

  /**
   * Create or replace the single global web configuration
   * @param {object} configData - raw config_data JSON
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async upsertGlobal(configData, userId) {
    return this.repo.upsertGlobal(configData, userId);
  }
}

module.exports = MapConfigurationService;
