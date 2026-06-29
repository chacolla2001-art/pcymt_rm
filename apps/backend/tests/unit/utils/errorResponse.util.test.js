const { ERROR_CODES } = require('../../../src/shared/constants');
const { codeFromStatus, buildErrorPayload } = require('../../../src/shared/utils/errorResponse.util');

describe('errorResponse.util', () => {
  it('maps HTTP status to shared error codes', () => {
    expect(codeFromStatus(400)).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(codeFromStatus(408)).toBe(ERROR_CODES.TIMEOUT_ERROR);
    expect(codeFromStatus(429)).toBe(ERROR_CODES.RATE_LIMITED);
    expect(codeFromStatus(503)).toBe(ERROR_CODES.SERVICE_UNAVAILABLE);
    expect(codeFromStatus(999)).toBe(ERROR_CODES.INTERNAL_ERROR);
  });

  it('builds standardized error payloads', () => {
    const payload = buildErrorPayload({
      message: 'Validation error',
      code: ERROR_CODES.VALIDATION_ERROR,
      statusCode: 400,
      errors: [{ field: 'email', message: 'Invalid email' }],
    });

    expect(payload).toMatchObject({
      success: false,
      message: 'Validation error',
      code: ERROR_CODES.VALIDATION_ERROR,
      errors: [{ field: 'email', message: 'Invalid email' }],
    });
    expect(payload.timestamp).toBeTruthy();
  });

  it('derives code from status when omitted', () => {
    const payload = buildErrorPayload({
      message: 'Request timeout',
      statusCode: 408,
    });

    expect(payload.code).toBe(ERROR_CODES.TIMEOUT_ERROR);
  });
});
