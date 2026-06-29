const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../errors');
const env = require('../../config/env');

/**
 * JWT utility for token management with refresh token support
 */
class JwtUtil {
  constructor() {
    this.secret = env.jwtSecret;
    this.refreshSecret = env.jwtRefreshSecret || this.secret;
    this.expiresIn = env.jwtExpiresIn;
    this.refreshExpiresIn = env.jwtRefreshExpiresIn || '7d';

    if (!this.secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
  }

  /**
   * Generate a JWT access token
   * @param {object} payload - Data to encode in the token
   * @param {object} options - Optional JWT options
   * @returns {string} JWT token
   */
  sign(payload, options = {}) {
    return jwt.sign(payload, this.secret, {
      expiresIn: options.expiresIn || this.expiresIn,
      ...options,
    });
  }

  /**
   * Generate a JWT refresh token
   * @param {object} payload - Data to encode in the token (minimal data)
   * @returns {string} JWT refresh token
   */
  signRefreshToken(payload) {
    // Only include essential data in refresh token
    const minimalPayload = {
      id: payload.id,
      email: payload.email,
      type: 'refresh',
    };
    return jwt.sign(minimalPayload, this.refreshSecret, {
      expiresIn: this.refreshExpiresIn,
    });
  }

  /**
   * Generate both access and refresh tokens
   * @param {object} payload - User data to encode
   * @returns {{ accessToken: string, refreshToken: string, expiresIn: string }}
   */
  generateTokenPair(payload) {
    return {
      accessToken: this.sign(payload),
      refreshToken: this.signRefreshToken(payload),
      expiresIn: this.expiresIn,
      refreshExpiresIn: this.refreshExpiresIn,
    };
  }

  /**
   * Generate a signed email verification token
   * @param {object} payload
   * @param {string} expiresIn
   * @returns {string}
   */
  signEmailVerificationToken(payload, expiresIn = '24h') {
    return jwt.sign(
      {
        id: payload.id,
        email: payload.email,
        type: 'email_verification',
      },
      this.secret,
      { expiresIn },
    );
  }

  /**
   * Verify and decode a JWT access token
   * @param {string} token - JWT token to verify
   * @returns {object} Decoded token payload
   * @throws {UnauthorizedError} If token is invalid
   */
  verify(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  /**
   * Verify and decode a JWT refresh token
   * @param {string} token - Refresh token to verify
   * @returns {object} Decoded token payload
   * @throws {UnauthorizedError} If token is invalid
   */
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.refreshSecret);
      if (decoded.type !== 'refresh') {
        throw new UnauthorizedError('Invalid refresh token');
      }
      return decoded;
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  /**
   * Verify and decode an email verification token
   * @param {string} token
   * @returns {object}
   */
  verifyEmailVerificationToken(token) {
    try {
      const decoded = jwt.verify(token, this.secret);
      if (decoded.type !== 'email_verification') {
        throw new UnauthorizedError('Invalid email verification token');
      }
      return decoded;
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError('Invalid or expired email verification token');
    }
  }

  /**
   * Decode a token without verification (useful for expired tokens)
   * @param {string} token - JWT token to decode
   * @returns {object|null} Decoded payload or null
   */
  decode(token) {
    return jwt.decode(token);
  }
}

module.exports = JwtUtil;
