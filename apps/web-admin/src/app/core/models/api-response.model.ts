/**
 * Modelos de respuesta API estandarizados
 * Sincronizados con el backend para mantener consistencia
 */

/** Códigos de error del backend */
export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
} as const;

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];

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

/** Mensajes de error amigables por código */
export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  [API_ERROR_CODES.VALIDATION_ERROR]: 'Los datos proporcionados no son válidos',
  [API_ERROR_CODES.NOT_FOUND]: 'El recurso solicitado no fue encontrado',
  [API_ERROR_CODES.UNAUTHORIZED]: 'Credenciales inválidas o sesión expirada',
  [API_ERROR_CODES.FORBIDDEN]: 'No tienes permisos para realizar esta acción',
  [API_ERROR_CODES.CONFLICT]: 'El recurso ya existe o hay un conflicto',
  [API_ERROR_CODES.RATE_LIMITED]: 'Has excedido el límite de solicitudes. Intenta más tarde',
  [API_ERROR_CODES.INTERNAL_ERROR]: 'Error interno del servidor. Intenta más tarde',
  [API_ERROR_CODES.TOKEN_EXPIRED]: 'Tu sesión ha expirado. Inicia sesión nuevamente',
  [API_ERROR_CODES.TOKEN_INVALID]: 'Token de autenticación inválido',
  [API_ERROR_CODES.SESSION_EXPIRED]: 'Tu sesión ha expirado. Inicia sesión nuevamente',
  [API_ERROR_CODES.NETWORK_ERROR]: 'Error de conexión. Verifica tu conexión a internet',
  [API_ERROR_CODES.TIMEOUT_ERROR]: 'La solicitud tardó demasiado. Intenta nuevamente',
};
