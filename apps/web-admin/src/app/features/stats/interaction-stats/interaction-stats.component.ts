import { Component, OnInit, Inject, PLATFORM_ID, ViewChild, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ChartData } from 'chart.js';
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
import { ApiRoutesService } from '../../../core/services/api-routes.service';
import { VirtualAsset } from '../../virtual-assets/models/virtual-asset.model';
import { TopVirtualAsset } from '../../dashboard/models/dashboard-metrics.model';

@Component({
  selector: 'app-interaction-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  templateUrl: './interaction-stats.component.html',
  styleUrls: ['./interaction-stats.component.scss']
})
export class InteractionStatsComponent implements OnInit {
  showAssetFilters = true;

  // — Gráfico de interacciones por modelo (bar) —
  interactionChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ data: [], label: 'Interacciones' }]
  };
  selectedTimeRange: 'day' | 'month' | 'year' = 'day';
  interactionPeriodOffset = 0;
  interactionPeriodLabel = '';
  selectedInteractionType: 'all' | 'view' | 'click' = 'all';

  // — Ranking de animales (integrado de top-animals) —
  topVirtualAssets: TopVirtualAsset[] = [];
  rankingBarChartData: ChartData<'bar'> = { labels: [], datasets: [{ data: [], label: 'Interacciones' }] };
  maxRankingCount = 0;

  // — Modelos 3D disponibles —
  virtualAssets: VirtualAsset[] = [];
  filteredAssets: VirtualAsset[] = [];
  selectedAsset: VirtualAsset | null = null;

  @ViewChild('interactionChart') interactionChart?: BaseChartDirective;

  private readonly isBrowser: boolean;

  constructor(
    private metricsService: DashboardMetricsService,
    private router: Router,
    public apiRoutes: ApiRoutesService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.loadVirtualAssets();
    this.updateInteractionPeriodLabel();
    this.loadRankings();
  }

  // — Ranking methods (from top-animals) —
  loadRankings(): void {
    this.metricsService.loadRankings().subscribe(rankings => {
      this.topVirtualAssets = rankings.topVirtualAssets;
      this.maxRankingCount = Math.max(...this.topVirtualAssets.map(a => a.interactionCount), 1);
      this.rankingBarChartData = {
        labels: this.topVirtualAssets.map(a => a.name),
        datasets: [{
          data: this.topVirtualAssets.map(a => a.interactionCount),
          label: 'Interacciones',
          backgroundColor: [
            'rgba(255, 193, 7, 0.85)',
            'rgba(76, 175, 80, 0.85)',
            'rgba(33, 150, 243, 0.85)',
            'rgba(156, 39, 176, 0.85)',
            'rgba(255, 87, 34, 0.85)'
          ]
        }]
      };
      this.cdr.markForCheck();
    });
  }

  getRankingProgress(count: number): number {
    return (count / this.maxRankingCount) * 100;
  }

  navigateToAsset(assetId: string): void {
    this.router.navigate(['/virtual-assets'], { queryParams: { filterId: assetId } });
  }

  loadVirtualAssets(): void {
    this.metricsService.loadVirtualAssets().subscribe(assets => {
      this.virtualAssets = assets;
      this.filteredAssets = [...this.virtualAssets];
      this.updateInteractionChartForAll(this.selectedTimeRange);
      this.cdr.markForCheck();
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

  clearAsset(): void {
    this.selectedAsset = null;
    this.updateInteractionChartForAll(this.selectedTimeRange);
  }

  private updateInteractionChartForAll(range: 'day' | 'month' | 'year'): void {
    this.metricsService.buildInteractionChartForAllAssets(this.filteredAssets, range, this.interactionPeriodOffset)
      .subscribe(chartData => {
        this.interactionChartData = { ...chartData };
        this.cdr.detectChanges();
        this.interactionChart?.chart?.update();
      });
  }

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

  navigateInteractionPeriod(direction: number): void {
    this.interactionPeriodOffset += direction;
    this.updateInteractionPeriodLabel();
    if (this.selectedAsset) {
      this.loadInteractionChartForSelectedAsset();
    } else {
      this.updateInteractionChartForAll(this.selectedTimeRange);
    }
  }

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

  trackById(_i: number, item: { id: string }): string {
    return item.id;
  }

  // — Download CSV —
  downloadInteractionData(): void {
    const data = this.interactionChartData;
    if (!data.labels?.length) return;
    const bom = '\ufeff';
    let csv: string;
    if (this.selectedAsset && data.datasets.length >= 2) {
      csv = bom + [
        'Fecha;Vistos;Clics',
        ...data.labels.map((label, i) =>
          `${label};${data.datasets[0]?.data[i] ?? 0};${data.datasets[1]?.data[i] ?? 0}`
        )
      ].join('\n');
    } else {
      csv = bom + [
        'Animal;Interacciones',
        ...data.labels.map((label, i) => `${label};${data.datasets[0]?.data[i] ?? 0}`)
      ].join('\n');
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interacciones_${this.selectedAsset?.name.replace(/\s/g, '_') ?? 'todos'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
