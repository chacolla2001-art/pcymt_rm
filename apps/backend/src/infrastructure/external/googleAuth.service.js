const { OAuth2Client } = require('google-auth-library');
const logger = require('../../shared/utils/logger.util');
const env = require('../../config/env');

/**
 * Google Authentication service
 */
class GoogleAuthService {
  constructor() {
    this.webClientId = env.googleClientId;
    this.androidClientId = env.googleAndroidClientId;
    this.client = null;

    // Build array of valid client IDs (Web + Android)
    this.validClientIds = [this.webClientId, this.androidClientId].filter(Boolean);

    if (this.webClientId) {
      this.client = new OAuth2Client(this.webClientId);
    } else {
      logger.warn('GOOGLE_CLIENT_ID not configured. Google auth will be disabled.');
    }
  }

  /**
   * Check if Google auth is configured
   * @returns {boolean}
   */
  isConfigured() {
    return this.client !== null;
  }

  /**
   * Verify a Google ID token
   * Accepts tokens from both Web and Android clients
   * @param {string} token - Google ID token
   * @returns {object} Decoded token payload
   */
  async verifyToken(token) {
    if (!this.isConfigured()) {
      throw new Error('Google authentication is not configured');
    }

    if (!token) {
      throw new Error('Token is required');
    }

    // Decode token without verification to extract aud/azp for logging
    const tokenParts = token.split('.');
    let tokenPayload = {};
    try {
      tokenPayload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    } catch (e) {
      // Ignore decode errors
    }

    // Security: Only log in debug mode, never expose sensitive IDs in production
    logger.debug('Google Auth token verification attempt', {
      webClientIdConfigured: !!this.webClientId,
      androidClientIdConfigured: !!this.androidClientId,
      validClientIdsCount: this.validClientIds.length,
      tokenAudiencePrefix: tokenPayload?.aud?.substring(0, 20),
    });

    try {
      // Accept tokens where audience matches any of our valid client IDs
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: this.validClientIds,
      });

      const payload = ticket.getPayload();

      logger.info('Google token verified successfully', { email: payload.email });

      return {
        googleId: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified,
        name: payload.name,
        picture: payload.picture,
        givenName: payload.given_name,
        familyName: payload.family_name,
      };
    } catch (error) {
      logger.error('Google token verification failed', { error: error.message });
      throw new Error('Invalid Google token');
    }
  }
}

module.exports = GoogleAuthService;
