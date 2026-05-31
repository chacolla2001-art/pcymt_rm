const { AppError } = require('../../shared/errors');
const { HTTP_STATUS, ERROR_CODES } = require('../../shared/constants');
const logger = require('../../shared/utils/logger.util');

/**
 * Global error handler middleware
 * Returns standardized error responses with error codes for frontend handling
 */
const errorMiddleware = (err, req, res, _next) => {
  if (res.headersSent) {
    logger.warn('Error received after headers were already sent', {
      path: req.path,
      method: req.method,
      error: err.message,
    });
    return;
  }

  // Log error with full context
  logger.logError(err, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id || 'anonymous',
    userAgent: req.get('user-agent'),
    body: process.env.NODE_ENV === 'development' ? req.body : undefined,
  });

  // Handle known operational errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: getErrorCodeFromStatus(err.statusCode),
      timestamp: new Date().toISOString(),
      ...(err.details && { errors: err.details }),
    });
  }

  // Handle Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));
    
    logger.warn('Validation error', {
      fields: errors.map(e => e.field).join(', '),
    });
    
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Validation error',
      code: ERROR_CODES.VALIDATION_ERROR,
      errors,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle Sequelize unique constraint errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    const errors = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));
    
    logger.warn('Unique constraint error', {
      fields: errors.map(e => e.field).join(', '),
    });
    
    return res.status(HTTP_STATUS.CONFLICT).json({
      success: false,
      message: 'Resource already exists',
      code: ERROR_CODES.CONFLICT,
      errors,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    logger.warn('Invalid JWT token', { error: err.message });
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Invalid token',
      code: 'TOKEN_INVALID',
      timestamp: new Date().toISOString(),
    });
  }

  if (err.name === 'TokenExpiredError') {
    logger.warn('Expired JWT token');
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Token has expired',
      code: 'TOKEN_EXPIRED',
      timestamp: new Date().toISOString(),
    });
  }

  // Handle unknown errors
  const isProduction = process.env.NODE_ENV === 'production';
  return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
    success: false,
    message: isProduction ? 'Internal server error' : err.message,
    code: ERROR_CODES.INTERNAL_ERROR,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Map HTTP status code to error code
 */
function getErrorCodeFromStatus(statusCode) {
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

module.exports = errorMiddleware;
