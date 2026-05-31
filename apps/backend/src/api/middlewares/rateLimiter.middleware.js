const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

/**
 * Rate limiter configuration options
 * @see https://www.npmjs.com/package/express-rate-limit
 */
const DEFAULT_OPTIONS = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  // Use helper to correctly handle IPv6/IPv4 and proxies
  keyGenerator: (req) => ipKeyGenerator(req),
};

/**
 * General API rate limiter
 */
const apiLimiter = rateLimit({
  ...DEFAULT_OPTIONS,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
});

/**
 * Strict rate limiter for authentication endpoints
 */
const authLimiter = rateLimit({
  ...DEFAULT_OPTIONS,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Only 10 attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes',
  },
  skipFailedRequests: false,
});

/**
 * Very strict rate limiter for password reset
 */
const passwordResetLimiter = rateLimit({
  ...DEFAULT_OPTIONS,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 password reset requests per hour
  message: {
    success: false,
    message: 'Too many password reset requests, please try again after 1 hour',
  },
});

/**
 * Rate limiter for file uploads
 */
const uploadLimiter = rateLimit({
  ...DEFAULT_OPTIONS,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: {
    success: false,
    message: 'Upload limit reached, please try again later',
  },
});

/**
 * Create a custom rate limiter
 * @param {object} options - Rate limiter options
 * @returns {Function} Rate limiter middleware
 */
const createLimiter = (options = {}) => {
  return rateLimit({
    ...DEFAULT_OPTIONS,
    ...options,
  });
};

module.exports = {
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  uploadLimiter,
  createLimiter,
};
