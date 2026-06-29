const AppError = require('./AppError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants');

/**
 * Error for resource not found
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    this.resource = resource;
  }
}

module.exports = NotFoundError;
