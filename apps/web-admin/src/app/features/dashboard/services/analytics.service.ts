import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiRoutesService } from '@core/services/api-routes.service';

/** Respuesta estándar del backend */
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

/**
 * Servicio de Analytics
 * Maneja consultas de analítica e interacciones de usuario
 *
 * Nota: El token de autenticación se agrega automáticamente por el tokenInterceptor
 */
@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  constructor(
    private http: HttpClient,
    private apiRoutes: ApiRoutesService
  ) {}

  // Analítica
  getUsersByRole(): Observable<any> {
    return this.http.get<ApiResponse<any>>(this.apiRoutes.endpoints.analytics.usersByRole)
      .pipe(map(response => response.data));
  }

  getActiveUsersCount(): Observable<any> {
    return this.http.get<ApiResponse<any>>(this.apiRoutes.endpoints.analytics.activeUsersCount)
      .pipe(map(response => response.data));
  }

  getInteractionsByType(): Observable<any> {
    return this.http.get<ApiResponse<any>>(this.apiRoutes.endpoints.analytics.interactionsByType)
      .pipe(map(response => response.data));
  }

  getActiveVirtualAssets(): Observable<any> {
    return this.http.get<ApiResponse<any>>(this.apiRoutes.endpoints.analytics.activeVirtualAssets)
      .pipe(map(response => response.data));
  }

  getAnchorPointsByLocation(): Observable<any> {
    return this.http.get<ApiResponse<any>>(this.apiRoutes.endpoints.analytics.anchorPointsByLocation)
      .pipe(map(response => response.data));
  }

  getUsersStatus(): Observable<any> {
    return this.http.get<ApiResponse<any>>(this.apiRoutes.endpoints.analytics.usersStatus)
      .pipe(map(response => response.data));
  }

  getTotalInteractions(): Observable<any> {
    return this.http.get<ApiResponse<any>>(this.apiRoutes.endpoints.analytics.totalInteractions)
      .pipe(map(response => response.data));
  }

  getLastAccessDates(): Observable<any> {
    return this.http.get<ApiResponse<any>>(this.apiRoutes.endpoints.analytics.lastAccess)
      .pipe(map(response => response.data));
  }

  getTotalCounts(): Observable<any> {
    return this.http.get<ApiResponse<any>>(this.apiRoutes.endpoints.analytics.totals)
      .pipe(map(response => response.data));
  }

  // Interacciones de usuario
  getAllUserInteractions(): Observable<any> {
    return this.http.get<ApiResponse<any>>(this.apiRoutes.endpoints.userInteractions.base)
      .pipe(map(response => response.data));
  }

  getUserInteractionById(id: string): Observable<any> {
    return this.http.get<ApiResponse<any>>(this.apiRoutes.endpoints.userInteractions.byId(id))
      .pipe(map(response => response.data));
  }

  createUserInteraction(data: any): Observable<any> {
    return this.http.post<ApiResponse<any>>(this.apiRoutes.endpoints.userInteractions.base, data)
      .pipe(map(response => response.data));
  }

  updateUserInteraction(id: string, data: any): Observable<any> {
    return this.http.put<ApiResponse<any>>(this.apiRoutes.endpoints.userInteractions.byId(id), data)
      .pipe(map(response => response.data));
  }

  deleteUserInteraction(id: string): Observable<any> {
    return this.http.delete<ApiResponse<any>>(this.apiRoutes.endpoints.userInteractions.byId(id))
      .pipe(map(response => response.data));
  }

  getTimeSeriesInteractionsByVirtualAsset(
    assetId: string,
    range: 'day' | 'month' | 'year',
    interactionType?: string,
    offset?: number
  ): Observable<any> {
    let query = `?range=${range}`;
    if (interactionType !== undefined) query += `&type=${interactionType}`;
    if (offset !== undefined && offset !== 0) query += `&offset=${offset}`;

    return this.http.get<ApiResponse<any>>(`${this.apiRoutes.endpoints.userInteractions.base}/by-virtual-asset/${assetId}${query}`)
      .pipe(map(response => response.data));
  }

  /**
   * Get top virtual assets by interaction count
   * @param limit Number of results to return (default: 5)
   */
  getTopVirtualAssets(limit = 5): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.apiRoutes.endpoints.analytics.topVirtualAssets}?limit=${limit}`)
      .pipe(map(response => response.data));
  }

  /**
   * Get top users by interaction count
   * @param limit Number of results to return (default: 5)
   */
  getTopUsers(limit = 5): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.apiRoutes.endpoints.analytics.topUsers}?limit=${limit}`)
      .pipe(map(response => response.data));
  }

  /**
   * Get interactions grouped by section/area
   */
  getInteractionsBySection(): Observable<any> {
    return this.http.get<ApiResponse<any>>(this.apiRoutes.endpoints.analytics.interactionsBySection)
      .pipe(map(response => response.data));
  }

  /**
   * Get time-series interaction counts grouped by park section.
   * @param section - Normalized section name (e.g. 'Tierras Bajas') or null/undefined for ALL sections
   * @param range - 'day' | 'month' | 'year'
   * @param offset - Period offset (0 = current)
   * @returns Observable<{ date: string; count: number }[]> for single section,
   *          or Observable<{ date: string; section: string; count: number }[]> for all sections
   */
  getTimeSeriesBySection(
    section: string | null | undefined,
    range: 'day' | 'month' | 'year',
    offset = 0
  ): Observable<any[]> {
    let query = `?range=${range}&offset=${offset}`;
    if (section) query += `&section=${encodeURIComponent(section)}`;
    return this.http
      .get<ApiResponse<any[]>>(`${this.apiRoutes.endpoints.analytics.timeSeriesBySection}${query}`)
      .pipe(map(response => response.data));
  }
}
