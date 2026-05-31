import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Claves de almacenamiento */
const TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refresh_token';

/** URLs que no deben intentar refresh automático */
const SKIP_REFRESH_URLS = ['/auth/login', '/auth/refresh', '/auth/register'];

/**
 * Interceptor funcional que agrega el token JWT a todas las solicitudes HTTP
 * y maneja el refresh automático de tokens expirados.
 *
 * Compatible con Angular 18+ standalone APIs y SSR
 */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);

  // Solo procesar en el navegador (no en SSR)
  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }

  // Agregar token a la petición
  const requestWithToken = addTokenToRequest(req);

  return next(requestWithToken).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si es 401 y no es una URL de auth, intentar refrescar el token
      if (error.status === 401 && !shouldSkipRefresh(req.url)) {
        return handleTokenRefresh(req, next);
      }
      return throwError(() => error);
    })
  );
};

/**
 * Agrega el token de autorización a la petición
 */
function addTokenToRequest(req: HttpRequest<unknown>): HttpRequest<unknown> {
  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    return req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`),
    });
  }

  return req;
}

/**
 * Verifica si la URL debe saltar el refresh automático
 */
function shouldSkipRefresh(url: string): boolean {
  return SKIP_REFRESH_URLS.some(skipUrl => url.includes(skipUrl));
}

/**
 * Intenta refrescar el token y reintentar la petición original
 */
function handleTokenRefresh(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const authService = inject(AuthService);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  // Si no hay refresh token, propagar el error
  if (!refreshToken) {
    return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'No refresh token' }));
  }

  return authService.refreshAccessToken().pipe(
    switchMap(() => {
      // Reintentar la petición original con el nuevo token
      const retryRequest = addTokenToRequest(req);
      return next(retryRequest);
    }),
    catchError((refreshError) => {
      // Si el refresh falla, propagar el error (el AuthService ya hace logout)
      return throwError(() => refreshError);
    })
  );
}
