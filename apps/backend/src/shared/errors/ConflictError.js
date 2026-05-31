const AppError = require('./AppError');
const HTTP_STATUS = require('../constants/httpStatus');

/**
 * Error for resource conflicts (duplicate entries, etc.)
 */
class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, HTTP_STATUS.CONFLICT);
  }
}

module.exports = ConflictError;
