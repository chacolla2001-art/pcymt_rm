import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { LoggerService } from '../services/logger.service';
import { AlertService } from '../services/alert.service';
import { resolveApiError } from '../utils/api-error.util';

/**
 * Interceptor centralizado de errores HTTP (browser only).
 * Usa shared/constants/api-error-codes.json vía api-error.util.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }

  const router = inject(Router);
  const authService = inject(AuthService);
  const logger = inject(LoggerService);
  const alertService = inject(AlertService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const context = getContextFromUrl(req.url);
      const resolved = resolveApiError(error, req.url);

      logger.logHttpError(error, context);

      if (resolved.errors?.length) {
        logger.logValidationError(resolved.errors, context);
      }

      if (error.status === 0) {
        logger.logNetworkError(error);
      }

      if (resolved.shouldLogout) {
        logger.warn('Sesión inválida, redirigiendo a login', 'ErrorInterceptor', {
          url: req.url,
          code: resolved.code,
        });
        authService.logout();
        router.navigate(['/login']);
      } else if (resolved.alertLevel === 'warning') {
        alertService.showWarning(resolved.message);
      } else if (resolved.alertLevel === 'error') {
        if (resolved.status >= 500) {
          logger.error('Error del servidor', 'ErrorInterceptor', {
            status: resolved.status,
            url: req.url,
            code: resolved.code,
            message: resolved.message,
          });
        }
        alertService.showError(resolved.message);
      } else if (resolved.status === 404) {
        logger.warn('Recurso no encontrado', 'ErrorInterceptor', {
          url: req.url,
          code: resolved.code,
        });
      }

      return throwError(() => error);
    })
  );
};

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
