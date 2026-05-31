import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatBadgeModule } from '@angular/material/badge';

import { AnalyticsService } from '../../dashboard/services/analytics.service';
import { DashboardMetricsService } from '../../dashboard/services/dashboard-metrics.service';
import { UserService } from '../../users/services/user.service';
import { ApiRoutesService } from '../../../core/services/api-routes.service';
import { User } from '../../users/models/user.model';
import { VirtualAsset } from '../../virtual-assets/models/virtual-asset.model';

export interface UserAssetInteraction {
  assetId: string;
  assetName: string;
  iconUrl?: string;
  section: string;
  totalInteractions: number;
  viewCount: number;
  clickCount: number;
  lastInteraction: string;
  status: 'interacted' | 'missing';
}

@Component({
  selector: 'app-user-interaction-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    MatSortModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatBadgeModule
  ],
  templateUrl: './user-interaction-stats.component.html',
  styleUrls: ['./user-interaction-stats.component.scss']
})
export class UserInteractionStatsComponent implements OnInit {
  // Search
  userSearch = '';
  matchingUsers: User[] = [];
  selectedUser: User | null = null;

  // Data
  allAssets: VirtualAsset[] = [];
  userAssetInteractions: UserAssetInteraction[] = [];
  filteredInteractions: UserAssetInteraction[] = [];
  displayedColumns = ['rank', 'asset', 'section', 'totalInteractions', 'viewCount', 'clickCount', 'lastInteraction', 'status'];

  // Sort
  currentSort: Sort = { active: 'totalInteractions', direction: 'desc' };

  // Filters
  statusFilter: 'all' | 'interacted' | 'missing' = 'all';
  assetSearchQuery = '';

  // Summary
  totalInteractions = 0;
  uniqueAssetsInteracted = 0;
  missingAssetsCount = 0;
  completionPercentage = 0;
  mostInteractedAsset = '';
  leastInteractedAsset = '';

  isLoading = false;
  private readonly isBrowser: boolean;

  constructor(
    private analyticsService: AnalyticsService,
    private metricsService: DashboardMetricsService,
    private userService: UserService,
    public apiRoutes: ApiRoutesService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.loadAllAssets();
  }

  loadAllAssets(): void {
    this.metricsService.loadVirtualAssets().subscribe(assets => {
      this.allAssets = assets;
      this.cdr.markForCheck();
    });
  }

  searchUsers(): void {
    const term = this.userSearch.trim().toLowerCase();
    if (!term) return;
    this.userService.getAllUsers().subscribe(users => {
      this.matchingUsers = users.filter(u =>
        (u.name || '').toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
      );
      this.cdr.markForCheck();
    });
  }

  selectUser(user: User): void {
    this.selectedUser = user;
    this.matchingUsers = [];
    this.loadUserInteractions();
  }

  clearUser(): void {
    this.selectedUser = null;
    this.userAssetInteractions = [];
    this.filteredInteractions = [];
    this.resetSummary();
  }

  private loadUserInteractions(): void {
    if (!this.selectedUser) return;
    this.isLoading = true;

    // Get all interactions and filter by user
    this.analyticsService.getAllUserInteractions().pipe(
      map((interactions: any[]) => {
        // Filter interactions for this user
        const userInteractions = interactions.filter(
          (i: any) => i.user_id === this.selectedUser!.id
        );
        return userInteractions;
      }),
      catchError(() => of([]))
    ).subscribe((userInteractions: any[]) => {
      this.buildInteractionTable(userInteractions);
      this.isLoading = false;
      this.cdr.markForCheck();
    });
  }

  private buildInteractionTable(userInteractions: any[]): void {
    // Group interactions by virtual asset (cerm field)
    const assetMap = new Map<string, { views: number; clicks: number; lastDate: string }>();

    for (const interaction of userInteractions) {
      const assetId = interaction.cerm || interaction.virtual_asset_id || '';
      if (!assetId) continue;

      const existing = assetMap.get(assetId) || { views: 0, clicks: 0, lastDate: '' };
      const type = interaction.interactionType || interaction.interaction_type;
      if (type === 1 || type === 'view') {
        existing.views++;
      } else if (type === 2 || type === 'click' || type === 'scan') {
        existing.clicks++;
      } else {
        existing.views++;
      }

      const date = interaction.created_at || interaction.createdAt || '';
      if (date > existing.lastDate) {
        existing.lastDate = date;
      }

      assetMap.set(assetId, existing);
    }

    // Build rows: interacted and missing assets
    const rows: UserAssetInteraction[] = [];

    for (const asset of this.allAssets) {
      const data = assetMap.get(asset.id);
      if (data) {
        rows.push({
          assetId: asset.id,
          assetName: asset.name,
          iconUrl: (asset as any).icon_url || (asset as any).thumbnail_url,
          section: (asset as any).location_section || (asset as any).section || 'Sin clasificar',
          totalInteractions: data.views + data.clicks,
          viewCount: data.views,
          clickCount: data.clicks,
          lastInteraction: data.lastDate ? this.formatDate(data.lastDate) : '-',
          status: 'interacted'
        });
      } else {
        rows.push({
          assetId: asset.id,
          assetName: asset.name,
          iconUrl: (asset as any).icon_url || (asset as any).thumbnail_url,
          section: (asset as any).location_section || (asset as any).section || 'Sin clasificar',
          totalInteractions: 0,
          viewCount: 0,
          clickCount: 0,
          lastInteraction: '-',
          status: 'missing'
        });
      }
    }

    // Sort by total interactions desc
    rows.sort((a, b) => b.totalInteractions - a.totalInteractions);
    this.userAssetInteractions = rows;
    this.applyFilters();
    this.computeSummary();
  }

  private computeSummary(): void {
    const interacted = this.userAssetInteractions.filter(r => r.status === 'interacted');
    const missing = this.userAssetInteractions.filter(r => r.status === 'missing');

    this.totalInteractions = interacted.reduce((sum, r) => sum + r.totalInteractions, 0);
    this.uniqueAssetsInteracted = interacted.length;
    this.missingAssetsCount = missing.length;
    this.completionPercentage = this.allAssets.length > 0
      ? Math.round((interacted.length / this.allAssets.length) * 100)
      : 0;

    if (interacted.length > 0) {
      this.mostInteractedAsset = interacted[0].assetName;
      const least = [...interacted].sort((a, b) => a.totalInteractions - b.totalInteractions);
      this.leastInteractedAsset = least[0].assetName;
    } else {
      this.mostInteractedAsset = '-';
      this.leastInteractedAsset = '-';
    }
  }

  private resetSummary(): void {
    this.totalInteractions = 0;
    this.uniqueAssetsInteracted = 0;
    this.missingAssetsCount = 0;
    this.completionPercentage = 0;
    this.mostInteractedAsset = '';
    this.leastInteractedAsset = '';
  }

  // Filters
  onStatusFilterChange(status: 'all' | 'interacted' | 'missing'): void {
    this.statusFilter = status;
    this.applyFilters();
  }

  onAssetSearch(event: Event): void {
    this.assetSearchQuery = (event.target as HTMLInputElement).value;
    this.applyFilters();
  }

  applyFilters(): void {
    let result = [...this.userAssetInteractions];
    if (this.statusFilter !== 'all') {
      result = result.filter(r => r.status === this.statusFilter);
    }
    if (this.assetSearchQuery.trim()) {
      const q = this.assetSearchQuery.toLowerCase();
      result = result.filter(r => r.assetName.toLowerCase().includes(q));
    }
    this.sortData(this.currentSort, result);
  }

  onSortChange(sort: Sort): void {
    this.currentSort = sort;
    this.applyFilters();
  }

  private sortData(sort: Sort, data: UserAssetInteraction[]): void {
    if (!sort.active || !sort.direction) {
      this.filteredInteractions = data;
      return;
    }
    this.filteredInteractions = data.sort((a: any, b: any) => {
      const isAsc = sort.direction === 'asc';
      const valA = a[sort.active];
      const valB = b[sort.active];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * (isAsc ? 1 : -1);
      }
      return String(valA).localeCompare(String(valB)) * (isAsc ? 1 : -1);
    });
  }

  navigateToAsset(assetId: string): void {
    this.router.navigate(['/virtual-assets'], { queryParams: { filterId: assetId } });
  }

  private formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  downloadData(): void {
    const rows = this.filteredInteractions;
    if (!rows.length) return;
    const bom = '\ufeff';
    const csv = bom + [
      'Animal;Sección;Total Interacciones;Vistas;Clics;Última Interacción;Estado',
      ...rows.map(r =>
        `${r.assetName};${r.section};${r.totalInteractions};${r.viewCount};${r.clickCount};${r.lastInteraction};${r.status === 'interacted' ? 'Interactuado' : 'Sin interacción'}`
      )
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interacciones_usuario_${this.selectedUser?.name || 'todos'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  trackById(_i: number, item: UserAssetInteraction): string {
    return item.assetId;
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
