const { ResponseUtil } = require('../../shared/utils');
const { SYSTEM_USER } = require('../../shared/constants');
const { WEB_ALLOWED_ROLES } = require('../../shared/constants/roles');
const { resolveAvatarUrlOrThrow } = require('../../shared/constants/predefinedAvatars');
const {
  assertValidStoredAvatarUrl,
  formatAvatarForResponse,
  mapUserAvatarFields,
} = require('../../shared/utils/avatar.util');
const { ForbiddenError } = require('../../shared/errors');

const isStaffRole = (role) => WEB_ALLOWED_ROLES.includes(role);

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * User Controller - HTTP request handlers
 */
class UserController {
  /**
   * @param {import('../../domain/services/user.service')} userService
   * @param {import('../../domain/services/auth.service')} authService
   * @param {import('../../domain/services/profilePicture.service')} profilePictureService
   */
  constructor(userService, authService, profilePictureService) {
    this.userService = userService;
    this.authService = authService;
    this.profilePictureService = profilePictureService;
  }

  async #applyAvatarChange(userId, newAvatarUrl, changedBy, previousAvatarUrl) {
    const safeUrl = assertValidStoredAvatarUrl(newAvatarUrl);
    const user = await this.userService.update(userId, { avatar_url: safeUrl }, changedBy);

    if (previousAvatarUrl && previousAvatarUrl !== safeUrl) {
      await this.profilePictureService.deleteIfCustom(previousAvatarUrl);
    }

    return user;
  }

  async #cleanupAvatarOnDelete(userId) {
    try {
      const user = await this.userService.getById(userId);
      await this.profilePictureService.deleteIfCustom(user.avatar_url);
    } catch {
      // user may already be soft-deleted; non-fatal
    }
  }

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

  getById = async (req, res, next) => {
    try {
      const targetId = req.params.id;
      const requester = req.user;

      if (requester.id !== targetId && !isStaffRole(requester.role)) {
        throw new ForbiddenError('You can only view your own profile');
      }

      const user = await this.userService.getById(targetId);
      return ResponseUtil.success(res, mapUserAvatarFields(user), 'User retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      let avatarFromBody = null;
      if (req.body.avatar_url || req.body.profile_picture_url) {
        avatarFromBody = assertValidStoredAvatarUrl(
          req.body.avatar_url || req.body.profile_picture_url,
        );
      }

      const userData = {
        ...req.body,
        avatar_url: avatarFromBody || null,
      };
      delete userData.profile_picture_url;

      const isAuthRegister = (
        (req.baseUrl && req.baseUrl.includes('/auth')) ||
        (req.originalUrl && req.originalUrl.includes('/auth/register'))
      );

      const changedBy = req.user?.id || SYSTEM_USER;
      let user = await this.userService.create(userData, changedBy, {
        sendRegistrationEmail: !isAuthRegister,
      });

      if (req.file) {
        const avatarUrl = await this.profilePictureService.uploadForUser(user.id, req.file);
        user = await this.userService.update(user.id, { avatar_url: avatarUrl }, changedBy);
      }

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

      return ResponseUtil.created(res, mapUserAvatarFields(user), 'User created successfully');
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const targetId = req.params.id;
      const requester = req.user;
      const isStaff = isStaffRole(requester.role);

      if (requester.id !== targetId && !isStaff) {
        throw new ForbiddenError('You can only update your own profile');
      }

      const existing = await this.userService.getById(targetId);
      const previousAvatarUrl = existing.avatar_url;

      let profilePictureUrl;
      if (req.file) {
        profilePictureUrl = await this.profilePictureService.uploadForUser(targetId, req.file);
      }

      let userData = {
        ...req.body,
        avatar_url: profilePictureUrl ?? req.body.avatar_url ?? req.body.profile_picture_url,
      };
      delete userData.profile_picture_url;

      if (userData.avatar_url !== undefined) {
        userData.avatar_url = assertValidStoredAvatarUrl(userData.avatar_url);
      }

      if (!isStaff) {
        userData = {
          avatar_url: userData.avatar_url,
        };
      }

      const changedBy = requester?.id || SYSTEM_USER;
      const user = await this.userService.update(targetId, userData, changedBy);

      if (
        profilePictureUrl
        && previousAvatarUrl
        && previousAvatarUrl !== profilePictureUrl
      ) {
        await this.profilePictureService.deleteIfCustom(previousAvatarUrl);
      }

      return ResponseUtil.success(res, mapUserAvatarFields(user), 'User updated successfully');
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      const userId = req.params.id;
      const changedBy = req.user?.id || SYSTEM_USER;

      await this.#cleanupAvatarOnDelete(userId);
      await this.userService.delete(userId, changedBy);

      return ResponseUtil.success(res, null, 'User deleted successfully');
    } catch (error) {
      next(error);
    }
  };

  deleteOwnAccount = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      await this.#cleanupAvatarOnDelete(userId);
      await this.userService.deleteOwnAccount(userId, req.body || {});
      return ResponseUtil.success(res, null, 'Account deleted successfully');
    } catch (error) {
      next(error);
    }
  };

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

  recoverPassword = async (req, res, next) => {
    try {
      await this.userService.recoverPassword(req.body.email);
      return ResponseUtil.success(res, null, 'Password recovery email sent');
    } catch (error) {
      next(error);
    }
  };

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

  checkEmail = async (req, res, next) => {
    try {
      const exists = await this.userService.emailExists(req.body.email);
      return ResponseUtil.success(res, { exists });
    } catch (error) {
      next(error);
    }
  };

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

  updateProfilePicture = async (req, res, next) => {
    try {
      const userId = req.params.id;
      const requester = req.user;

      if (requester.id !== userId && !isStaffRole(requester.role)) {
        throw new ForbiddenError('You can only update your own profile picture');
      }

      if (!req.file) {
        return ResponseUtil.error(res, 'No image provided', 400);
      }

      const existing = await this.userService.getById(userId);
      const previousAvatarUrl = existing.avatar_url;
      const avatarUrl = await this.profilePictureService.uploadForUser(userId, req.file);
      const changedBy = requester?.id || SYSTEM_USER;

      await this.#applyAvatarChange(userId, avatarUrl, changedBy, previousAvatarUrl);

      const formatted = formatAvatarForResponse(avatarUrl);
      return ResponseUtil.success(
        res,
        { avatar_url: formatted, profile_picture_url: formatted },
        'Profile picture updated',
      );
    } catch (error) {
      next(error);
    }
  };

  setAvatar = async (req, res, next) => {
    try {
      const userId = req.params.id;
      const requester = req.user;

      if (requester.id !== userId && !isStaffRole(requester.role)) {
        throw new ForbiddenError('You can only change your own avatar');
      }

      const avatarUrl = resolveAvatarUrlOrThrow(req.body.avatar_id);
      const changedBy = requester?.id || SYSTEM_USER;
      const existing = await this.userService.getById(userId);

      const user = await this.#applyAvatarChange(
        userId,
        avatarUrl,
        changedBy,
        existing.avatar_url,
      );

      const formatted = formatAvatarForResponse(user.avatar_url);
      return ResponseUtil.success(
        res,
        { avatar_url: formatted, profile_picture_url: formatted },
        'Avatar updated',
      );
    } catch (error) {
      next(error);
    }
  };
}

module.exports = UserController;
