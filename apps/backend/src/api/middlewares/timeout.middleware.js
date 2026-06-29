const { ERROR_CODES } = require('../../shared/constants');
const { buildErrorPayload } = require('../../shared/utils/errorResponse.util');

/**
 * Request timeout middleware
 * Prevents long-running requests from blocking the server
 */

const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Create a timeout middleware
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Function} Express middleware
 */
const requestTimeout = (timeout = DEFAULT_TIMEOUT) => {
  return (req, res, next) => {
    // Set timeout
    req.setTimeout(timeout);
    res.setTimeout(timeout);

    // Create timeout handler
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json(
          buildErrorPayload({
            message: 'Request timeout',
            code: ERROR_CODES.TIMEOUT_ERROR,
            statusCode: 408,
          })
        );
      }
    }, timeout);

    // Clear timeout when response is finished
    res.on('finish', () => {
      clearTimeout(timeoutId);
    });

    res.on('close', () => {
      clearTimeout(timeoutId);
    });

    next();
  };
};

/**
 * Timeout middleware for specific routes
 */
const shortTimeout = requestTimeout(10000); // 10 seconds
const mediumTimeout = requestTimeout(30000); // 30 seconds
const longTimeout = requestTimeout(120000); // 2 minutes (for uploads/heavy processing)

module.exports = {
  requestTimeout,
  shortTimeout,
  mediumTimeout,
  longTimeout,
};
