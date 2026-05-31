import { Component, OnInit, Inject, PLATFORM_ID, ViewChild, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
import { AnalyticsService } from '../../dashboard/services/analytics.service';
import { InteractionsBySection } from '../../dashboard/models/dashboard-metrics.model';

@Component({
  selector: 'app-zone-visits',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
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
  templateUrl: './zone-visits.component.html',
  styleUrls: ['./zone-visits.component.scss']
})
export class ZoneVisitsComponent implements OnInit {
  sections: InteractionsBySection[] = [];
  doughnutChartData: ChartData<'pie'> = { labels: [], datasets: [{ data: [] }] };
  maxInteractionCount = 0;

  // — Zone bar chart with time series —
  selectedTimeRange: 'day' | 'month' | 'year' = 'day';
  zonePeriodOffset = 0;
  zonePeriodLabel = '';
  selectedZone: InteractionsBySection | null = null;
  zoneBarChartData: ChartData<'bar'> = { labels: [], datasets: [{ data: [], label: 'Interacciones' }] };

  @ViewChild('zoneBarChart', { read: BaseChartDirective }) zoneBarChart?: BaseChartDirective;

  /** Map from text label → numeric code (legacy). Also accepts numeric codes for backward compat. */
  private readonly sectionMap: Record<string, string> = {
    'Tierras Altas': 'Tierras Altas',
    'Tierras Medias': 'Tierras Medias',
    'Tierras Bajas': 'Tierras Bajas',
    'Mitos y Leyendas': 'Mitos y Leyendas',
    '1': 'Tierras Altas',
    '2': 'Tierras Medias',
    '3': 'Tierras Bajas',
    '4': 'Mitos y Leyendas'
  };

  readonly sectionColors: Record<string, string> = {
    'Tierras Altas': '#8D6E63',
    'Tierras Medias': '#66BB6A',
    'Tierras Bajas': '#42A5F5',
    'Mitos y Leyendas': '#AB47BC',
    'Sin clasificar': '#9E9E9E'
  };

  private readonly isBrowser: boolean;

  constructor(
    private metricsService: DashboardMetricsService,
    private analyticsService: AnalyticsService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.loadData();
    this.updateZonePeriodLabel();
    this.loadZoneBarChart();
  }

  loadData(): void {
    this.metricsService.loadRankings().subscribe(rankings => {
      this.sections = rankings.interactionsBySection;
      this.maxInteractionCount = Math.max(...this.sections.map(s => Number(s.interactionCount)), 1);
      this.doughnutChartData = this.metricsService.buildSectionChartData(this.sections);
      this.cdr.markForCheck();
    });
  }

  getProgress(count: number): number {
    return (Number(count) / this.maxInteractionCount) * 100;
  }

  getSectionColor(section: string): string {
    return this.sectionColors[section] || '#9E9E9E';
  }

  navigateToSection(sectionName: string): void {
    const code = this.sectionMap[sectionName];
    if (code) {
      this.router.navigate(['/anchor-points'], { queryParams: { section: code } });
    }
  }

  // — Zone bar chart methods —
  onTimeRangeChanged(value: 'day' | 'month' | 'year'): void {
    this.selectedTimeRange = value;
    this.zonePeriodOffset = 0;
    this.updateZonePeriodLabel();
    this.loadZoneBarChart();
  }

  navigateZonePeriod(direction: number): void {
    this.zonePeriodOffset += direction;
    this.updateZonePeriodLabel();
    this.loadZoneBarChart();
  }

  resetZonePeriod(): void {
    this.zonePeriodOffset = 0;
    this.updateZonePeriodLabel();
    this.loadZoneBarChart();
  }

  private updateZonePeriodLabel(): void {
    this.zonePeriodLabel = this.metricsService.getPeriodLabel(this.selectedTimeRange, this.zonePeriodOffset);
  }

  onZoneClicked(section: InteractionsBySection): void {
    this.selectedZone = section;
    this.loadZoneBarChart();
  }

  clearZone(): void {
    this.selectedZone = null;
    this.loadZoneBarChart();
  }

  loadZoneBarChart(): void {
    const labels = this.metricsService.generateTimeLabels(this.selectedTimeRange, this.zonePeriodOffset);

    const updateChart = (newLabels: string[], datasets: any[]) => {
      this.zoneBarChartData = { labels: newLabels, datasets };
      this.cdr.markForCheck();
      this.cdr.detectChanges();
      setTimeout(() => {
        const chart = this.zoneBarChart?.chart;
        if (chart) {
          chart.data.labels = newLabels;
          chart.data.datasets = datasets;
          chart.update();
        }
      }, 0);
    };

    if (this.selectedZone) {
      // Single zone: query the new endpoint directly by section name
      this.analyticsService
        .getTimeSeriesBySection(this.selectedZone.section, this.selectedTimeRange, this.zonePeriodOffset)
        .pipe(catchError(err => { console.error('Zone chart error', err); return of([]); }))
        .subscribe((rows: any[]) => {
          const counts = labels.map(label => {
            const row = rows.find((r: any) => r.date === label);
            return row ? Number(row.count) : 0;
          });
          const color = this.getSectionColor(this.selectedZone!.section) + 'D9';
          updateChart(labels, [{ data: counts, label: this.selectedZone!.section, backgroundColor: color }]);
        });
    } else {
      // Multi-zone: query all sections in one call then pivot
      const zoneSections = this.sections.length
        ? this.sections.map(s => s.section)
        : Object.keys(this.sectionColors).filter(s => s !== 'Sin clasificar');

      this.analyticsService
        .getTimeSeriesBySection(null, this.selectedTimeRange, this.zonePeriodOffset)
        .pipe(catchError(err => { console.error('Zone chart (all) error', err); return of([]); }))
        .subscribe((rows: any[]) => {
          const datasets = zoneSections.map(sectionName => {
            const counts = labels.map(label => {
              const row = rows.find((r: any) => r.date === label && r.section === sectionName);
              return row ? Number(row.count) : 0;
            });
            return {
              data: counts,
              label: sectionName,
              backgroundColor: this.getSectionColor(sectionName) + 'D9'
            };
          });
          updateChart(labels, datasets);
        });
    }
  }

  downloadZoneData(): void {
    const data = this.zoneBarChartData;
    if (!data.labels?.length) return;
    const bom = '\ufeff';
    const csv = bom + [
      'Zona/Fecha;Interacciones',
      ...data.labels.map((label, i) => `${label};${data.datasets[0]?.data[i] ?? 0}`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zonas_${this.selectedZone?.section?.replace(/\s/g, '_') ?? 'todas'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
