const { UnauthorizedError, ForbiddenError } = require('../../shared/errors');
const { WEB_ALLOWED_ROLES } = require('../../shared/constants/roles');
const { StringUtil } = require('../../shared/utils');
const logger = require('../../shared/utils/logger.util');
const env = require('../../config/env');

/**
 * Auth Service - Authentication business logic
 */
class AuthService {
  constructor(userRepository, userSessionRepository, encryptionUtil, jwtUtil) {
    this.userRepo = userRepository;
    this.sessionRepo = userSessionRepository;
    this.encryption = encryptionUtil;
    this.jwt = jwtUtil;

    // Admin credentials from environment (secure fallback)
    this.adminEmail = env.adminEmail || null;
    // Only accept hashed password for security
    this.adminPasswordHash = env.adminPasswordHash || null;
  }

  /**
   * Login with email and password
   * @param {object} credentials - { email, password, platform }
   * @returns {Promise<{ token: string, refreshToken: string, user: object }>}
   */
  async login({ email, password, platform = 'web' }) {
    // Handle admin login from environment variables only
    if (await this.#isAdminLogin(email, password)) {
      logger.warn('Admin login via environment credentials', { email, platform });
      const adminUser = this.#createAdminUser();
      const tokens = this.jwt.generateTokenPair(adminUser);
      await this.#createSession(adminUser.id, adminUser.role, platform);
      return { 
        token: tokens.accessToken, 
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: adminUser 
      };
    }

    // Normal user login
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await this.encryption.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.is_active) {
      throw new ForbiddenError('Account is inactive. Please contact administrator.');
    }

    if (!user.google_id && !user.email_verified_at) {
      throw new ForbiddenError('Email not verified. Please verify your email before logging in.');
    }

    if (platform === 'web' && !WEB_ALLOWED_ROLES.includes(user.role)) {
      logger.warn('Web access denied for user role', { email: user.email, role: user.role });
      throw new ForbiddenError('Tu cuenta no tiene acceso al panel web. Usa la aplicación móvil.');
    }

    const userPayload = this.#buildUserPayload(user);
    const tokens = this.jwt.generateTokenPair(userPayload);

    await this.#createSession(user.id, user.role, platform);

    // Return full user data in response (JWT contains minimal payload)
    return { 
      token: tokens.accessToken, 
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: this.buildUserResponse(user) 
    };
  }

  /**
   * Login with Google token
   * @param {string} googleToken
   * @param {object} googleAuthService
   * @param {object} userService
   * @returns {Promise<{ token: string, refreshToken: string, user: object }>}
   */
  async loginWithGoogle(googleToken, googleAuthService, userService) {
    const googleProfile = await googleAuthService.verifyToken(googleToken);
    const { user, action } = await userService.findOrCreateGoogleUser(googleProfile);

    if (!user.is_active) {
      throw new ForbiddenError('Account is inactive');
    }

    const userPayload = this.#buildUserPayload(user);
    const tokens = this.jwt.generateTokenPair(userPayload);

    await this.#createSession(user.id, user.role, 'web');

    if ((action === 'created' || action === 'restored') && userService.emailService?.isConfigured()) {
      setImmediate(async () => {
        try {
          await userService.emailService.sendGoogleAccountCreated(user.email, user.name || 'usuario');
        } catch (error) {
          logger.error('Failed to send Google account creation email', {
            email: user.email,
            error: error.message,
          });
        }
      });
    }

    // Return full user data in response (JWT contains minimal payload)
    return { 
      token: tokens.accessToken, 
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: this.buildUserResponse(user) 
    };
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken
   * @returns {Promise<{ token: string, refreshToken: string, expiresIn: string }>}
   */
  async refreshToken(refreshToken) {
    // Verify the refresh token
    const decoded = this.jwt.verifyRefreshToken(refreshToken);

    // Get fresh user data from database
    const user = await this.userRepo.findByEmail(decoded.email);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.is_active) {
      throw new ForbiddenError('Account is inactive');
    }

    // Generate new token pair
    const userPayload = this.#buildUserPayload(user);
    const tokens = this.jwt.generateTokenPair(userPayload);

    logger.debug('Token refreshed', { userId: user.id, email: user.email });

    return {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: this.buildUserResponse(user),
    };
  }

  /**
   * Request password recovery - generates a new temp password and emails it
   * @param {string} email
   * @param {object} emailService
   * @returns {Promise<void>}
   */
  async forgotPassword(email, emailService) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      // Return silently to avoid user enumeration
      logger.warn('forgotPassword: email not found (silent)', { email });
      return;
    }

    if (!user.is_active) {
      throw new ForbiddenError('Account is inactive. Please contact administrator.');
    }

    // Generate a new temporary password
    const newPassword = StringUtil.generateRandomPassword();
    const hashedPassword = await this.encryption.hash(newPassword);

    // Update password in DB and flag as temporary so mobile forces change
    await user.update({ password_hash: hashedPassword, must_change_password: true, updated_at: new Date() });
    logger.info('forgotPassword: password reset for user', { userId: user.id });

    // Send recovery email
    if (emailService && emailService.isConfigured()) {
      await emailService.sendPasswordRecovery(email, newPassword);
    } else {
      logger.warn('forgotPassword: email service not configured, skipping recovery email');
    }
  }

  async sendEmailVerification(user, emailService, verificationBaseUrl) {
    if (!emailService || !emailService.isConfigured()) {
      logger.warn('sendEmailVerification: email service not configured', { email: user.email });
      return false;
    }

    const token = this.jwt.signEmailVerificationToken({
      id: user.id,
      email: user.email,
    });

    const verificationUrl = `${verificationBaseUrl}?token=${encodeURIComponent(token)}`;
    await emailService.sendEmailVerification(user.email, user.name || 'usuario', verificationUrl);
    return true;
  }

  async verifyEmail(token, userService) {
    const decoded = this.jwt.verifyEmailVerificationToken(token);
    const user = await userService.getByEmailAny(decoded.email);

    if (!user || user.id !== decoded.id) {
      throw new UnauthorizedError('Invalid or expired email verification token');
    }

    await userService.markEmailVerified(user.id);
    return user;
  }

  /**
   * Verify JWT token
   * @param {string} token
   * @returns {object} Decoded user payload
   */
  verifyToken(token) {
    return this.jwt.verify(token);
  }

  /**
   * Logout - end session
   * @param {string} sessionId
   */
  async logout(sessionId) {
    if (sessionId) {
      await this.sessionRepo.endSession(sessionId);
    }
  }

  /**
   * Create a session record
   * @private
   */
  async #createSession(userId, userRole, platform) {
    return this.sessionRepo.create({
      user_id: userId,
      platform,
      logged_in_at: new Date(),
    });
  }

  /**
   * Build user payload for JWT
   * Minimized payload to reduce token size and improve security
   * @private
   */
  #buildUserPayload(user) {
    // Only include essential claims in JWT to reduce token size
    // Full user data should be fetched from API when needed
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
    };
  }

  /**
   * Build full user response (for API response, not JWT)
   * @param {object} user - User model instance
   * @returns {object} Full user data for response
   */
  buildUserResponse(user) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      must_change_password: user.must_change_password ?? false,
      google_id: user.google_id || null,
      created_at: user.created_at,
      updated_at: user.updated_at,
      avatar_url: user.avatar_url || null,
      email_verified_at: user.email_verified_at,
      last_login_at: user.last_login_at,
    };
  }

  /**
   * Check if this is a valid admin login
   * Only works if ADMIN_EMAIL and ADMIN_PASSWORD_HASH are set in environment
   * @private
   */
  async #isAdminLogin(email, password) {
    if (!this.adminEmail || email !== this.adminEmail) {
      return false;
    }

    // Only accept secure hash comparison
    if (this.adminPasswordHash) {
      return this.encryption.compare(password, this.adminPasswordHash);
    }

    return false;
  }

  /**
   * Create admin user object
   * @private
   */
  #createAdminUser() {
    return {
      id: 'admin',
      name: 'Admin',
      email: this.adminEmail || 'admin@system.local',
      role: 'admin',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      avatar_url: null,
    };
  }
}

module.exports = AuthService;
