const AppError = require('./AppError');
const HTTP_STATUS = require('../constants/httpStatus');

/**
 * Error for forbidden access
 */
class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, HTTP_STATUS.FORBIDDEN);
  }
}

module.exports = ForbiddenError;
