const AppError = require('./AppError');
const HTTP_STATUS = require('../constants/httpStatus');

/**
 * Error for resource not found
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, HTTP_STATUS.NOT_FOUND);
    this.resource = resource;
  }
}

module.exports = NotFoundError;
