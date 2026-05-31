import { Component, OnInit, Inject, PLATFORM_ID, ViewChild, ChangeDetectorRef } from '@angular/core';
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
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { DashboardMetricsService } from '../../dashboard/services/dashboard-metrics.service';
import { UserService } from '../../users/services/user.service';
import { User } from '../../users/models/user.model';
import { TopUser } from '../../dashboard/models/dashboard-metrics.model';

@Component({
  selector: 'app-session-history',
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
    MatTooltipModule,
    MatProgressBarModule
  ],
  templateUrl: './session-history.component.html',
  styleUrls: ['./session-history.component.scss']
})
export class SessionHistoryComponent implements OnInit {
  // — Ranking de usuarios (integrado de top-users) —
  topUsers: TopUser[] = [];
  rankingBarChartData: ChartData<'bar'> = { labels: [], datasets: [{ data: [], label: 'Interacciones' }] };
  maxRankingCount = 0;

  // — Control de paneles colapsables —
  showSessionFilters = true;

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

  // — Búsqueda de usuario —
  userSearch = '';
  matchingUsers: User[] = [];
  selectedUser: User | null = null;

  @ViewChild('sessionChart') sessionChart?: BaseChartDirective;

  private readonly isBrowser: boolean;

  constructor(
    private metricsService: DashboardMetricsService,
    private userService: UserService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.updateSessionPeriodLabel();
    this.loadSessionTimeSeries();
    this.loadRankings();
  }

  // — Ranking methods (from top-users) —
  loadRankings(): void {
    this.metricsService.loadRankings().subscribe(rankings => {
      this.topUsers = rankings.topUsers;
      this.maxRankingCount = Math.max(...this.topUsers.map(u => u.interactionCount), 1);
      this.rankingBarChartData = {
        labels: this.topUsers.map(u => u.name || ''),
        datasets: [{
          data: this.topUsers.map(u => u.interactionCount),
          label: 'Interacciones',
          backgroundColor: [
            'rgba(33, 150, 243, 0.85)',
            'rgba(76, 175, 80, 0.85)',
            'rgba(255, 193, 7, 0.85)',
            'rgba(156, 39, 176, 0.85)',
            'rgba(255, 87, 34, 0.85)'
          ]
        }]
      };
    });
  }

  getRankingProgress(count: number): number {
    return (count / this.maxRankingCount) * 100;
  }

  getDisplayName(user: TopUser): string {
    return user.name || user.email || '';
  }

  navigateToUser(userId: string): void {
    this.router.navigate(['/users'], { queryParams: { filterId: userId } });
  }

  // — Plataforma —
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

  navigateSessionPeriod(direction: number): void {
    this.sessionPeriodOffset += direction;
    this.updateSessionPeriodLabel();
    this.loadSessionTimeSeries();
  }

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

  clearUser(): void {
    this.selectedUser = null;
    this.loadSessionTimeSeries();
  }

  trackByUserId(_i: number, u: User): string {
    return u.id;
  }

  // — Download CSV —
  downloadSessionData(): void {
    const data = this.sessionTimeChartData;
    if (!data.labels?.length) return;
    const bom = '\ufeff';
    const csv = bom + [
      'Fecha;Inicios de sesión',
      ...data.labels.map((label, i) => `${label};${data.datasets[0]?.data[i] ?? 0}`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accesos_${this.selectedSessionRange}_${this.sessionPeriodLabel.replace(/\s/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
