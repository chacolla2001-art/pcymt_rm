const createAuthMiddleware = require('./auth.middleware');
const errorMiddleware = require('./error.middleware');
const { validate, validateBody, validateQuery, validateParams } = require('./validate.middleware');
const { authorize, adminOnly, authenticated } = require('./authorize.middleware');
const { apiLimiter, authLimiter, passwordResetLimiter, uploadLimiter, createLimiter } = require('./rateLimiter.middleware');
const { sanitizeInput, preventParameterPollution, securityHeaders, limitPayloadSize } = require('./sanitize.middleware');
const { requestTimeout, shortTimeout, mediumTimeout, longTimeout } = require('./timeout.middleware');

module.exports = {
  // Authentication
  createAuthMiddleware,
  errorMiddleware,

  // Validation
  validate,
  validateBody,
  validateQuery,
  validateParams,

  // Authorization
  authorize,
  adminOnly,
  authenticated,

  // Rate limiting
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  uploadLimiter,
  createLimiter,

  // Sanitization
  sanitizeInput,
  preventParameterPollution,
  securityHeaders,
  limitPayloadSize,

  // Timeout
  requestTimeout,
  shortTimeout,
  mediumTimeout,
  longTimeout,
};
