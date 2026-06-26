import { HttpErrorResponse } from '@angular/common/http';
import errorDefinitions from '@pcymt/error-codes';
import {
  API_ERROR_CODES,
  ApiErrorCode,
  ApiErrorResponse,
  ERROR_MESSAGES,
  ValidationErrorDetail,
} from '../models/api-response.model';

export type ApiErrorAlertLevel = 'none' | 'warning' | 'error';

export interface ResolvedApiError {
  code: ApiErrorCode;
  message: string;
  status: number;
  errors?: ValidationErrorDetail[];
  shouldLogout: boolean;
  alertLevel: ApiErrorAlertLevel;
}

const AUTH_PATH_SEGMENTS = [
  '/auth/login',
  '/auth/register',
  '/auth/google',
  '/auth/forgot-password',
  '/auth/refresh',
];

const HTTP_STATUS_TO_CODE = errorDefinitions.httpStatusToCode as Record<string, ApiErrorCode>;

/** Auth endpoints where 401 is expected (wrong password), not session expiry. */
export function isAuthEndpoint(url: string): boolean {
  try {
    const pathname = new URL(url, 'http://localhost').pathname;
    return AUTH_PATH_SEGMENTS.some((segment) => pathname.includes(segment));
  } catch {
    return AUTH_PATH_SEGMENTS.some((segment) => url.includes(segment));
  }
}

export function codeFromHttpStatus(status: number): ApiErrorCode {
  return HTTP_STATUS_TO_CODE[String(status)] ?? API_ERROR_CODES.INTERNAL_ERROR;
}

export function messageForCode(code: ApiErrorCode, apiMessage?: string): string {
  if (apiMessage?.trim()) {
    return apiMessage;
  }
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES[API_ERROR_CODES.INTERNAL_ERROR];
}

export function firstValidationMessage(errors?: ValidationErrorDetail[]): string | undefined {
  return errors?.find((e) => e.message?.trim())?.message;
}

export function resolveApiError(error: HttpErrorResponse, requestUrl?: string): ResolvedApiError {
  const url = requestUrl ?? error.url ?? '';
  const body = parseErrorBody(error);
  const status = error.status;

  const code = resolveErrorCode(status, body);
  const fieldMessage = firstValidationMessage(body?.errors);
  const message = fieldMessage || messageForCode(code, body?.message);

  const authRequest = isAuthEndpoint(url);
  const shouldLogout = status === 401 && !authRequest;

  return {
    code,
    message,
    status,
    errors: body?.errors,
    shouldLogout,
    alertLevel: alertLevelFor(status, code, authRequest),
  };
}

function parseErrorBody(error: HttpErrorResponse): ApiErrorResponse | null {
  if (!error.error || typeof error.error !== 'object') {
    return null;
  }
  return error.error as ApiErrorResponse;
}

function resolveErrorCode(status: number, body: ApiErrorResponse | null): ApiErrorCode {
  if (status === 0) {
    return API_ERROR_CODES.NETWORK_ERROR;
  }
  if (body?.code && body.code in ERROR_MESSAGES) {
    return body.code;
  }
  return codeFromHttpStatus(status);
}

function alertLevelFor(status: number, code: ApiErrorCode, authRequest: boolean): ApiErrorAlertLevel {
  if (status === 0) {
    return 'error';
  }
  if (status === 401 && authRequest) {
    return 'none';
  }
  if (status === 401) {
    return 'none';
  }
  if (status === 404) {
    return 'none';
  }
  if (status === 429 || code === API_ERROR_CODES.RATE_LIMITED) {
    return 'warning';
  }
  if (status >= 500 || code === API_ERROR_CODES.DATABASE_UNAVAILABLE) {
    return 'error';
  }
  if (
    status === 400 ||
    status === 408 ||
    status === 409 ||
    status === 422 ||
    code === API_ERROR_CODES.VALIDATION_ERROR ||
    code === API_ERROR_CODES.CONFLICT ||
    code === API_ERROR_CODES.TIMEOUT_ERROR
  ) {
    return 'error';
  }
  if (status === 403 || code === API_ERROR_CODES.FORBIDDEN) {
    return 'error';
  }
  return 'none';
}
