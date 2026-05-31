const AppError = require('./AppError');
const HTTP_STATUS = require('../constants/httpStatus');

/**
 * Error for validation failures
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = []) {
    super(message, HTTP_STATUS.BAD_REQUEST);
    this.details = details;
  }
}

module.exports = ValidationError;
