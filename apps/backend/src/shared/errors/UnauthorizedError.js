const AppError = require('./AppError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants');

/**
 * Error for unauthorized access
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
  }
}

module.exports = UnauthorizedError;
