const { AppError } = require('../../shared/errors');
const { HTTP_STATUS, ERROR_CODES } = require('../../shared/constants');
const { codeFromStatus, buildErrorPayload } = require('../../shared/utils/errorResponse.util');
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

  logger.logError(err, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id || 'anonymous',
    userAgent: req.get('user-agent'),
    body: process.env.NODE_ENV === 'development' ? req.body : undefined,
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json(
      buildErrorPayload({
        message: err.message,
        code: err.code || codeFromStatus(err.statusCode),
        statusCode: err.statusCode,
        errors: err.details,
      })
    );
  }

  if (err.name === 'SequelizeValidationError' && Array.isArray(err.errors)) {
    const errors = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));

    logger.warn('Validation error', {
      fields: errors.map((e) => e.field).join(', '),
    });

    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      buildErrorPayload({
        message: 'Validation error',
        code: ERROR_CODES.VALIDATION_ERROR,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        errors,
      })
    );
  }

  if (err.name === 'SequelizeUniqueConstraintError' && Array.isArray(err.errors)) {
    const errors = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));

    logger.warn('Unique constraint error', {
      fields: errors.map((e) => e.field).join(', '),
    });

    return res.status(HTTP_STATUS.CONFLICT).json(
      buildErrorPayload({
        message: 'Resource already exists',
        code: ERROR_CODES.CONFLICT,
        statusCode: HTTP_STATUS.CONFLICT,
        errors,
      })
    );
  }

  if (err.name === 'JsonWebTokenError') {
    logger.warn('Invalid JWT token', { error: err.message });
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(
      buildErrorPayload({
        message: 'Invalid token',
        code: ERROR_CODES.TOKEN_INVALID,
        statusCode: HTTP_STATUS.UNAUTHORIZED,
      })
    );
  }

  if (err.name === 'TokenExpiredError') {
    logger.warn('Expired JWT token');
    return res.status(HTTP_STATUS.UNAUTHORIZED).json(
      buildErrorPayload({
        message: 'Token has expired',
        code: ERROR_CODES.TOKEN_EXPIRED,
        statusCode: HTTP_STATUS.UNAUTHORIZED,
      })
    );
  }

  const connectionErrors = [
    'SequelizeConnectionError',
    'SequelizeConnectionAcquireTimeoutError',
    'SequelizeConnectionRefusedError',
    'SequelizeHostNotFoundError',
  ];
  if (connectionErrors.includes(err.name)) {
    return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(
      buildErrorPayload({
        message: 'Database temporarily unavailable',
        code: ERROR_CODES.DATABASE_UNAVAILABLE,
        statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
      })
    );
  }

  if (err.name === 'MulterError') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      buildErrorPayload({
        message: err.message || 'File upload error',
        code: ERROR_CODES.VALIDATION_ERROR,
        statusCode: HTTP_STATUS.BAD_REQUEST,
      })
    );
  }

  const isProduction = process.env.NODE_ENV === 'production';
  return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
    buildErrorPayload({
      message: isProduction ? 'Internal server error' : err.message,
      code: ERROR_CODES.INTERNAL_ERROR,
      statusCode: HTTP_STATUS.INTERNAL_ERROR,
    })
  );
};

module.exports = errorMiddleware;
