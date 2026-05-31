const { ResponseUtil } = require('../../shared/utils');
const { SYSTEM_USER } = require('../../shared/constants');

// Default pagination settings
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * User Controller - HTTP request handlers
 */
class UserController {
  constructor(userService, fileUploadService, authService) {
    this.userService = userService;
    this.uploadService = fileUploadService;
    this.authService = authService;
  }

  /**
   * Get all users with optional pagination and search
   * GET /api/users?page=1&limit=20&search=carlos&is_active=true
   */
  getAll = async (req, res, next) => {
    try {
      const { is_active, search, role } = req.query;
      const page = Math.max(1, parseInt(req.query.page) || DEFAULT_PAGE);
      const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit) || DEFAULT_LIMIT));

      const filters = {};
      if (is_active !== undefined) {
        filters.is_active = is_active === 'true';
      }
      if (search) {
        filters.search = search.trim();
      }
      if (role) {
        filters.role = role.trim();
      }

      const result = await this.userService.getAllPaginated(filters, { page, limit });
      return ResponseUtil.success(res, result, 'Users retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user by ID
   * GET /api/users/:id
   */
  getById = async (req, res, next) => {
    try {
      const user = await this.userService.getById(req.params.id);
      return ResponseUtil.success(res, user, 'User retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create new user
   * POST /api/users/register
   */
  create = async (req, res, next) => {
    try {
      const profilePictureUrl = req.file
        ? this.uploadService.getPublicUrl(req.file.filename)
        : null;

      const userData = {
        ...req.body,
        // Canonical field in DB/API contract
        avatar_url: profilePictureUrl || req.body.avatar_url || req.body.profile_picture_url || null,
      };
      delete userData.profile_picture_url;

      // If this registration request came from the auth router (/api/auth/register)
      // return an auth-style response (tokens + user) so mobile can receive
      // the same payload as a login. We use the plaintext password from the
      // original request body to perform the login immediately after creation.
      const isAuthRegister = (
        (req.baseUrl && req.baseUrl.includes('/auth')) ||
        (req.originalUrl && req.originalUrl.includes('/auth/register'))
      );

      const changedBy = req.user?.id || SYSTEM_USER;
      const user = await this.userService.create(userData, changedBy, {
        sendRegistrationEmail: !isAuthRegister,
      });

      if (isAuthRegister && this.authService) {
        const protocol = req.get('x-forwarded-proto') || req.protocol;
        const verifyBaseUrl = `${protocol}://${req.get('host')}/api/auth/verify-email`;
        const emailService = this.userService.emailService;

        setImmediate(async () => {
          try {
            await this.authService.sendEmailVerification(user, emailService, verifyBaseUrl);
          } catch (error) {
            const logger = require('../../shared/utils/logger.util');
            logger.error('Failed to send email verification after registration', {
              email: user.email,
              error: error.message,
            });
          }
        });

        return ResponseUtil.created(res, {
          requiresEmailVerification: true,
          email: user.email,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        }, 'User created. Please verify your email to continue');
      }

      return ResponseUtil.created(res, user, 'User created successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update user
   * PUT /api/users/:id
   */
  update = async (req, res, next) => {
    try {
      const profilePictureUrl = req.file
        ? this.uploadService.getPublicUrl(req.file.filename)
        : undefined;

      const userData = {
        ...req.body,
        avatar_url: profilePictureUrl || req.body.avatar_url || req.body.profile_picture_url,
      };
      delete userData.profile_picture_url;

      const changedBy = req.user?.id || SYSTEM_USER;
      const user = await this.userService.update(req.params.id, userData, changedBy);

      return ResponseUtil.success(res, user, 'User updated successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete user (soft delete)
   * DELETE /api/users/:id
   */
  delete = async (req, res, next) => {
    try {
      const changedBy = req.user?.id || SYSTEM_USER;
      await this.userService.delete(req.params.id, changedBy);

      return ResponseUtil.success(res, null, 'User deleted successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete the authenticated user's own account
   * DELETE /api/users/me
   */
  deleteOwnAccount = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      await this.userService.deleteOwnAccount(userId, req.body || {});
      return ResponseUtil.success(res, null, 'Account deleted successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Toggle user active status
   * PATCH /api/users/:id/toggle-active
   */
  toggleActive = async (req, res, next) => {
    try {
      const { is_active } = req.body;
      const changedBy = req.user?.id || SYSTEM_USER;

      const user = await this.userService.toggleActive(req.params.id, is_active, changedBy);
      return ResponseUtil.success(res, user, 'User status updated');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Recover password
   * POST /api/users/recover-password
   */
  recoverPassword = async (req, res, next) => {
    try {
      await this.userService.recoverPassword(req.body.email);
      return ResponseUtil.success(res, null, 'Password recovery email sent');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Verify password
   * POST /api/users/verify-password
   */
  verifyPassword = async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const isValid = await this.userService.verifyPassword(email, password);

      if (!isValid) {
        return ResponseUtil.error(res, 'Invalid password', 401);
      }

      return ResponseUtil.success(res, null, 'Password is correct');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Change password
   * POST /api/users/change-password
   */
  changePassword = async (req, res, next) => {
    try {
      const { email, currentPassword, newPassword } = req.body;
      const changedBy = req.user?.id || SYSTEM_USER;

      await this.userService.changePassword(email, currentPassword, newPassword, changedBy);
      return ResponseUtil.success(res, null, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Check if email exists
   * POST /api/users/check-email
   */
  checkEmail = async (req, res, next) => {
    try {
      const exists = await this.userService.emailExists(req.body.email);
      return ResponseUtil.success(res, { exists });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Admin set (reset) password for any user — no current password required
   * PATCH /api/users/:id/set-password
   */
  adminSetPassword = async (req, res, next) => {
    try {
      const { newPassword } = req.body;
      const changedBy = req.user?.id || SYSTEM_USER;

      await this.userService.adminSetPassword(req.params.id, newPassword, changedBy);
      return ResponseUtil.success(res, null, 'Password updated successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update profile picture
   * PATCH /api/users/:id/profile-picture
   */
  updateProfilePicture = async (req, res, next) => {
    try {
      if (!req.file) {
        return ResponseUtil.error(res, 'No image provided', 400);
      }

      const avatarUrl = this.uploadService.getPublicUrl(req.file.filename);
      const changedBy = req.user?.id || SYSTEM_USER;

      await this.userService.update(
        req.params.id,
        { avatar_url: avatarUrl },
        changedBy,
      );

      // Keep legacy response key while exposing canonical field.
      return ResponseUtil.success(
        res,
        { avatar_url: avatarUrl, profile_picture_url: avatarUrl },
        'Profile picture updated',
      );
    } catch (error) {
      next(error);
    }
  };
}

module.exports = UserController;
