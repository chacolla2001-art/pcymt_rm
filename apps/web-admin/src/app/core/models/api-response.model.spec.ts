import {
  API_ERROR_CODES,
  ERROR_MESSAGES,
  isSuccessResponse,
  isErrorResponse,
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiErrorCode,
} from './api-response.model';

describe('ApiResponseModel', () => {

  describe('API_ERROR_CODES', () => {
    it('should define all expected error codes', () => {
      expect(API_ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(API_ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND');
      expect(API_ERROR_CODES.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(API_ERROR_CODES.FORBIDDEN).toBe('FORBIDDEN');
      expect(API_ERROR_CODES.CONFLICT).toBe('CONFLICT');
      expect(API_ERROR_CODES.RATE_LIMITED).toBe('RATE_LIMITED');
      expect(API_ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(API_ERROR_CODES.TOKEN_EXPIRED).toBe('TOKEN_EXPIRED');
      expect(API_ERROR_CODES.TOKEN_INVALID).toBe('TOKEN_INVALID');
      expect(API_ERROR_CODES.SESSION_EXPIRED).toBe('SESSION_EXPIRED');
      expect(API_ERROR_CODES.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(API_ERROR_CODES.TIMEOUT_ERROR).toBe('TIMEOUT_ERROR');
    });

    it('should have 12 error codes', () => {
      expect(Object.keys(API_ERROR_CODES).length).toBe(12);
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('should have a message for every error code', () => {
      const codes = Object.values(API_ERROR_CODES);
      codes.forEach(code => {
        expect(ERROR_MESSAGES[code]).toBeTruthy(`Missing message for code: ${code}`);
        expect(typeof ERROR_MESSAGES[code]).toBe('string');
      });
    });

    it('should return Spanish error messages', () => {
      expect(ERROR_MESSAGES[API_ERROR_CODES.NETWORK_ERROR]).toContain('conexión');
      expect(ERROR_MESSAGES[API_ERROR_CODES.UNAUTHORIZED]).toContain('sesión');
      expect(ERROR_MESSAGES[API_ERROR_CODES.RATE_LIMITED]).toContain('límite');
    });
  });

  describe('isSuccessResponse()', () => {
    it('should return true for a success response with data', () => {
      const response: ApiResponse<string> = { success: true, message: 'OK', data: 'hello' };
      expect(isSuccessResponse(response)).toBeTrue();
    });

    it('should return false for a success response without data', () => {
      const response: ApiResponse<string> = { success: true, message: 'OK' };
      expect(isSuccessResponse(response)).toBeFalse();
    });

    it('should return false for an error response', () => {
      const response: ApiResponse<null> = { success: false, message: 'Error' };
      expect(isSuccessResponse(response)).toBeFalse();
    });
  });

  describe('isErrorResponse()', () => {
    it('should return true when success is false', () => {
      const response: ApiResponse<null> = { success: false, message: 'Error' };
      expect(isErrorResponse(response)).toBeTrue();
    });

    it('should return false when success is true', () => {
      const response: ApiResponse<string> = { success: true, message: 'OK', data: 'test' };
      expect(isErrorResponse(response)).toBeFalse();
    });
  });
});
