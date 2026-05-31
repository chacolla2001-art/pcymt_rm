const { ResponseUtil } = require('../../shared/utils');
const env = require('../../config/env');
const { ValidationError } = require('../../shared/errors');
const { GoogleAuth } = require('google-auth-library');
const path = require('path');
const fs = require('fs');

// ─── ARCore token generation via Service Account ───
const ARCORE_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
let _arcoreAuth = null;

function getArcoreAuth() {
  if (_arcoreAuth) return _arcoreAuth;

  const keyPath = env.arcoreServiceAccountKeyFile
    || path.resolve(__dirname, '..', '..', '..', '..', '..', 'tools', 'cloud-anchor-cli', 'service-account.json');

  if (!fs.existsSync(keyPath)) {
    return null;
  }

  _arcoreAuth = new GoogleAuth({
    keyFile: keyPath,
    scopes: [ARCORE_SCOPE],
  });
  return _arcoreAuth;
}

/**
 * Config Controller - Public and admin configuration endpoints
 * Serves non-sensitive configuration to clients and allows admin updates
 */
class ConfigController {
  /**
   * Get public configuration
   * GET /api/config
   */
  getPublicConfig = async (req, res, next) => {
    try {
      const storagePublicBaseUrl = env.supabaseUrl && env.supabaseStorageBucket
        ? `${env.supabaseUrl}/storage/v1/object/public/${env.supabaseStorageBucket}`
        : null;

      const config = {
        google: {
          webClientId: env.googleClientId || null,
          androidClientId: env.googleAndroidClientId || null,
          mapsApiKey: env.googleMapsApiKey || null,
        },
        arcore: {
          cloudAnchorTtlDays: env.cloudAnchorTtlDays,
        },
        storage: {
          enabled: !!storagePublicBaseUrl,
          publicBaseUrl: storagePublicBaseUrl,
          bucket: env.supabaseStorageBucket || null,
        },
        features: {
          googleAuthEnabled: !!env.googleClientId,
          mapsEnabled: !!env.googleMapsApiKey,
          supabaseStorageEnabled: !!storagePublicBaseUrl,
        },
      };

      return ResponseUtil.success(res, config, 'Configuration retrieved');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update mutable configuration values
   * PUT /api/config
   * Requires authentication (admin only)
   */
  updateConfig = async (req, res, next) => {
    try {
      const { cloudAnchorTtlDays } = req.body;
      const updated = {};

      if (cloudAnchorTtlDays !== undefined) {
        const ttl = parseInt(cloudAnchorTtlDays, 10);
        if (isNaN(ttl) || ttl < 1 || ttl > 365) {
          throw new ValidationError('cloudAnchorTtlDays must be between 1 and 365');
        }
        env.cloudAnchorTtlDays = ttl;
        env.saveRuntimeConfig('cloudAnchorTtlDays', ttl);
        updated.cloudAnchorTtlDays = ttl;
      }

      return ResponseUtil.success(res, updated, 'Configuration updated');
    } catch (error) {
      next(error);
    }
  };

  /**
   * Generate an ARCore API session token for keyless authorization.
   * Required for cloud anchors with TTL > 1 day.
   * POST /api/config/arcore-token
   * Requires authentication
   */
  getArcoreToken = async (req, res, next) => {
    try {
      const auth = getArcoreAuth();
      if (!auth) {
        throw new ValidationError(
          'ARCore service account not configured. Place service-account.json in tools/cloud-anchor-cli/'
        );
      }

      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      const token = tokenResponse?.token || tokenResponse?.res?.data?.access_token;

      if (!token) {
        throw new Error('Failed to obtain ARCore access token');
      }

      return ResponseUtil.success(res, { token }, 'ARCore token generated');
    } catch (error) {
      next(error);
    }
  };
}

module.exports = ConfigController;
