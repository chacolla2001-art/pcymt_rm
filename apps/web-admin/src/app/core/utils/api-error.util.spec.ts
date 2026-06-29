import { HttpErrorResponse } from '@angular/common/http';
import {
  codeFromHttpStatus,
  isAuthEndpoint,
  messageForCode,
  resolveApiError,
} from './api-error.util';
import { API_ERROR_CODES } from '../models/api-response.model';

describe('api-error.util', () => {
  it('detects auth endpoints', () => {
    expect(isAuthEndpoint('http://localhost:5000/api/auth/login')).toBeTrue();
    expect(isAuthEndpoint('http://localhost:5000/api/users')).toBeFalse();
  });

  it('maps HTTP status to shared error codes', () => {
    expect(codeFromHttpStatus(408)).toBe(API_ERROR_CODES.TIMEOUT_ERROR);
    expect(codeFromHttpStatus(503)).toBe(API_ERROR_CODES.SERVICE_UNAVAILABLE);
  });

  it('prefers API message over catalog message', () => {
    expect(messageForCode(API_ERROR_CODES.FORBIDDEN, 'Acceso denegado custom')).toBe(
      'Acceso denegado custom'
    );
  });

  it('does not logout on login 401', () => {
    const error = new HttpErrorResponse({
      status: 401,
      url: 'http://localhost:5000/api/auth/login',
      error: { success: false, message: 'Invalid credentials', code: API_ERROR_CODES.UNAUTHORIZED },
    });
    const resolved = resolveApiError(error);
    expect(resolved.shouldLogout).toBeFalse();
    expect(resolved.alertLevel).toBe('none');
    expect(resolved.message).toBe('Invalid credentials');
  });

  it('logs out on expired token for protected routes', () => {
    const error = new HttpErrorResponse({
      status: 401,
      url: 'http://localhost:5000/api/users',
      error: { success: false, message: 'Token has expired', code: API_ERROR_CODES.TOKEN_EXPIRED },
    });
    const resolved = resolveApiError(error);
    expect(resolved.shouldLogout).toBeTrue();
    expect(resolved.code).toBe(API_ERROR_CODES.TOKEN_EXPIRED);
  });

  it('surfaces validation field errors', () => {
    const error = new HttpErrorResponse({
      status: 400,
      url: 'http://localhost:5000/api/users',
      error: {
        success: false,
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation error',
        errors: [{ field: 'email', message: 'Email inválido' }],
      },
    });
    const resolved = resolveApiError(error);
    expect(resolved.message).toBe('Email inválido');
    expect(resolved.alertLevel).toBe('error');
  });

  it('maps network failures', () => {
    const error = new HttpErrorResponse({ status: 0, url: 'http://localhost:5000/api/ping' });
    const resolved = resolveApiError(error);
    expect(resolved.code).toBe(API_ERROR_CODES.NETWORK_ERROR);
    expect(resolved.alertLevel).toBe('error');
  });
});
