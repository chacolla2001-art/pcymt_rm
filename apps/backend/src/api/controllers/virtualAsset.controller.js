const { ResponseUtil } = require('../../shared/utils');
const { SYSTEM_USER } = require('../../shared/constants');

/**
 * VirtualAsset Controller - HTTP request handlers
 */
class VirtualAssetController {
  constructor(virtualAssetService, fileUploadService) {
    this.service = virtualAssetService;
    this.uploadService = fileUploadService;
  }

  /**
   * Get all virtual assets
   * GET /api/virtual-assets
   */
  getAll = async (req, res, next) => {
    try {
      const { is_active } = req.query;
      const filters = {};
      if (is_active !== undefined) {
        filters.is_active = is_active === 'true';
      }
      const assets = await this.service.getAll(filters);
      return ResponseUtil.success(res, assets, 'Virtual assets retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get active virtual assets
   * GET /api/virtual-assets/active
   */
  getActive = async (req, res, next) => {
    try {
      const assets = await this.service.getActive();
      return ResponseUtil.success(res, assets, 'Active virtual assets retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get virtual asset by ID
   * GET /api/virtual-assets/:id
   */
  getById = async (req, res, next) => {
    try {
      const asset = await this.service.getById(req.params.id);
      return ResponseUtil.success(res, asset, 'Virtual asset retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create virtual asset
   * POST /api/virtual-assets
   */
  create = async (req, res, next) => {
    try {
      const changedBy = req.user?.id || SYSTEM_USER;

      // Validate required files exist with proper array check
      if (!req.files?.model_url?.[0] || !req.files?.icon_url?.[0]) {
        return ResponseUtil.error(res, 'model_url and icon_url files are required', 400);
      }

      const data = {
        ...req.body,
        model_url: this.uploadService.getPublicUrl(req.files.model_url[0].filename),
        icon_url: this.uploadService.getPublicUrl(req.files.icon_url[0].filename),
      };

      const asset = await this.service.create(data, changedBy);
      return ResponseUtil.created(res, asset, 'Virtual asset created');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update virtual asset
   * PUT /api/virtual-assets/:id
   */
  update = async (req, res, next) => {
    try {
      const changedBy = req.user?.id || SYSTEM_USER;
      const existingAsset = await this.service.getById(req.params.id);

      const data = {
        ...req.body,
        model_url: existingAsset.model_url,
        icon_url: existingAsset.icon_url,
      };

      if (req.files?.model_url?.[0]) {
        data.model_url = this.uploadService.getPublicUrl(req.files.model_url[0].filename);
      }
      if (req.files?.icon_url?.[0]) {
        data.icon_url = this.uploadService.getPublicUrl(req.files.icon_url[0].filename);
      }

      const asset = await this.service.update(req.params.id, data, changedBy);
      return ResponseUtil.success(res, asset, 'Virtual asset updated');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete virtual asset
   * DELETE /api/virtual-assets/:id
   */
  delete = async (req, res, next) => {
    try {
      const changedBy = req.user?.id || SYSTEM_USER;
      await this.service.delete(req.params.id, changedBy);
      return ResponseUtil.success(res, null, 'Virtual asset deleted');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Soft delete virtual asset
   * PATCH /api/virtual-assets/:id/deactivate
   */
  deactivate = async (req, res, next) => {
    try {
      const changedBy = req.user?.id || SYSTEM_USER;
      const asset = await this.service.softDelete(req.params.id, changedBy);
      return ResponseUtil.success(res, asset, 'Virtual asset deactivated');
    } catch (error) {
      next(error);
    }
  };
}

module.exports = VirtualAssetController;
