const AppError = require('./AppError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants');

/**
 * Error for resource conflicts (duplicate entries, etc.)
 */
class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT);
  }
}

module.exports = ConflictError;
