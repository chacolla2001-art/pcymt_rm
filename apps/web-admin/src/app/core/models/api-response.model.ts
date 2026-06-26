/**
 * Modelos de respuesta API estandarizados
 * Códigos y mensajes sincronizados con shared/constants/api-error-codes.json
 */
import errorDefinitions from '@pcymt/error-codes';

export const API_ERROR_CODES = errorDefinitions.codes as {
  readonly VALIDATION_ERROR: 'VALIDATION_ERROR';
  readonly NOT_FOUND: 'NOT_FOUND';
  readonly UNAUTHORIZED: 'UNAUTHORIZED';
  readonly FORBIDDEN: 'FORBIDDEN';
  readonly CONFLICT: 'CONFLICT';
  readonly RATE_LIMITED: 'RATE_LIMITED';
  readonly INTERNAL_ERROR: 'INTERNAL_ERROR';
  readonly TOKEN_EXPIRED: 'TOKEN_EXPIRED';
  readonly TOKEN_INVALID: 'TOKEN_INVALID';
  readonly SESSION_EXPIRED: 'SESSION_EXPIRED';
  readonly DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE';
  readonly SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE';
  readonly TIMEOUT_ERROR: 'TIMEOUT_ERROR';
  readonly NETWORK_ERROR: 'NETWORK_ERROR';
};

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/** Detalle de error de validación */
export interface ValidationErrorDetail {
  field: string;
  message: string;
}

/** Respuesta base de la API */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ValidationErrorDetail[];
  code?: ApiErrorCode;
  timestamp?: string;
}

/** Respuesta de éxito tipada */
export interface ApiSuccessResponse<T> extends ApiResponse<T> {
  success: true;
  data: T;
}

/** Respuesta de error tipada */
export interface ApiErrorResponse extends ApiResponse<null> {
  success: false;
  code: ApiErrorCode;
  errors?: ValidationErrorDetail[];
}

/** Información de paginación */
export interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Respuesta paginada */
export interface ApiPaginatedResponse<T> extends ApiSuccessResponse<T[]> {
  pagination: PaginationInfo;
}

/** Datos de autenticación */
export interface AuthData {
  token: string;
  refreshToken?: string;
  expiresIn?: string;
  user: UserData;
}

/** Respuesta de refresh token */
export interface RefreshTokenResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    refreshToken: string;
    expiresIn: string;
    user: UserData;
  };
  code?: ApiErrorCode;
}

/** Datos de usuario en respuesta de auth */
export interface UserData {
  id: string | number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  avatar_url?: string;
  email_verified_at?: string;
  last_login_at?: string;
  created_at?: string;
  updated_at?: string;
}

/** Respuesta de login - puede ser éxito o error */
export interface LoginResponse {
  success: boolean;
  message: string;
  data?: AuthData;
  code?: ApiErrorCode;
  timestamp?: string;
}

/** Respuesta de logout */
export interface LogoutResponse {
  success: boolean;
  message: string;
  data?: null;
  code?: ApiErrorCode;
}

/** Respuesta de usuario actual */
export interface CurrentUserResponse {
  success: boolean;
  message: string;
  data?: UserData;
  code?: ApiErrorCode;
}

/** Type guard para verificar respuesta exitosa */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true && response.data !== undefined;
}

/** Type guard para verificar respuesta de error */
export function isErrorResponse(response: ApiResponse<unknown>): response is ApiErrorResponse {
  return response.success === false;
}

/** Mensajes de error amigables por código (español, fuente compartida) */
export const ERROR_MESSAGES: Record<ApiErrorCode, string> =
  errorDefinitions.messagesEs as Record<ApiErrorCode, string>;
