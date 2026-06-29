const AppError = require('./AppError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants');

/**
 * Error for validation failures
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = []) {
    super(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    this.details = details;
  }
}

module.exports = ValidationError;
