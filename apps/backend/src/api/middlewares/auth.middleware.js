const { HTTP_STATUS, ERROR_CODES } = require('../../shared/constants');
const logger = require('../../shared/utils/logger.util');

/**
 * Send standardized error response
 */
const sendError = (res, statusCode, message, code) =>
  res.status(statusCode).json({
    success: false,
    message,
    code,
    timestamp: new Date().toISOString(),
  });

// Token extraction using regex (more robust)
const BEARER_REGEX = /^Bearer\s+(.+)$/i;

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null if invalid format
 */
const extractToken = (authHeader) => {
  if (!authHeader) {
    return null;
  }
  const match = authHeader.match(BEARER_REGEX);
  return match ? match[1] : null;
};

/**
 * JWT Authentication middleware factory
 * @param {object} jwtUtil - JWT utility instance
 * @returns {Function} Express middleware
 */
const createAuthMiddleware = (jwtUtil) => {
  // Validate dependency at creation time (fail fast)
  if (!jwtUtil || typeof jwtUtil.verify !== 'function') {
    throw new Error('createAuthMiddleware requires a valid jwtUtil with verify method');
  }

  return (req, res, next) => {
    const token = extractToken(req.headers.authorization);

    if (!token) {
      logger.debug('No token provided', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      return sendError(
        res,
        HTTP_STATUS.UNAUTHORIZED,
        'Authentication required. Use: Bearer <token>',
        ERROR_CODES.UNAUTHORIZED
      );
    }

    try {
      req.user = jwtUtil.verify(token);
      logger.debug('Token verified', {
        userId: req.user.user_id,
        email: req.user.email,
        path: req.path,
      });
      next();
    } catch (error) {
      const isExpired = error.name === 'TokenExpiredError';
      const message = isExpired ? 'Token has expired' : 'Invalid token';
      const code = isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';

      logger.warn(`Authentication failed: ${message}`, {
        error: error.name,
        path: req.path,
        ip: req.ip,
      });

      return sendError(res, HTTP_STATUS.UNAUTHORIZED, message, code);
    }
  };
};

module.exports = createAuthMiddleware;
