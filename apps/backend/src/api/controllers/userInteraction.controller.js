const { ResponseUtil } = require('../../shared/utils');
const { SYSTEM_USER } = require('../../shared/constants');

/**
 * UserInteraction Controller - HTTP request handlers
 */
class UserInteractionController {
  constructor(userInteractionService) {
    this.service = userInteractionService;
  }

  /**
   * Get all interactions
   * GET /api/userinteractions
   */
  getAll = async (req, res, next) => {
    try {
      const interactions = await this.service.getAll();
      return ResponseUtil.success(res, interactions, 'Interactions retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get interaction by ID
   * GET /api/userinteractions/:id
   */
  getById = async (req, res, next) => {
    try {
      const interaction = await this.service.getById(req.params.id);
      return ResponseUtil.success(res, interaction, 'Interaction retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get interactions by user
   * GET /api/userinteractions/user/:userId
   */
  getByUser = async (req, res, next) => {
    try {
      const interactions = await this.service.getByUser(req.params.userId);
      return ResponseUtil.success(res, interactions, 'User interactions retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get interactions by virtual asset with time series
   * GET /api/userinteractions/by-virtual-asset/:assetId
   * Query params: range (day|month|year), type (optional interaction type filter)
   */
  getByVirtualAsset = async (req, res, next) => {
    try {
      const { assetId } = req.params;
      const { range, type, offset } = req.query;
      const data = await this.service.getByVirtualAssetTimeSeries(assetId, range, type, offset);
      return ResponseUtil.success(res, data, 'Virtual asset interactions retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Reset game for a user: delete all their interactions
   * DELETE /api/user-interactions/user/:userId/reset
   */
  resetGame = async (req, res, next) => {
    try {
      const { userId } = req.params;
      // Only allow a user to reset their own game, or an admin to reset any
      const requesterId = req.user?.id;
      const requesterRole = req.user?.role;
      if (requesterId !== userId && requesterRole !== 'admin') {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      const deleted = await this.service.resetGameForUser(userId);
      return ResponseUtil.success(res, { deleted }, 'Juego reiniciado correctamente');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create interaction
   * POST /api/userinteractions
   */
  create = async (req, res, next) => {
    try {
      const changedBy = req.user?.id || SYSTEM_USER;
      const interaction = await this.service.create(req.body, changedBy);
      return ResponseUtil.created(res, interaction, 'Interaction created');
    } catch (error) {
      next(error);
    }
  };
}

module.exports = UserInteractionController;
