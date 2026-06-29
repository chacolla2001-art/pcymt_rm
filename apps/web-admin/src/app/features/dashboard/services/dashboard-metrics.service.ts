import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';
import { ChartData } from 'chart.js';

import { AnalyticsService } from './analytics.service';
import { VirtualAssetService } from '../../virtual-assets/services/virtual-asset.service';
import { UserSessionService, TimeSeriesPoint } from './user-session.service';
import { VirtualAsset } from '../../virtual-assets/models/virtual-asset.model';
import {
  UserRoleCount,
  UserStatusCount,
  DashboardTotals,
  TopVirtualAsset,
  TopUser,
  InteractionsBySection,
  InteractionsByType,
  TimeSeriesInteraction
} from '../models/dashboard-metrics.model';

/**
 * Service for managing dashboard metrics and chart data
 * Separates data fetching logic from component presentation logic
 */
@Injectable({
  providedIn: 'root'
})
export class DashboardMetricsService {
  constructor(
    private analyticsService: AnalyticsService,
    private virtualAssetService: VirtualAssetService,
    private userSessionService: UserSessionService
  ) {}

  /**
   * Load all initial dashboard metrics in parallel
   */
  loadAllMetrics(): Observable<{
    usersByRole: UserRoleCount[];
    activeUsersCount: number;
    userStatus: { active: number; inactive: number };
    totalCounts: { users: number; virtualAssets: number; interactions: number; locations: number };
  }> {
    return forkJoin({
      usersByRole: this.analyticsService.getUsersByRole(),
      activeUsersCount: this.analyticsService.getActiveUsersCount().pipe(
        map(data => data.activeUsers)
      ),
      userStatus: this.analyticsService.getUsersStatus(),
      totalCounts: this.analyticsService.getTotalCounts()
    }).pipe(
      catchError(err => {
        console.error('Error loading metrics:', err);
        return of({
          usersByRole: [],
          activeUsersCount: 0,
          userStatus: { active: 0, inactive: 0 },
          totalCounts: { users: 0, virtualAssets: 0, interactions: 0, locations: 0 }
        });
      })
    );
  }

  /** Cached active virtual assets (shared across subscribers, refreshed on next call) */
  private virtualAssetsCache$: Observable<VirtualAsset[]> | null = null;

  /**
   * Load active virtual assets — result is shared & cached to avoid duplicate HTTP calls
   */
  loadVirtualAssets(): Observable<VirtualAsset[]> {
    if (!this.virtualAssetsCache$) {
      this.virtualAssetsCache$ = this.virtualAssetService.getAllVirtualAssets().pipe(
        map(assets => assets.filter(a => a.is_active)),
        catchError(() => of([])),
        shareReplay(1)
      );
    }
    return this.virtualAssetsCache$;
  }

  /** Invalidate the virtual assets cache (call after create/update/delete) */
  invalidateVirtualAssetsCache(): void {
    this.virtualAssetsCache$ = null;
  }

  /**
   * Build role chart data from analytics data
   */
  buildRoleChartData(data: UserRoleCount[]): ChartData<'pie'> {
    return {
      labels: data.map((item) => item.role),
      datasets: [{ data: data.map((item) => item.count) }]
    };
  }

  /**
   * Build user status chart data
   */
  buildUserStatusChartData(active: number, inactive: number): ChartData<'doughnut'> {
    return {
      labels: ['Activos', 'Inactivos'],
      datasets: [{ data: [active, inactive] }]
    };
  }

  /**
   * Build interaction chart data for a specific asset
   */
  buildInteractionChartForAsset(asset: VirtualAsset, range: 'day' | 'month' | 'year', offset = 0, interactionType?: string): Observable<ChartData<'bar'>> {
    return this.analyticsService
      .getTimeSeriesInteractionsByVirtualAsset(asset.id, range, interactionType, offset)
      .pipe(
        map((data: TimeSeriesInteraction[]) => {
          const labels = this.generateTimeLabels(range, offset);
          const vistos = labels.map(lbl =>
            Number(data.find(i => i.date === lbl && i.interactionType === 'view')?.count ?? 0)
          );
          const clics = labels.map(lbl =>
            Number(data.find(i => i.date === lbl && i.interactionType === 'click')?.count ?? 0)
          );
          return {
            labels,
            datasets: [
              { label: 'Vistos', data: vistos },
              { label: 'Clics', data: clics }
            ]
          };
        }),
        catchError(() => of({
          labels: [],
          datasets: [{ label: 'Vistos', data: [] }, { label: 'Clics', data: [] }]
        }))
      );
  }

  /**
   * Build interaction chart data for multiple assets
   */
  buildInteractionChartForAllAssets(
    assets: VirtualAsset[],
    range: 'day' | 'month' | 'year',
    offset = 0
  ): Observable<ChartData<'bar'>> {
    if (!assets.length) {
      return of({
        labels: [],
        datasets: [{ data: [], label: 'Interacciones' }]
      });
    }

    const requests = assets.map(asset =>
      this.analyticsService
        .getTimeSeriesInteractionsByVirtualAsset(asset.id, range, undefined, offset)
        .pipe(
          map(data => ({
            name: asset.name,
            total: Array.isArray(data) ? data.reduce((sum, item) => sum + Number(item.count || 0), 0) : 0
          })),
          catchError(() => of({ name: asset.name, total: 0 }))
        )
    );

    return forkJoin(requests).pipe(
      map(results => ({
        labels: results.map(r => r.name),
        datasets: [{ data: results.map(r => r.total), label: 'Interacciones' }]
      }))
    );
  }

  /**
   * Load session time series data
   */
  loadSessionTimeSeries(
    range: 'day' | 'month' | 'year',
    platform?: 'web' | 'mobile',
    userId?: string,
    offset = 0
  ): Observable<ChartData<'bar'>> {
    return this.userSessionService
      .getSessionTimeSeries({ range, platform, userId, offset })
      .pipe(
        map((data: TimeSeriesPoint[]) => {
          const labels = this.generateTimeLabels(range, offset);
          const counts = labels.map(lbl => {
            const pt = data.find(d => d.date === lbl);
            return pt ? pt.count : 0;
          });
          return {
            labels,
            datasets: [{ data: counts, label: 'Inicios de sesión' }]
          };
        }),
        catchError(() => of({
          labels: [],
          datasets: [{ data: [], label: 'Inicios de sesión' }]
        }))
      );
  }

  /**
   * Load top rankings data
   */
  loadRankings(): Observable<{
    topVirtualAssets: TopVirtualAsset[];
    topUsers: TopUser[];
    interactionsBySection: InteractionsBySection[];
  }> {
    return forkJoin({
      topVirtualAssets: this.analyticsService.getTopVirtualAssets(5).pipe(
        map(data => data.map((item: any) => ({
          id: item.virtual_asset_id,
          name: item.name ?? 'Modelo sin nombre',
          icon_url: item.icon_url,
          interactionCount: Number(item.interactionCount)
        }))),
        catchError(() => of([]))
      ),
      topUsers: this.analyticsService.getTopUsers(5).pipe(
        map(data => data.map((item: any) => ({
          id: item.user_id,
          username: item.username || `Usuario ${item.user_id?.substring(0, 8) ?? ''}`,
          interactionCount: Number(item.interactionCount)
        }))),
        catchError(() => of([]))
      ),
      interactionsBySection: this.analyticsService.getInteractionsBySection().pipe(
        catchError(() => of([]))
      )
    });
  }

  /**
   * Build section chart data with custom colors
   */
  buildSectionChartData(data: InteractionsBySection[]): ChartData<'pie'> {
    const sectionColors: Record<string, string> = {
      'Tierras Altas': 'rgba(139, 90, 43, 0.85)',
      'Tierras Medias': 'rgba(76, 175, 80, 0.85)',
      'Tierras Bajas': 'rgba(255, 193, 7, 0.85)',
      'Mitos y Leyendas': 'rgba(103, 58, 183, 0.85)',
      'Sin clasificar': 'rgba(158, 158, 158, 0.85)'
    };

    const colors = data.map(item =>
      sectionColors[item.section] || 'rgba(158, 158, 158, 0.85)'
    );

    return {
      labels: data.map(item => item.section),
      datasets: [{
        data: data.map(item => Number(item.interactionCount)),
        backgroundColor: colors
      }]
    };
  }

  /**
   * Generate time labels based on range
   */
  generateTimeLabels(range: 'day' | 'month' | 'year', offset = 0): string[] {
    const now = new Date();
    const labels: string[] = [];

    if (range === 'day') {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const days = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
      const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
      for (let d = 1; d <= days; d += 1) {
        labels.push(`${targetDate.getFullYear()}-${mm}-${String(d).padStart(2, '0')}`);
      }
    } else if (range === 'month') {
      const targetYear = now.getFullYear() + offset;
      for (let m = 1; m <= 12; m += 1) {
        labels.push(`${targetYear}-${String(m).padStart(2, '0')}`);
      }
    } else {
      const baseYear = now.getFullYear() + offset;
      const startYear = baseYear - 4;
      for (let y = startYear; y <= baseYear; y += 1) {
        labels.push(String(y));
      }
    }

    return labels;
  }

  /**
   * Get the display label for the current period based on range and offset
   */
  getPeriodLabel(range: 'day' | 'month' | 'year', offset = 0): string {
    const now = new Date();
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    if (range === 'day') {
      const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return `${monthNames[target.getMonth()]} ${target.getFullYear()}`;
    } else if (range === 'month') {
      return `${now.getFullYear() + offset}`;
    } else {
      const base = now.getFullYear() + offset;
      return `${base - 4} – ${base}`;
    }
  }
}
