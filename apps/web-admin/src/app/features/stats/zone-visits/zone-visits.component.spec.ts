/**
 * Unit tests for ZoneVisitsComponent
 *
 * Verifies:
 *  1. Clicking a zone button updates selectedZone and refreshes the bar chart.
 *  2. loadZoneBarChart() uses getTimeSeriesBySection() (NOT the old VA-based API).
 *  3. Clearing the zone switches back to multi-zone (all-sections) mode.
 *  4. Time-range changes trigger a chart reload.
 *  5. Period navigation (prev/next) increments offset and reloads chart.
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import {
  Chart,
  BarController, BarElement, CategoryScale, LinearScale,
  ArcElement, PieController,
  Tooltip, Legend
} from 'chart.js';

// Register Chart.js controllers/elements required by the component template
Chart.register(BarController, BarElement, CategoryScale, LinearScale, ArcElement, PieController, Tooltip, Legend);

import { ZoneVisitsComponent } from './zone-visits.component';
import { DashboardMetricsService } from '../../dashboard/services/dashboard-metrics.service';
import { AnalyticsService } from '../../dashboard/services/analytics.service';
import { InteractionsBySection } from '../../dashboard/models/dashboard-metrics.model';

// ─── Minimal stubs ───────────────────────────────────────────────────────────

const MOCK_SECTIONS: InteractionsBySection[] = [
  { section: 'Tierras Altas',    interactionCount: 10 },
  { section: 'Tierras Medias',   interactionCount: 25 },
  { section: 'Tierras Bajas',    interactionCount: 40 },
  { section: 'Mitos y Leyendas', interactionCount: 15 },
];

const MOCK_LABELS_DAY = ['2026-02-01', '2026-02-02', '2026-02-03'];

/** Builds a fake time-series row array for a specific section */
function makeRows(section: string): { date: string; count: number }[] {
  return MOCK_LABELS_DAY.map((date, i) => ({ date, count: (i + 1) * 5 }));
}

/** All-sections multi-zone rows */
const MOCK_ALL_ROWS = [
  ...makeRows('Tierras Altas').map(r => ({ ...r, section: 'Tierras Altas' })),
  ...makeRows('Tierras Medias').map(r => ({ ...r, section: 'Tierras Medias' })),
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildMetricsSpy() {
  const spy = jasmine.createSpyObj('DashboardMetricsService', [
    'loadRankings',
    'buildSectionChartData',
    'generateTimeLabels',
    'getPeriodLabel',
  ]);
  spy.loadRankings.and.returnValue(
    of({ interactionsBySection: MOCK_SECTIONS, topVirtualAssets: [], topUsers: [], usersByRole: [], usersStatus: { active: 0, inactive: 0 }, totalInteractions: 0, sessionTimeSeries: [], userActivities: [], userSessions: [] })
  );
  spy.buildSectionChartData.and.returnValue({ labels: [], datasets: [{ data: [] }] });
  spy.generateTimeLabels.and.returnValue(MOCK_LABELS_DAY);
  spy.getPeriodLabel.and.returnValue('Febrero 2026');
  return spy;
}

function buildAnalyticsSpy() {
  const spy = jasmine.createSpyObj('AnalyticsService', ['getTimeSeriesBySection']);
  spy.getTimeSeriesBySection.and.returnValue(of(makeRows('Tierras Bajas')));
  return spy;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ZoneVisitsComponent', () => {
  let fixture: ComponentFixture<ZoneVisitsComponent>;
  let component: ZoneVisitsComponent;
  let metricsSpy: jasmine.SpyObj<DashboardMetricsService>;
  let analyticsSpy: jasmine.SpyObj<AnalyticsService>;

  beforeEach(async () => {
    metricsSpy   = buildMetricsSpy();
    analyticsSpy = buildAnalyticsSpy();

    await TestBed.configureTestingModule({
      imports: [ZoneVisitsComponent, HttpClientTestingModule, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: DashboardMetricsService, useValue: metricsSpy },
        { provide: AnalyticsService,        useValue: analyticsSpy },
      ],
    }).compileComponents();

    fixture   = TestBed.createComponent(ZoneVisitsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Initialisation ──

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load sections on init from DashboardMetricsService', () => {
    expect(component.sections.length).toBe(4);
    expect(component.sections[0].section).toBe('Tierras Altas');
  });

  it('should call getTimeSeriesBySection on init (multi-zone, no section)', () => {
    // null → all sections
    expect(analyticsSpy.getTimeSeriesBySection).toHaveBeenCalledWith(
      null, 'day', 0
    );
  });

  // ── Zone click ──

  it('should set selectedZone when a zone button is clicked', () => {
    const zone = MOCK_SECTIONS[2]; // Tierras Bajas
    component.onZoneClicked(zone);
    expect(component.selectedZone).toBe(zone);
  });

  it('should call getTimeSeriesBySection with the selected section name after click', fakeAsync(() => {
    analyticsSpy.getTimeSeriesBySection.calls.reset();
    const zone = MOCK_SECTIONS[2]; // Tierras Bajas
    component.onZoneClicked(zone);
    tick();
    expect(analyticsSpy.getTimeSeriesBySection).toHaveBeenCalledWith(
      'Tierras Bajas', jasmine.any(String), jasmine.any(Number)
    );
  }));

  it('should update zoneBarChartData with section-specific counts after click', fakeAsync(() => {
    analyticsSpy.getTimeSeriesBySection.and.returnValue(of(makeRows('Tierras Bajas')));
    component.onZoneClicked(MOCK_SECTIONS[2]);
    tick(10); // let inner setTimeout run
    expect(component.zoneBarChartData.datasets.length).toBe(1);
    expect(component.zoneBarChartData.datasets[0].label).toBe('Tierras Bajas');
    // counts: [5, 10, 15]
    const counts = component.zoneBarChartData.datasets[0].data as number[];
    expect(counts).toEqual([5, 10, 15]);
  }));

  it('should use getTimeSeriesBySection (new API) — not the old VA-based path — when zone is clicked', fakeAsync(() => {
    analyticsSpy.getTimeSeriesBySection.calls.reset();
    component.onZoneClicked(MOCK_SECTIONS[0]);
    tick();
    // New API is called for the selected section
    expect(analyticsSpy.getTimeSeriesBySection).toHaveBeenCalledWith(
      'Tierras Altas', jasmine.any(String), jasmine.any(Number)
    );
    // And NOT called with null (multi-zone mode should not be active)
    const calls = analyticsSpy.getTimeSeriesBySection.calls.allArgs();
    expect(calls.every((args: any[]) => args[0] !== null)).toBeTrue();
  }));

  // ── Zone clear ──

  it('should clear selectedZone when clearZone is called', () => {
    component.selectedZone = MOCK_SECTIONS[1];
    component.clearZone();
    expect(component.selectedZone).toBeNull();
  });

  it('should call getTimeSeriesBySection with null (all sections) after clearing zone', fakeAsync(() => {
    component.selectedZone = MOCK_SECTIONS[1];
    analyticsSpy.getTimeSeriesBySection.calls.reset();
    analyticsSpy.getTimeSeriesBySection.and.returnValue(of(MOCK_ALL_ROWS));
    component.clearZone();
    tick();
    expect(analyticsSpy.getTimeSeriesBySection).toHaveBeenCalledWith(null, jasmine.any(String), jasmine.any(Number));
  }));

  it('should produce one dataset per zone when in multi-zone mode', fakeAsync(() => {
    component.selectedZone = null;
    analyticsSpy.getTimeSeriesBySection.and.returnValue(of(MOCK_ALL_ROWS));
    component.loadZoneBarChart();
    tick(10);
    // Expects one dataset per section in this.sections (4 sections)
    expect(component.zoneBarChartData.datasets.length).toBe(4);
  }));

  // ── Time-range changes ──

  it('should reset offset to 0 and reload chart on time-range change', fakeAsync(() => {
    component.zonePeriodOffset = -2;
    analyticsSpy.getTimeSeriesBySection.calls.reset();
    component.onTimeRangeChanged('month');
    tick();
    expect(component.selectedTimeRange).toBe('month');
    expect(component.zonePeriodOffset).toBe(0);
    expect(analyticsSpy.getTimeSeriesBySection).toHaveBeenCalled();
  }));

  it('should pass the correct range to getTimeSeriesBySection', fakeAsync(() => {
    analyticsSpy.getTimeSeriesBySection.calls.reset();
    component.onTimeRangeChanged('year');
    tick();
    expect(analyticsSpy.getTimeSeriesBySection).toHaveBeenCalledWith(
      null, 'year', 0
    );
  }));

  // ── Period navigation ──

  it('should decrement offset and reload chart on navigateZonePeriod(-1)', fakeAsync(() => {
    analyticsSpy.getTimeSeriesBySection.calls.reset();
    component.navigateZonePeriod(-1);
    tick();
    expect(component.zonePeriodOffset).toBe(-1);
    expect(analyticsSpy.getTimeSeriesBySection).toHaveBeenCalledWith(null, 'day', -1);
  }));

  it('should increment offset and reload chart on navigateZonePeriod(1)', fakeAsync(() => {
    analyticsSpy.getTimeSeriesBySection.calls.reset();
    component.navigateZonePeriod(1);
    tick();
    expect(component.zonePeriodOffset).toBe(1);
    expect(analyticsSpy.getTimeSeriesBySection).toHaveBeenCalledWith(null, 'day', 1);
  }));

  it('should reset offset to 0 on resetZonePeriod', fakeAsync(() => {
    component.zonePeriodOffset = -3;
    component.resetZonePeriod();
    tick();
    expect(component.zonePeriodOffset).toBe(0);
  }));

  // ── Chart data correctness ──

  it('should use label colours from sectionColors map', fakeAsync(() => {
    analyticsSpy.getTimeSeriesBySection.and.returnValue(of(makeRows('Tierras Bajas')));
    component.onZoneClicked(MOCK_SECTIONS[2]);
    tick(10);
    const bg = component.zoneBarChartData.datasets[0].backgroundColor as string;
    // Should contain the hex colour for Tierras Bajas (#42A5F5) plus opacity suffix
    expect(bg).toContain('#42A5F5');
  }));
});
