const AppError = require('./AppError');
const HTTP_STATUS = require('../constants/httpStatus');

/**
 * Error for unauthorized access
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, HTTP_STATUS.UNAUTHORIZED);
  }
}

module.exports = UnauthorizedError;
