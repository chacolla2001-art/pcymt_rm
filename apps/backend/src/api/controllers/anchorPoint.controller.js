const { ResponseUtil } = require('../../shared/utils');
const { SYSTEM_USER } = require('../../shared/constants');

/**
 * AnchorPoint Controller - HTTP request handlers
 */
class AnchorPointController {
  constructor(anchorPointService) {
    this.service = anchorPointService;
  }

  /**
   * Get all anchor points
   * GET /api/anchorpoints
   */
  getAll = async (req, res, next) => {
    try {
      const { is_active } = req.query;
      const filters = {};
      if (is_active !== undefined) {
        filters.is_active = is_active === 'true';
      }
      const points = await this.service.getAll(filters);
      return ResponseUtil.success(res, points, 'Anchor points retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get active anchor points
   * GET /api/anchorpoints/active
   */
  getActive = async (req, res, next) => {
    try {
      const points = await this.service.getActive();
      return ResponseUtil.success(res, points, 'Active anchor points retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get anchor point by ID
   * GET /api/anchorpoints/:id
   */
  getById = async (req, res, next) => {
    try {
      const point = await this.service.getById(req.params.id);
      return ResponseUtil.success(res, point, 'Anchor point retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get locations by virtual asset
   * GET /api/anchorpoints/animal/:animalModelId
   */
  getByVirtualAsset = async (req, res, next) => {
    try {
      const points = await this.service.getByVirtualAsset(req.params.animalModelId);
      return ResponseUtil.success(res, points, 'Locations retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create anchor point
   * POST /api/anchorpoints
   */
  create = async (req, res, next) => {
    try {
      const changedBy = req.user?.id || SYSTEM_USER;
      const point = await this.service.create(req.body, changedBy);
      return ResponseUtil.created(res, point, 'Anchor point created');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update anchor point
   * PUT /api/anchorpoints/:id
   */
  update = async (req, res, next) => {
    try {
      const changedBy = req.user?.id || SYSTEM_USER;
      const point = await this.service.update(req.params.id, req.body, changedBy);
      return ResponseUtil.success(res, point, 'Anchor point updated');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete anchor point
   * DELETE /api/anchorpoints/:id
   */
  delete = async (req, res, next) => {
    try {
      const changedBy = req.user?.id || SYSTEM_USER;
      await this.service.delete(req.params.id, changedBy);
      return ResponseUtil.success(res, null, 'Anchor point deleted');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get clusters — locations grouped by virtual asset
   * GET /api/anchorpoints/clusters
   */
  getClusters = async (req, res, next) => {
    try {
      const clusters = await this.service.getClusters();
      return ResponseUtil.success(res, clusters, 'Clusters retrieved');
    } catch (error) {
      next(error);
    }
  };
}

module.exports = AnchorPointController;
