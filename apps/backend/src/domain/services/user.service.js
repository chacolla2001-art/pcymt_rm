const { NotFoundError, UnauthorizedError, ConflictError } = require('../../shared/errors');
const { StringUtil, appCache, cacheKeys } = require('../../shared/utils');
const { SYSTEM_USER } = require('../../shared/constants');
const { Op } = require('sequelize');

// Cache TTL constants (in milliseconds)
const CACHE_TTL = {
  USER: 300000,      // 5 minutes
  USER_LIST: 60000,  // 1 minute (lists change more frequently)
};

/**
 * User Service - Business logic for user operations
 */
class UserService {
  constructor(userRepository, encryptionUtil, emailService, userSessionRepository = null, interactionRepository = null) {
    this.userRepo = userRepository;
    this.encryption = encryptionUtil;
    this.emailService = emailService;
    this.sessionRepo = userSessionRepository;
    this.interactionRepo = interactionRepository;
  }

  /**
   * Get all users (cached)
   * @returns {Promise<Array>}
   */
  async getAll(filters = {}) {
    const cacheKey = Object.keys(filters).length > 0
      ? cacheKeys.users({ all: true, ...filters })
      : cacheKeys.users({ all: true });
    const options = {};
    // Op.is genera WHERE "deleted_at" IS NULL (más fiable que null simple en PostgreSQL)
    options.where = { deleted_at: { [Op.is]: null } };
    if (filters.is_active !== undefined) {
      options.where.is_active = filters.is_active;
    }
    if (filters.role) {
      options.where.role = filters.role;
    }
    return appCache.getOrSet(
      cacheKey,
      () => this.userRepo.findAll(options),
      CACHE_TTL.USER_LIST,
    );
  }

  /**
   * Get all users with pagination and optional search (not cached — paginated results vary too much)
   * @param {object} filters - { is_active, search, role }
   * @param {object} pagination - { page, limit }
   * @returns {Promise<{ rows: User[], total: number, page: number, pages: number, limit: number }>}
   */
  async getAllPaginated(filters = {}, pagination = {}) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const where = {
      // Op.is genera WHERE "deleted_at" IS NULL (más fiable que null simple en PostgreSQL)
      deleted_at: { [Op.is]: null },
    };
    if (filters.is_active !== undefined) {
      where.is_active = filters.is_active;
    }
    if (filters.role) {
      where.role = filters.role;
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      where[Op.or] = [
        { name: { [Op.iLike]: term } },
        { email: { [Op.iLike]: term } },
      ];
    }

    const { rows, count } = await this.userRepo.findAndCountAll(
      { limit, offset },
      { where, order: [['updated_at', 'DESC']] },
    );

    return {
      rows,
      total: count,
      page,
      pages: Math.ceil(count / limit),
      limit,
    };
  }

  /**
   * Get user by ID (cached)
   * @param {string} id
   * @returns {Promise<object>}
   * @throws {NotFoundError}
   */
  async getById(id) {
    const user = await appCache.getOrSet(
      cacheKeys.user(id),
      () => this.userRepo.findById(id),
      CACHE_TTL.USER,
    );

    if (!user) {
      throw new NotFoundError('User');
    }
    return user;
  }

  /**
   * Get user by email (cached)
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async getByEmail(email) {
    return appCache.getOrSet(
      cacheKeys.userByEmail(email),
      () => this.userRepo.findByEmail(email),
      CACHE_TTL.USER,
    );
  }

  async getByEmailAny(email) {
    return this.userRepo.findByEmailAny(email?.toLowerCase().trim());
  }

  /**
   * Invalidate user cache
   * @private
   */
  #invalidateUserCache(userId, email = null) {
    appCache.delete(cacheKeys.user(userId));
    if (email) {
      appCache.delete(cacheKeys.userByEmail(email));
    }
    appCache.deletePattern('users:*');
  }

  /**
   * Create a new user
   * @param {object} userData
   * @param {string} changedBy
   * @returns {Promise<object>}
   */
  async create(userData, changedBy = SYSTEM_USER, options = {}) {
    const { sendRegistrationEmail = true } = options;
    const normalizedEmail = userData.email?.toLowerCase().trim();
    if (normalizedEmail) {
      userData.email = normalizedEmail;
    }

    const existingByEmail = await this.userRepo.findByEmailAny(userData.email);
    if (existingByEmail) {
      if (!existingByEmail.deleted_at) {
        throw new ConflictError('This email is already registered. Please log in or recover your password.');
      }

      if (existingByEmail.role !== 'user') {
        throw new ConflictError('This email belongs to a protected account and cannot be re-registered.');
      }
    }

    // Legacy compatibility: accept user_id input but store canonical id.
    if (!userData.id && userData.user_id) {
      userData.id = userData.user_id;
    }
    delete userData.user_id;

    // Normalize empty google_id / avatar_url to undefined so DB treats them as NULL
    if (userData.google_id === '') {
      delete userData.google_id;
    }
    if (userData.avatar_url === '') {
      delete userData.avatar_url;
    }

    // Track whether password came from request (self-registration) or was generated
    const userProvidedPassword = Boolean(userData.password_hash);

    // Generate password if not provided (admin-created user)
    let plainPassword = userData.password_hash;
    if (!plainPassword) {
      plainPassword = StringUtil.generateRandomPassword();
    }

    // Hash the password
    const hashedPassword = await this.encryption.hash(plainPassword);
    const now = new Date();

    let user;
    if (existingByEmail?.deleted_at && existingByEmail.role === 'user') {
      user = await existingByEmail.update({
        name: userData.name ?? existingByEmail.name,
        password_hash: hashedPassword,
        avatar_url: userData.avatar_url ?? existingByEmail.avatar_url,
        is_active: true,
        must_change_password: false,
        deleted_at: null,
        updated_at: now,
      });
    } else {
      // Generate UUID if not provided
      if (!userData.id) {
        userData.id = StringUtil.generateUUID();
      }

      user = await this.userRepo.create(
        {
          ...userData,
          password_hash: hashedPassword,
          created_at: now,
          updated_at: now,
        },
      );
    }

    // Invalidate cache after creation
    this.#invalidateUserCache(user.id, userData.email);

    // Sending email must not block registration or login. Dispatch it asynchronously.
    if (sendRegistrationEmail && this.emailService && userData.email) {
      const logger = require('../../shared/utils/logger.util');
      const email = userData.email;
      const username = userData.name || 'usuario';

      setImmediate(async () => {
        if (!this.emailService.isConfigured()) {
          logger.warn('Registration email skipped: email service is not configured', { email });
          return;
        }

        try {
          if (userProvidedPassword) {
            await this.emailService.sendAccountCreated(email, username);
            logger.info('Registration confirmation email sent', { email });
          } else {
            await this.emailService.sendWelcome(email, plainPassword);
            logger.info('Welcome email with generated password sent', { email });
          }
        } catch (error) {
          logger.error('Failed to send registration email', { email, error: error.message });
        }
      });
    }

    return user;
  }

  /**
   * Update a user
   * @param {string} id
   * @param {object} userData
   * @param {string} changedBy
   * @returns {Promise<object>}
   */
  async update(id, userData, changedBy = SYSTEM_USER) {
    const user = await this.getById(id);

    // Remove fields that shouldn't be updated directly
    delete userData.email;

    // Hash password if provided and clear temporary password flag
    if (userData.password_hash) {
      userData.password_hash = await this.encryption.hash(userData.password_hash);
      userData.must_change_password = false;
    }

    // Clean undefined values
    const cleanData = Object.fromEntries(
      Object.entries(userData).filter(([_, v]) => v !== undefined),
    );

    cleanData.updated_at = new Date();

    const updated = await user.update(cleanData);

    // Invalidate cache after update
    this.#invalidateUserCache(id, user.email);

    return updated;
  }

  /**
   * Soft-delete a user (baja lógica)
   * Sets is_active = false and deleted_at = NOW() via explicit update.
   * Using update() directly avoids issues with Sequelize paranoid + timestamps:false.
   * @param {string} id
   * @param {string} changedBy
   * @returns {Promise<boolean>}
   */
  async delete(id, changedBy = SYSTEM_USER) {
    const user = await this.userRepo.findById(id);
    if (!user) {
      return false;
    }

    if (this.interactionRepo) {
      await this.interactionRepo.deleteByUser(id);
    }

    // Explicitly set both fields so the soft-delete is reliable regardless of
    // Sequelize's paranoid + timestamps:false interaction.
    await user.update({
      is_active: false,
      deleted_at: new Date(),
    });

    if (this.sessionRepo) {
      await this.sessionRepo.endAllUserSessions(id);
    }

    // Invalidate cache after soft-delete
    this.#invalidateUserCache(id, user.email);

    return true;
  }

  /**
   * Allow an authenticated user to delete their own account.
   * Email/password accounts must confirm with their current password.
   * Google-authenticated accounts can delete with the active session only.
   * @param {string} userId
   * @param {{ currentPassword?: string }} input
   * @returns {Promise<boolean>}
   */
  async deleteOwnAccount(userId, input = {}) {
    const user = await this.getById(userId);
    const currentPassword = input.currentPassword?.trim();
    const isGoogleAccount = Boolean(user.google_id);

    if (!isGoogleAccount) {
      if (!currentPassword) {
        throw new UnauthorizedError('Current password is required to delete this account');
      }

      const isValid = await this.encryption.compare(currentPassword, user.password_hash);
      if (!isValid) {
        throw new UnauthorizedError('Current password is incorrect');
      }
    }

    const deleted = await this.delete(userId, userId);

    if (deleted && this.emailService?.isConfigured()) {
      const email = user.email;
      const username = user.name || 'usuario';

      setImmediate(async () => {
        try {
          await this.emailService.sendAccountDeleted(email, username);
        } catch (error) {
          const logger = require('../../shared/utils/logger.util');
          logger.error('Failed to send account deletion email', { email, error: error.message });
        }
      });
    }

    return deleted;
  }

  /**
   * Restore a previously soft-deleted user
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async restore(id) {
    const user = await this.userRepo.findDeleted(id);
    if (!user) {
      return false;
    }

    // Some deployments may not enable Sequelize `paranoid` on the model,
    // so `restore()` may not exist. Fall back to clearing `deleted_at`.
    if (typeof user.restore === 'function') {
      await user.restore();
    } else {
      await user.update({ deleted_at: null });
    }

    await user.update({ is_active: true });

    this.#invalidateUserCache(id, user.email);
    return true;
  }

  /**
   * Toggle user active status
   * @param {string} id
   * @param {boolean} isActive
   * @param {string} changedBy
   * @returns {Promise<object>}
   */
  async toggleActive(id, isActive, changedBy = SYSTEM_USER) {
    const user = await this.getById(id);
    const updated = await user.update({ is_active: isActive });

    // Invalidate cache after toggle
    this.#invalidateUserCache(id, user.email);

    return updated;
  }

  /**
   * Verify user password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  async verifyPassword(email, password) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new NotFoundError('User');
    }
    return this.encryption.compare(password, user.password_hash);
  }

  /**
   * Change user password
   * @param {string} email
   * @param {string} currentPassword
   * @param {string} newPassword
   * @param {string} changedBy
   * @returns {Promise<boolean>}
   */
  async changePassword(email, currentPassword, newPassword, changedBy = SYSTEM_USER) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new NotFoundError('User');
    }

    const isValid = await this.encryption.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const hashedPassword = await this.encryption.hash(newPassword);
    await user.update({ password_hash: hashedPassword });

    return true;
  }

  /**
   * Recover password (generate new password and send email)
   * Note: Always returns success to prevent user enumeration attacks
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  async recoverPassword(email) {
    const user = await this.userRepo.findByEmail(email);

    // Always return true to prevent user enumeration
    // If user doesn't exist, we simply don't send the email
    if (!user) {
      // Log for security monitoring but don't reveal to user
      const logger = require('../../shared/utils/logger.util');
      logger.warn('Password recovery attempted for non-existent email', {
        email: email.substring(0, 3) + '***', // Partial email for logging
      });
      return true;
    }

    const newPassword = StringUtil.generateRandomPassword();
    const hashedPassword = await this.encryption.hash(newPassword);

    await user.update(
      { password_hash: hashedPassword },
    );

    // Invalidate user cache after password change
    this.#invalidateUserCache(user.id, email);

    if (this.emailService) {
      await this.emailService.sendPasswordRecovery(email, newPassword);
    }

    return true;
  }

  /**
   * Admin set password for any user (no current password required)
   * @param {string} id - User ID
   * @param {string} newPassword - New plain text password
   * @param {string} changedBy - Admin user ID performing the action
   * @returns {Promise<boolean>}
   */
  async adminSetPassword(id, newPassword, changedBy = SYSTEM_USER) {
    const user = await this.getById(id);

    const hashedPassword = await this.encryption.hash(newPassword);
    await user.update({ password_hash: hashedPassword, updated_at: new Date() });

    // Invalidate user cache
    this.#invalidateUserCache(id, user.email);

    return true;
  }

  /**
   * Check if email exists
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  async emailExists(email) {
    const normalizedEmail = email?.toLowerCase().trim();
    if (!normalizedEmail) {
      return false;
    }

    const existing = await this.userRepo.findByEmailAny(normalizedEmail);
    if (!existing) {
      return false;
    }

    if (existing.deleted_at && existing.role === 'user') {
      return false;
    }

    return true;
  }

  async isEmailVerified(email) {
    const user = await this.getByEmailAny(email);
    return Boolean(user?.email_verified_at);
  }

  async markEmailVerified(userId) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    if (!user.email_verified_at) {
      await user.update({
        email_verified_at: new Date(),
        updated_at: new Date(),
      });
      this.#invalidateUserCache(user.id, user.email);
    }

    return user;
  }

  /**
   * Find or create Google user
   * @param {object} googleProfile
   * @returns {Promise<object>}
   */
  async findOrCreateGoogleUser(googleProfile) {
    const normalizedEmail = googleProfile.email?.toLowerCase().trim();
    if (normalizedEmail) {
      googleProfile.email = normalizedEmail;
    }

    // First try to find active user by Google ID
    let user = await this.userRepo.findByGoogleId(googleProfile.googleId);
    let action = 'existing';

    // No active user found by Google ID — look for soft-deleted or email-registered users
    if (!user) {
      // 1. Check for a soft-deleted record that already had this google_id linked
      const existingByGoogleId = await this.userRepo.findByGoogleIdAny(googleProfile.googleId);
      if (existingByGoogleId && existingByGoogleId.deleted_at) {
        // Restore the soft-deleted account (model uses manual deleted_at, not paranoid)
        await existingByGoogleId.update({
          deleted_at: null,
          is_active: true,
          avatar_url: googleProfile.picture,
          email_verified_at: googleProfile.emailVerified ? new Date() : null,
          updated_at: new Date(),
        });
        return { user: existingByGoogleId, action: 'restored' };
      }

      if (existingByGoogleId) {
        // Active record found by google_id — just return it
        return { user: existingByGoogleId, action: 'existing' };
      }

      // 2. No google_id match → try to find by email (active or soft-deleted)
      //    This handles the case where the user registered by email and now
      //    logs in with Google for the first time (account linking), as well
      //    as soft-deleted users returning via Google.
      const existingByEmail = await this.userRepo.findByEmailAny(googleProfile.email);

      if (existingByEmail) {
        if (existingByEmail.deleted_at) {
          // Restore the soft-deleted account and link the Google ID
          await existingByEmail.update({
            deleted_at: null,
            is_active: true,
            google_id: googleProfile.googleId,
            name: existingByEmail.name || googleProfile.name || null,
            avatar_url: googleProfile.picture,
            email_verified_at: googleProfile.emailVerified ? new Date() : null,
            updated_at: new Date(),
          });
          action = 'restored';
        } else {
          // Active account — link the Google ID (keep existing name)
          await existingByEmail.update({
            google_id: googleProfile.googleId,
            updated_at: new Date(),
          });
          action = 'linked';
        }
        user = existingByEmail;
      }
    }

    // If still no user, create a new one
    if (!user) {
      user = await this.userRepo.create({
        google_id: googleProfile.googleId,
        email: googleProfile.email,
        name: googleProfile.name || null,
        avatar_url: googleProfile.picture,
        email_verified_at: googleProfile.emailVerified ? new Date() : null,
        is_active: true,
        role: 'user',
      });
      action = 'created';
    }

    return { user, action };
  }
}

module.exports = UserService;
