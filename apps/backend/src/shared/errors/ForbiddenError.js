const AppError = require('./AppError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants');

/**
 * Error for forbidden access
 */
class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN);
  }
}

module.exports = ForbiddenError;
