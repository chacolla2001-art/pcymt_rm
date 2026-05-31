import { Component, OnInit, Inject, PLATFORM_ID, ViewChild, ChangeDetectorRef, ElementRef } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ChartType, ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';

import { DashboardMetricsService } from '../services/dashboard-metrics.service';
import { UserService } from '../../users/services/user.service';
import { ApiRoutesService } from '../../../core/services/api-routes.service';

import { VirtualAsset } from '../../virtual-assets/models/virtual-asset.model';
import { User } from '../../users/models/user.model';
import { TopVirtualAsset, TopUser } from '../models/dashboard-metrics.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BaseChartDirective,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatTooltipModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  /** Fecha actual para el banner de bienvenida */
  readonly today = new Date();

  // — Métricas principales —
  activeUsersCount = 0;
  totalUsers = 0;
  totalVirtualAssets = 0;
  totalAnchorPoints = 0;
  totalUserInteractions = 0;

  // — Control de paneles colapsables —
  showSessionFilters = false;
  showAssetFilters = false;

  // — Gráfico de roles (pie) —
  roleChartLabels: string[] = [];
  roleChartData: ChartData<'pie'> = { labels: [], datasets: [{ data: [] }] };
  roleChartType: ChartType = 'pie';

  // — Gráfico de estado de usuarios (doughnut) —
  userStatusChartLabels: string[] = ['Activos', 'Inactivos'];
  userStatusChartData: ChartData<'doughnut'> = {
    labels: this.userStatusChartLabels,
    datasets: [{ data: [] }]
  };
  userStatusChartType: ChartType = 'doughnut';

  // — Gráfico de interacciones por modelo (bar) —
  interactionChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ data: [], label: 'Interacciones' }]
  };
  selectedTimeRange: 'day' | 'month' | 'year' = 'day';

  // — Series temporal de sesiones (bar) —
  selectedPlatform: 'all' | 'web' | 'mobile' = 'all';
  selectedSessionRange: 'day' | 'month' | 'year' = 'day';
  sessionTimeChartType: ChartType = 'bar';
  sessionTimeChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ data: [], label: 'Inicios de sesión' }]
  };
  sessionPeriodOffset = 0;
  sessionPeriodLabel = '';

  // — Period offset for interactions —
  interactionPeriodOffset = 0;
  interactionPeriodLabel = '';

  // — Interaction type filter —
  selectedInteractionType: 'all' | 'view' | 'click' = 'all';

  // — Búsqueda de usuario —
  userSearch = '';
  matchingUsers: User[] = [];
  selectedUser: User | null = null;

  // — Modelos 3D disponibles —
  virtualAssets: VirtualAsset[] = [];
  filteredAssets: VirtualAsset[] = [];
  selectedAsset: VirtualAsset | null = null;

  // — Rankings —
  topVirtualAssets: TopVirtualAsset[] = [];
  topUsers: TopUser[] = [];
  sectionChartData: ChartData<'pie'> = { labels: [], datasets: [{ data: [] }] };

  // Referencias a los gráficos para forzar actualización
  @ViewChild('sessionChart') sessionChart?: BaseChartDirective;
  @ViewChild('interactionChart') interactionChart?: BaseChartDirective;
  @ViewChild('interactionSection') interactionSection?: ElementRef;

  // Flag para detectar si estamos en el navegador
  private readonly isBrowser: boolean;

  constructor(
    private metricsService: DashboardMetricsService,
    private userService: UserService,
    private router: Router,
    public apiRoutes: ApiRoutesService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;

    // Load initial metrics in parallel
    this.metricsService.loadAllMetrics().subscribe(metrics => {
      // Role chart
      this.roleChartData = this.metricsService.buildRoleChartData(metrics.usersByRole);
      this.roleChartLabels = metrics.usersByRole.map((item: any) => item.role);

      // Active users
      this.activeUsersCount = metrics.activeUsersCount;

      // User status
      this.userStatusChartData = this.metricsService.buildUserStatusChartData(
        metrics.userStatus.active,
        metrics.userStatus.inactive
      );

      // Total counts
      this.totalUsers = metrics.totalCounts.users ?? 0;
      this.totalUserInteractions = metrics.totalCounts.interactions ?? 0;
      this.totalAnchorPoints = metrics.totalCounts.locations ?? 0;
      this.totalVirtualAssets = metrics.totalCounts.virtualAssets ?? 0;
    });

    this.loadVirtualAssets();
    this.updateSessionPeriodLabel();
    this.updateInteractionPeriodLabel();
    this.loadSessionTimeSeries();

    // Load rankings
    this.metricsService.loadRankings().subscribe(rankings => {
      this.topVirtualAssets = rankings.topVirtualAssets;
      this.topUsers = rankings.topUsers;
      this.sectionChartData = this.metricsService.buildSectionChartData(rankings.interactionsBySection);
    });
  }

  // — Carga y filtrado de modelos 3D —
  loadVirtualAssets(): void {
    this.metricsService.loadVirtualAssets().subscribe(assets => {
      this.virtualAssets = assets;
      this.filteredAssets = [...this.virtualAssets];
      this.updateInteractionChartForAll(this.selectedTimeRange);
    });
  }

  onSearchInput(event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    this.filterAssets(input);
  }

  filterAssets(query: string): void {
    const lower = query.toLowerCase().trim();
    this.filteredAssets = this.virtualAssets.filter(a =>
      a.name.toLowerCase().includes(lower)
    );
    this.updateInteractionChartForAll(this.selectedTimeRange);
  }

  onAssetClicked(asset: VirtualAsset): void {
    this.selectedAsset = asset;
    this.loadInteractionChartForSelectedAsset();
  }

  private updateInteractionChartForAll(range: 'day' | 'month' | 'year'): void {
    this.updateInteractionChartPublic(range);
  }

  /** Actualiza el gráfico de interacciones para todos los assets filtrados */
  updateInteractionChartPublic(range: 'day' | 'month' | 'year'): void {
    this.metricsService.buildInteractionChartForAllAssets(this.filteredAssets, range, this.interactionPeriodOffset)
      .subscribe(chartData => {
        this.interactionChartData = { ...chartData };
        this.cdr.detectChanges();
        this.interactionChart?.chart?.update();
      });
  }

  // — Serie temporal de sesiones —
  onPlatformChanged(value: 'all' | 'web' | 'mobile'): void {
    this.selectedPlatform = value;
    this.loadSessionTimeSeries();
  }

  onSessionRangeChanged(value: 'day' | 'month' | 'year'): void {
    this.selectedSessionRange = value;
    this.sessionPeriodOffset = 0;
    this.updateSessionPeriodLabel();
    this.loadSessionTimeSeries();
  }

  /** Navigate session chart period forward/backward */
  navigateSessionPeriod(direction: number): void {
    this.sessionPeriodOffset += direction;
    this.updateSessionPeriodLabel();
    this.loadSessionTimeSeries();
  }

  /** Reset session period to current */
  resetSessionPeriod(): void {
    this.sessionPeriodOffset = 0;
    this.updateSessionPeriodLabel();
    this.loadSessionTimeSeries();
  }

  private updateSessionPeriodLabel(): void {
    this.sessionPeriodLabel = this.metricsService.getPeriodLabel(this.selectedSessionRange, this.sessionPeriodOffset);
  }

  loadSessionTimeSeries(): void {
    const platform = this.selectedPlatform !== 'all' ? this.selectedPlatform : undefined;
    this.metricsService.loadSessionTimeSeries(
      this.selectedSessionRange,
      platform,
      this.selectedUser?.id,
      this.sessionPeriodOffset
    ).subscribe(chartData => {
      this.sessionTimeChartData = chartData;
      this.cdr.detectChanges();
      this.sessionChart?.chart?.update();
    });
  }

  // — Búsqueda y selección de usuarios —
  searchUsers(): void {
    const term = this.userSearch.trim().toLowerCase();
    if (!term) return;
    this.userService.getAllUsers().subscribe(users => {
      this.matchingUsers = users.filter(u =>
        (u.name || '').toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
      );
    });
  }

  selectUser(user: User): void {
    this.selectedUser = user;
    this.loadSessionTimeSeries();
  }

  trackByUserId(_i: number, u: User): string {
    return u.id;
  }

  // — Optimización de ngFor —
  trackById(_i: number, item: { id: string }): string {
    return item.id;
  }

  /**
   * Maneja el toggle de día/mes/año para el gráfico de interacciones
   */
  onTimeRangeChanged(range: 'day' | 'month' | 'year'): void {
    this.selectedTimeRange = range;
    this.interactionPeriodOffset = 0;
    this.updateInteractionPeriodLabel();
    if (this.selectedAsset) {
      this.loadInteractionChartForSelectedAsset();
    } else {
      this.updateInteractionChartForAll(range);
    }
  }

  /** Navigate interaction chart period forward/backward */
  navigateInteractionPeriod(direction: number): void {
    this.interactionPeriodOffset += direction;
    this.updateInteractionPeriodLabel();
    if (this.selectedAsset) {
      this.loadInteractionChartForSelectedAsset();
    } else {
      this.updateInteractionChartForAll(this.selectedTimeRange);
    }
  }

  /** Reset interaction period to current */
  resetInteractionPeriod(): void {
    this.interactionPeriodOffset = 0;
    this.updateInteractionPeriodLabel();
    if (this.selectedAsset) {
      this.loadInteractionChartForSelectedAsset();
    } else {
      this.updateInteractionChartForAll(this.selectedTimeRange);
    }
  }

  private updateInteractionPeriodLabel(): void {
    this.interactionPeriodLabel = this.metricsService.getPeriodLabel(this.selectedTimeRange, this.interactionPeriodOffset);
  }

  /** Filter interaction type (all / view / click) */
  onInteractionTypeChanged(type: 'all' | 'view' | 'click'): void {
    this.selectedInteractionType = type;
    if (this.selectedAsset) {
      this.loadInteractionChartForSelectedAsset();
    }
  }

  private loadInteractionChartForSelectedAsset(): void {
    if (!this.selectedAsset) return;
    const interactionType = this.selectedInteractionType === 'all' ? undefined : this.selectedInteractionType;
    this.metricsService.buildInteractionChartForAsset(this.selectedAsset, this.selectedTimeRange, this.interactionPeriodOffset, interactionType)
      .subscribe(chartData => {
        this.interactionChartData = { ...chartData };
        this.cdr.detectChanges();
        this.interactionChart?.chart?.update();
      });
  }

  // — Download chart data as CSV —

  /** Download session chart data as CSV */
  downloadSessionData(): void {
    const data = this.sessionTimeChartData;
    if (!data.labels?.length) return;
    const csv = this.buildCsv(
      ['Fecha', 'Inicios de sesión'],
      data.labels.map((label, i) => [String(label), String(data.datasets[0]?.data[i] ?? 0)])
    );
    this.downloadFile(csv, `accesos_${this.selectedSessionRange}_${this.sessionPeriodLabel.replace(/\s/g, '_')}.csv`);
  }

  /** Download interaction chart data as CSV */
  downloadInteractionData(): void {
    const data = this.interactionChartData;
    if (!data.labels?.length) return;
    if (this.selectedAsset && data.datasets.length >= 2) {
      const csv = this.buildCsv(
        ['Fecha', 'Vistos', 'Clics'],
        data.labels.map((label, i) => [
          String(label),
          String(data.datasets[0]?.data[i] ?? 0),
          String(data.datasets[1]?.data[i] ?? 0)
        ])
      );
      this.downloadFile(csv, `interacciones_${this.selectedAsset.name.replace(/\s/g, '_')}.csv`);
    } else {
      const csv = this.buildCsv(
        ['Animal', 'Interacciones'],
        data.labels.map((label, i) => [String(label), String(data.datasets[0]?.data[i] ?? 0)])
      );
      this.downloadFile(csv, `interacciones_todos_${this.interactionPeriodLabel.replace(/\s/g, '_')}.csv`);
    }
  }

  private buildCsv(headers: string[], rows: string[][]): string {
    const bom = '\ufeff';
    return bom + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  }

  private downloadFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // — Navegación a tablas —

  /** Navega a la tabla de virtual assets y filtra al registro */
  navigateToVirtualAsset(assetId: string): void {
    this.router.navigate(['/virtual-assets'], {
      queryParams: { filterId: assetId }
    });
  }

  /** Navega a la tabla de usuarios y filtra al registro */
  navigateToUser(userId: string): void {
    this.router.navigate(['/users'], {
      queryParams: { filterId: userId }
    });
  }

  /** Navega a la tabla de anchor points filtrada por sección */
  navigateToSection(sectionName: string): void {
    const sectionMap: Record<string, string> = {
      'Tierras Altas': '1',
      'Tierras Medias': '2',
      'Tierras Bajas': '3',
      'Mitos y Leyendas': '4'
    };
    this.router.navigate(['/anchor-points'], {
      queryParams: { section: sectionMap[sectionName] }
    });
  }

  /** Navega a la tabla según el tipo de dato de la tarjeta métrica */
  navigateToTable(type: 'users' | 'virtualAssets' | 'anchorPoints'): void {
    const routeMap: Record<string, string> = {
      users: '/users',
      virtualAssets: '/virtual-assets',
      anchorPoints: '/anchor-points'
    };
    this.router.navigate([routeMap[type]]);
  }

  /** Scroll suave a la sección del gráfico de interacciones */
  scrollToInteractionChart(): void {
    this.interactionSection?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Navega a las páginas de estadísticas detalladas */
  navigateToStats(page: 'session-history' | 'interaction-stats' | 'top-animals' | 'top-users' | 'zone-visits'): void {
    this.router.navigate([`/stats/${page}`]);
  }

  /** Navegación genérica por ruta absoluta (mapa, animador, etc.) */
  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
