import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { UserSession, UserRole, Platform } from '../models/user-session.model';
import { ApiRoutesService } from '@core/services/api-routes.service';

/** Respuesta estándar del backend */
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

/** Estadísticas de sesiones agrupadas */
export interface SessionStats {
  role: UserRole;
  platform: Platform;
  count: number;
}

/** Punto de datos para series temporales */
export interface TimeSeriesPoint {
  /** Formato: 'YYYY-MM-DD', 'YYYY-MM' o 'YYYY' */
  date: string;
  count: number;
}

/** Rango de tiempo para consultas */
export type TimeRange = 'day' | 'month' | 'year';

/** Filtros para estadísticas de sesiones */
export interface SessionStatsFilters {
  role?: UserRole;
  platform?: Platform;
}

/** Opciones para series temporales */
export interface TimeSeriesOptions {
  range: TimeRange;
  platform?: Platform;
  userId?: string;
  offset?: number;
}

/**
 * Servicio de Sesiones de Usuario
 * Maneja el registro y análisis de sesiones de usuario
 *
 * Nota: El token de autenticación se agrega automáticamente por el tokenInterceptor
 */
@Injectable({
  providedIn: 'root',
})
export class UserSessionService {
  constructor(
    private readonly http: HttpClient,
    private readonly apiRoutes: ApiRoutesService
  ) {}

  /** Manejo centralizado de errores HTTP */
  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => error);
  }

  // ═══════════════════════════════════════════════════════════════
  // OPERACIONES CRUD
  // ═══════════════════════════════════════════════════════════════

  /** Obtener todas las sesiones */
  getAllSessions(): Observable<UserSession[]> {
    return this.http
      .get<ApiResponse<UserSession[]>>(this.apiRoutes.endpoints.userSessions.base)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /** Obtener sesiones de un usuario específico */
  getSessionsByUser(userId: string): Observable<UserSession[]> {
    return this.http
      .get<ApiResponse<UserSession[]>>(this.apiRoutes.endpoints.userSessions.byUserId(userId))
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /** Crear (login) una nueva sesión */
  createSession(role: UserRole, platform: Platform): Observable<UserSession> {
    return this.http
      .post<UserSession>(this.apiRoutes.endpoints.userSessions.base, { role, platform })
      .pipe(catchError(this.handleError));
  }

  /** Cerrar (logout) una sesión existente */
  logoutSession(sessionId: string): Observable<UserSession> {
    return this.http
      .patch<UserSession>(`${this.apiRoutes.endpoints.userSessions.byId(sessionId)}/logout`, {})
      .pipe(catchError(this.handleError));
  }

  // ═══════════════════════════════════════════════════════════════
  // ESTADÍSTICAS Y ANÁLISIS
  // ═══════════════════════════════════════════════════════════════

  /** Obtener estadísticas de inicios de sesión (opcionalmente filtradas) */
  getSessionStats(filters?: SessionStatsFilters): Observable<SessionStats[]> {
    let params = new HttpParams();
    if (filters?.role) {
      params = params.set('role', filters.role);
    }
    if (filters?.platform) {
      params = params.set('platform', filters.platform);
    }

    return this.http
      .get<ApiResponse<SessionStats[]>>(this.apiRoutes.endpoints.userSessions.stats, { params })
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /** Obtener serie temporal de inicios de sesión */
  getSessionTimeSeries(opts: TimeSeriesOptions): Observable<TimeSeriesPoint[]> {
    let params = new HttpParams().set('range', opts.range);

    if (opts.platform) {
      params = params.set('platform', opts.platform);
    }
    if (opts.userId) {
      params = params.set('userId', opts.userId);
    }
    if (opts.offset !== undefined && opts.offset !== 0) {
      params = params.set('offset', opts.offset.toString());
    }

    return this.http
      .get<ApiResponse<TimeSeriesPoint[]>>(this.apiRoutes.endpoints.userSessions.timeSeries, { params })
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }
}
