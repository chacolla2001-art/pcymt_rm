const { HTTP_STATUS, ERROR_CODES } = require('../constants');

/**
 * Response utility for standardized API responses
 * All responses follow the same structure for frontend consistency
 */
class ResponseUtil {
  /**
   * Send a success response
   * @param {object} res - Express response object
   * @param {*} data - Data to send
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code
   */
  static success(res, data = null, message = 'Operation successful', statusCode = HTTP_STATUS.OK) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send a created response
   * @param {object} res - Express response object
   * @param {*} data - Created resource data
   * @param {string} message - Success message
   */
  static created(res, data, message = 'Resource created successfully') {
    return this.success(res, data, message, HTTP_STATUS.CREATED);
  }

  /**
   * Send a no content response
   * @param {object} res - Express response object
   */
  static noContent(res) {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }

  /**
   * Send an error response with structured error code
   * @param {object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Error code for client handling
   * @param {*} errors - Additional error details
   */
  static error(
    res,
    message = 'An error occurred',
    statusCode = HTTP_STATUS.INTERNAL_ERROR,
    code = null,
    errors = null
  ) {
    const response = {
      success: false,
      message,
      code: code || this.getErrorCode(statusCode),
      timestamp: new Date().toISOString(),
    };

    if (errors) {
      response.errors = errors;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Send validation error response
   * @param {object} res - Express response object
   * @param {Array} errors - Validation errors array
   * @param {string} message - Error message
   */
  static validationError(res, errors, message = 'Validation failed') {
    return this.error(res, message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, errors);
  }

  /**
   * Send unauthorized error response
   * @param {object} res - Express response object
   * @param {string} message - Error message
   */
  static unauthorized(res, message = 'Authentication required') {
    return this.error(res, message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
  }

  /**
   * Send forbidden error response
   * @param {object} res - Express response object
   * @param {string} message - Error message
   */
  static forbidden(res, message = 'Access denied') {
    return this.error(res, message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN);
  }

  /**
   * Send not found error response
   * @param {object} res - Express response object
   * @param {string} message - Error message
   */
  static notFound(res, message = 'Resource not found') {
    return this.error(res, message, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }

  /**
   * Send conflict error response
   * @param {object} res - Express response object
   * @param {string} message - Error message
   */
  static conflict(res, message = 'Resource already exists') {
    return this.error(res, message, HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT);
  }

  /**
   * Send rate limited error response
   * @param {object} res - Express response object
   * @param {string} message - Error message
   */
  static rateLimited(res, message = 'Too many requests. Please try again later.') {
    return this.error(res, message, HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_CODES.RATE_LIMITED);
  }

  /**
   * Send a paginated response
   * @param {object} res - Express response object
   * @param {object} paginationData - Pagination information
   */
  static paginated(res, { data, page, limit, total, totalPages }, message = 'Data retrieved successfully') {
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message,
      data,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalItems: total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get error code from HTTP status
   * @private
   */
  static getErrorCode(statusCode) {
    const mapping = {
      [HTTP_STATUS.BAD_REQUEST]: ERROR_CODES.VALIDATION_ERROR,
      [HTTP_STATUS.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
      [HTTP_STATUS.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
      [HTTP_STATUS.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
      [HTTP_STATUS.CONFLICT]: ERROR_CODES.CONFLICT,
      [HTTP_STATUS.TOO_MANY_REQUESTS]: ERROR_CODES.RATE_LIMITED,
    };
    return mapping[statusCode] || ERROR_CODES.INTERNAL_ERROR;
  }
}

module.exports = ResponseUtil;
