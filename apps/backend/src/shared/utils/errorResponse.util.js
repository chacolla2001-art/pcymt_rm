const { ERROR_CODES } = require('../constants');
const HTTP_STATUS = require('../constants/httpStatus');

const HTTP_STATUS_TO_CODE = {
  [HTTP_STATUS.BAD_REQUEST]: ERROR_CODES.VALIDATION_ERROR,
  [HTTP_STATUS.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
  [HTTP_STATUS.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
  [HTTP_STATUS.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
  [HTTP_STATUS.CONFLICT]: ERROR_CODES.CONFLICT,
  [HTTP_STATUS.UNPROCESSABLE_ENTITY]: ERROR_CODES.VALIDATION_ERROR,
  [HTTP_STATUS.TOO_MANY_REQUESTS]: ERROR_CODES.RATE_LIMITED,
  [HTTP_STATUS.INTERNAL_ERROR]: ERROR_CODES.INTERNAL_ERROR,
  [HTTP_STATUS.BAD_GATEWAY]: ERROR_CODES.SERVICE_UNAVAILABLE,
  [HTTP_STATUS.SERVICE_UNAVAILABLE]: ERROR_CODES.SERVICE_UNAVAILABLE,
  [HTTP_STATUS.GATEWAY_TIMEOUT]: ERROR_CODES.TIMEOUT_ERROR,
  408: ERROR_CODES.TIMEOUT_ERROR,
};

function codeFromStatus(statusCode) {
  return HTTP_STATUS_TO_CODE[statusCode] || ERROR_CODES.INTERNAL_ERROR;
}

function buildErrorPayload({ message, code, statusCode, errors }) {
  return {
    success: false,
    message,
    code: code || codeFromStatus(statusCode),
    timestamp: new Date().toISOString(),
    ...(errors?.length ? { errors } : {}),
  };
}

module.exports = {
  codeFromStatus,
  buildErrorPayload,
};
