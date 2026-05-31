const { ResponseUtil } = require('../../shared/utils');

/**
 * MapConfiguration Controller - HTTP request handlers for map layer configs
 */
class MapConfigurationController {
  constructor(mapConfigurationService) {
    this.service = mapConfigurationService;
  }

  /**
   * Get available configs (own + public)
   * GET /api/map-configurations
   * Query: ?platform=mobile|web
   */
  getAvailable = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const { platform } = req.query;
      const configs = await this.service.getAvailable(userId, platform || null);
      return ResponseUtil.success(res, configs, 'Map configurations retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user's own configs
   * GET /api/map-configurations/mine
   * Query: ?platform=mobile|web
   */
  getMine = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const { platform } = req.query;
      const configs = await this.service.getByUser(userId, platform || null);
      return ResponseUtil.success(res, configs, 'User map configurations retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get public configs
   * GET /api/map-configurations/public
   * Query: ?platform=mobile|web
   */
  getPublic = async (req, res, next) => {
    try {
      const { platform } = req.query;
      const configs = await this.service.getPublic(platform || null);
      return ResponseUtil.success(res, configs, 'Public map configurations retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get config by ID
   * GET /api/map-configurations/:id
   */
  getById = async (req, res, next) => {
    try {
      const config = await this.service.getById(req.params.id);
      return ResponseUtil.success(res, config, 'Map configuration retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create a new config
   * POST /api/map-configurations
   */
  create = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const config = await this.service.create(req.body, userId);
      return ResponseUtil.created(res, config, 'Map configuration created');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update a config
   * PUT /api/map-configurations/:id
   */
  update = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const config = await this.service.update(req.params.id, req.body, userId);
      return ResponseUtil.success(res, config, 'Map configuration updated');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete a config
   * DELETE /api/map-configurations/:id
   */
  delete = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      await this.service.delete(req.params.id, userId);
      return ResponseUtil.success(res, null, 'Map configuration deleted');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get the single global web configuration
   * GET /api/map-configurations/global
   */
  getGlobal = async (req, res, next) => {
    try {
      const config = await this.service.getGlobal();
      return ResponseUtil.success(res, config, 'Global map configuration retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Save (upsert) the single global web configuration
   * PUT /api/map-configurations/global
   * Body: { config_data: {...} }
   */
  upsertGlobal = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const { config_data } = req.body;
      if (!config_data) {
        return res.status(400).json({ success: false, message: 'config_data is required' });
      }
      const config = await this.service.upsertGlobal(config_data, userId);
      return ResponseUtil.success(res, config, 'Global map configuration saved');
    } catch (error) {
      next(error);
    }
  };
}

module.exports = MapConfigurationController;
