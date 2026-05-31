import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap, catchError, throwError, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { User } from '../../features/users/models/user.model';
import { AlertService } from './alert.service';
import { ApiRoutesService } from './api-routes.service';
import { LoggerService } from './logger.service';
import {
  LoginResponse,
  ApiErrorResponse,
  API_ERROR_CODES,
  ERROR_MESSAGES,
  RefreshTokenResponse
} from '../models/api-response.model';

/** Claves de almacenamiento local */
const STORAGE_KEYS = {
  TOKEN: 'token',
  REFRESH_TOKEN: 'refresh_token',
  LOGIN_TIME: 'login_time',
  USER: 'user'
} as const;

/**
 * Servicio de Autenticación
 * Maneja login, logout, tokens y validación de sesión
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  public currentUser: User | undefined;
  private readonly isBrowser: boolean;

  constructor(
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly alertService: AlertService,
    private readonly apiRoutes: ApiRoutesService,
    private readonly logger: LoggerService,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.loadUserFromStorage();
  }

  /** Carga el usuario desde localStorage si existe una sesión válida */
  private loadUserFromStorage(): void {
    if (!this.isUserAuthenticated()) return;

    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    if (userStr) {
      try {
        const parsedUser = JSON.parse(userStr);
        this.currentUser = new User(parsedUser);
        this.logger.debug('Usuario cargado desde storage', 'AuthService', {
          email: this.currentUser.email
        });
      } catch (error) {
        this.logger.error('Error al parsear usuario desde storage', 'AuthService');
        this.clearStorage();
      }
    }
  }

  /** Inicia sesión con credenciales */
  login(credentials: { email: string; password: string }): Observable<LoginResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const payload = {
      ...credentials,
      platform: 'web'
    };

    this.logger.info('Iniciando login', 'AuthService', { email: credentials.email });

    return this.http
      .post<LoginResponse>(this.apiRoutes.endpoints.auth.login, payload, { headers })
      .pipe(
        tap((response) => {
          if (!response.success || !response.data) {
            this.logger.error('Respuesta de login sin datos', 'AuthService', {
              success: response.success,
              message: response.message
            });
            return;
          }

          if (!response.data.token) {
            this.logger.error('Respuesta de login sin token', 'AuthService');
            return;
          }

          // Guardar datos de usuario - campos sincronizados con backend
          const user = response.data.user;
          const userData: Partial<User> = {
            id: String(user.id),
            name: user.name,
            email: user.email,
            role: user.role,
            is_active: user.is_active,
            avatar_url: user.avatar_url,
            email_verified_at: user.email_verified_at ? new Date(user.email_verified_at) : undefined,
            last_login_at: user.last_login_at ? new Date(user.last_login_at) : undefined,
            created_at: user.created_at ? new Date(user.created_at) : undefined,
            updated_at: user.updated_at ? new Date(user.updated_at) : undefined
          };
          this.currentUser = new User(userData);
          this.saveToken(response.data.token, response.data.refreshToken);

          if (this.isBrowser) {
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data.user));
          }

          this.logger.info('Login exitoso', 'AuthService', {
            userId: response.data.user.id,
            email: response.data.user.email,
            role: response.data.user.role
          });
        }),
        catchError((error: HttpErrorResponse) => this.handleAuthError(error, 'login'))
      );
  }

  /** Cierra la sesión actual */
  logout(): void {
    if (!this.isBrowser) return;

    this.logger.info('Cerrando sesión', 'AuthService', {
      userId: this.currentUser?.id
    });

    this.clearStorage();
    this.currentUser = undefined;
    this.router.navigate(['/login']);
  }

  /** Verifica si el usuario tiene una sesión válida */
  isUserAuthenticated(): boolean {
    if (!this.isBrowser) return false;

    const token = this.getToken();
    const loginTimeStr = localStorage.getItem(STORAGE_KEYS.LOGIN_TIME);

    if (!token || !loginTimeStr) {
      return false;
    }

    const loginTime = parseInt(loginTimeStr, 10);
    const currentTime = Date.now();
    const isValid = (currentTime - loginTime) < environment.authDurationMs;

    if (!isValid) {
      this.logger.warn('Sesión expirada por tiempo', 'AuthService', {
        loginTime: new Date(loginTime).toISOString(),
        currentTime: new Date(currentTime).toISOString(),
        maxDurationMs: environment.authDurationMs
      });
      this.alertService.showError(ERROR_MESSAGES[API_ERROR_CODES.SESSION_EXPIRED]);
      this.logout();
      return false;
    }

    return true;
  }

  /** Guarda los tokens y tiempo de login */
  private saveToken(token: string, refreshToken?: string): void {
    if (!this.isBrowser) {
      this.logger.debug('Saltando guardado de token (no browser)', 'AuthService');
      return;
    }

    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.LOGIN_TIME, Date.now().toString());

    if (refreshToken) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }

    this.logger.debug('Token guardado correctamente', 'AuthService');
  }

  /** Obtiene el token actual */
  getToken(): string | null {
    return this.isBrowser ? localStorage.getItem(STORAGE_KEYS.TOKEN) : null;
  }

  /** Obtiene el refresh token actual */
  getRefreshToken(): string | null {
    return this.isBrowser ? localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) : null;
  }

  /** Refresca el access token usando el refresh token */
  refreshAccessToken(): Observable<RefreshTokenResponse> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      this.logger.warn('No hay refresh token disponible', 'AuthService');
      return throwError(() => new Error('No refresh token'));
    }

    this.logger.debug('Refrescando access token', 'AuthService');

    return this.http
      .post<RefreshTokenResponse>(this.apiRoutes.endpoints.auth.refresh, { refreshToken })
      .pipe(
        tap((response) => {
          if (response.success && response.data) {
            this.saveToken(response.data.token, response.data.refreshToken);

            // Actualizar usuario si viene en la respuesta
            if (response.data.user) {
              const userData: Partial<User> = {
                id: String(response.data.user.id),
                name: response.data.user.name,
                email: response.data.user.email,
                role: response.data.user.role,
                is_active: response.data.user.is_active,
              };
              this.currentUser = new User(userData);
              localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data.user));
            }

            this.logger.info('Token refrescado exitosamente', 'AuthService');
          }
        }),
        catchError((error: HttpErrorResponse) => {
          this.logger.error('Error al refrescar token', 'AuthService', { status: error.status });
          // Si el refresh token expiró, hacer logout
          if (error.status === 401) {
            this.logout();
          }
          return throwError(() => error);
        })
      );
  }

  /** Actualiza los datos del usuario actual */
  updateCurrentUser(user: User): void {
    this.currentUser = new User(user);
    if (this.isBrowser) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      this.logger.debug('Usuario actualizado en storage', 'AuthService', {
        email: user.email
      });
    }
  }

  /** Limpia todos los datos de sesión del almacenamiento */
  private clearStorage(): void {
    if (!this.isBrowser) return;

    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    this.logger.debug('Storage limpiado', 'AuthService');
  }

  /**
   * Maneja errores de autenticación de forma centralizada
   */
  private handleAuthError(error: HttpErrorResponse, action: string): Observable<never> {
    this.logger.logAuthError(error, action);

    const errorBody = error.error as ApiErrorResponse | null;
    let userMessage = ERROR_MESSAGES[API_ERROR_CODES.INTERNAL_ERROR];

    if (error.status === 0) {
      userMessage = ERROR_MESSAGES[API_ERROR_CODES.NETWORK_ERROR];
    } else if (error.status === 401) {
      userMessage = errorBody?.message || ERROR_MESSAGES[API_ERROR_CODES.UNAUTHORIZED];
    } else if (error.status === 403) {
      userMessage = errorBody?.message || ERROR_MESSAGES[API_ERROR_CODES.FORBIDDEN];
    } else if (error.status === 429) {
      userMessage = ERROR_MESSAGES[API_ERROR_CODES.RATE_LIMITED];
    } else if (errorBody?.message) {
      userMessage = errorBody.message;
    }

    this.alertService.showError(userMessage);

    return throwError(() => error);
  }
}
