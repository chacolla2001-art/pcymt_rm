import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { LoggerService } from '../services/logger.service';
import { AlertService } from '../services/alert.service';
import { 
  ApiErrorResponse, 
  API_ERROR_CODES, 
  ERROR_MESSAGES 
} from '../models/api-response.model';

/**
 * Interceptor funcional para manejo centralizado de errores HTTP
 * Compatible con Angular 18 standalone APIs y SSR
 *
 * Maneja:
 * - 401 Unauthorized: Limpia sesión y redirige a login
 * - 403 Forbidden: Muestra mensaje de acceso denegado
 * - 404 Not Found: Log y propagación
 * - 429 Rate Limited: Muestra mensaje de límite excedido
 * - 500+ Server Error: Muestra mensaje de error genérico
 * - 0 Network Error: Muestra mensaje de conexión
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  
  // En SSR, simplemente pasar la solicitud sin interceptar
  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }

  const router = inject(Router);
  const authService = inject(AuthService);
  const logger = inject(LoggerService);
  const alertService = inject(AlertService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Log detallado del error
      logger.logHttpError(error, getContextFromUrl(req.url));

      const errorBody = error.error as ApiErrorResponse | null;
      const errorCode = errorBody?.code || getCodeFromStatus(error.status);

      switch (error.status) {
        case 0:
          // Error de red - sin conexión
          logger.logNetworkError(error);
          alertService.showError(ERROR_MESSAGES[API_ERROR_CODES.NETWORK_ERROR]);
          break;

        case 401:
          // Token expirado o inválido - limpiar sesión
          logger.warn('Sesión inválida, redirigiendo a login', 'ErrorInterceptor', {
            url: req.url,
            code: errorCode,
          });
          authService.logout();
          router.navigate(['/login']);
          break;

        case 403:
          // Acceso denegado
          alertService.showError(
            errorBody?.message || ERROR_MESSAGES[API_ERROR_CODES.FORBIDDEN]
          );
          break;

        case 404:
          // Recurso no encontrado - solo log, sin alerta
          logger.warn('Recurso no encontrado', 'ErrorInterceptor', {
            url: req.url,
          });
          break;

        case 422:
          // Error de validación
          if (errorBody?.errors) {
            logger.logValidationError(errorBody.errors, getContextFromUrl(req.url));
          }
          break;

        case 429:
          // Rate limit
          alertService.showWarning(ERROR_MESSAGES[API_ERROR_CODES.RATE_LIMITED]);
          break;

        case 500:
        case 502:
        case 503:
        case 504:
          // Errores del servidor
          logger.error('Error del servidor', 'ErrorInterceptor', {
            status: error.status,
            url: req.url,
            message: errorBody?.message,
          });
          alertService.showError(
            errorBody?.message || ERROR_MESSAGES[API_ERROR_CODES.INTERNAL_ERROR]
          );
          break;
      }

      // Propagar el error para que los componentes puedan manejarlo si es necesario
      return throwError(() => error);
    })
  );
};

/**
 * Extrae contexto del URL para logs más descriptivos
 */
function getContextFromUrl(url: string): string {
  try {
    const urlObj = new URL(url, 'http://localhost');
    const parts = urlObj.pathname.split('/').filter(Boolean);
    
    if (parts.includes('api')) {
      const apiIndex = parts.indexOf('api');
      return parts.slice(apiIndex + 1, apiIndex + 3).join('/').toUpperCase() || 'API';
    }
    
    return parts[0]?.toUpperCase() || 'HTTP';
  } catch {
    return 'HTTP';
  }
}

/**
 * Mapea código HTTP a código de error de la API
 */
function getCodeFromStatus(status: number): string {
  const mapping: Record<number, string> = {
    400: API_ERROR_CODES.VALIDATION_ERROR,
    401: API_ERROR_CODES.UNAUTHORIZED,
    403: API_ERROR_CODES.FORBIDDEN,
    404: API_ERROR_CODES.NOT_FOUND,
    409: API_ERROR_CODES.CONFLICT,
    422: API_ERROR_CODES.VALIDATION_ERROR,
    429: API_ERROR_CODES.RATE_LIMITED,
  };
  return mapping[status] || API_ERROR_CODES.INTERNAL_ERROR;
}
