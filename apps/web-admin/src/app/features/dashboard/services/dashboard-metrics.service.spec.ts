import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DashboardMetricsService } from './dashboard-metrics.service';
import { AnalyticsService } from './analytics.service';
import { VirtualAssetService } from '../../virtual-assets/services/virtual-asset.service';
import { UserSessionService } from './user-session.service';

describe('DashboardMetricsService', () => {
  let service: DashboardMetricsService;
  let analyticsSpy: jasmine.SpyObj<AnalyticsService>;
  let virtualAssetSpy: jasmine.SpyObj<VirtualAssetService>;
  let sessionSpy: jasmine.SpyObj<UserSessionService>;

  beforeEach(() => {
    analyticsSpy = jasmine.createSpyObj('AnalyticsService', [
      'getUsersByRole', 'getActiveUsersCount', 'getUsersStatus', 'getTotalCounts',
      'getTopVirtualAssets', 'getTopUsers', 'getInteractionsBySection',
      'getTimeSeriesInteractionsByVirtualAsset', 'getTimeSeriesBySection'
    ]);
    virtualAssetSpy = jasmine.createSpyObj('VirtualAssetService', ['getAllVirtualAssets']);
    sessionSpy = jasmine.createSpyObj('UserSessionService', ['getSessionTimeSeries']);

    analyticsSpy.getUsersByRole.and.returnValue(of([{ role: 'admin', count: 2 }]));
    analyticsSpy.getActiveUsersCount.and.returnValue(of({ activeUsers: 10 }));
    analyticsSpy.getUsersStatus.and.returnValue(of({ active: 8, inactive: 2 }));
    analyticsSpy.getTotalCounts.and.returnValue(of({ users: 10, virtualAssets: 5, interactions: 100, locations: 3 }));
    analyticsSpy.getTopVirtualAssets.and.returnValue(of([]));
    analyticsSpy.getTopUsers.and.returnValue(of([]));
    analyticsSpy.getInteractionsBySection.and.returnValue(of([]));
    analyticsSpy.getTimeSeriesInteractionsByVirtualAsset.and.returnValue(of([]));
    virtualAssetSpy.getAllVirtualAssets.and.returnValue(of([]));
    sessionSpy.getSessionTimeSeries.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        DashboardMetricsService,
        { provide: AnalyticsService, useValue: analyticsSpy },
        { provide: VirtualAssetService, useValue: virtualAssetSpy },
        { provide: UserSessionService, useValue: sessionSpy }
      ]
    });
    service = TestBed.inject(DashboardMetricsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('loadAllMetrics()', () => {
    it('should aggregate multiple analytics calls', () => {
      service.loadAllMetrics().subscribe(result => {
        expect(result.usersByRole).toEqual([{ role: 'admin', count: 2 }]);
        expect(result.activeUsersCount).toBe(10);
        expect(result.userStatus).toEqual({ active: 8, inactive: 2 });
        expect(result.totalCounts.users).toBe(10);
      });

      expect(analyticsSpy.getUsersByRole).toHaveBeenCalled();
      expect(analyticsSpy.getActiveUsersCount).toHaveBeenCalled();
      expect(analyticsSpy.getUsersStatus).toHaveBeenCalled();
      expect(analyticsSpy.getTotalCounts).toHaveBeenCalled();
    });

    it('should return fallback values on error', () => {
      analyticsSpy.getUsersByRole.and.returnValue(throwError(() => new Error('fail')));

      service.loadAllMetrics().subscribe(result => {
        expect(result.usersByRole).toEqual([]);
        expect(result.activeUsersCount).toBe(0);
      });
    });
  });

  describe('loadRankings()', () => {
    it('should call top endpoints', () => {
      service.loadRankings().subscribe(result => {
        expect(result.topVirtualAssets).toEqual([]);
        expect(result.topUsers).toEqual([]);
        expect(result.interactionsBySection).toEqual([]);
      });

      expect(analyticsSpy.getTopVirtualAssets).toHaveBeenCalledWith(5);
      expect(analyticsSpy.getTopUsers).toHaveBeenCalledWith(5);
      expect(analyticsSpy.getInteractionsBySection).toHaveBeenCalled();
    });

    it('should handle errors gracefully', () => {
      analyticsSpy.getTopVirtualAssets.and.returnValue(throwError(() => new Error('fail')));
      analyticsSpy.getTopUsers.and.returnValue(throwError(() => new Error('fail')));
      analyticsSpy.getInteractionsBySection.and.returnValue(throwError(() => new Error('fail')));

      service.loadRankings().subscribe(result => {
        expect(result.topVirtualAssets).toEqual([]);
        expect(result.topUsers).toEqual([]);
        expect(result.interactionsBySection).toEqual([]);
      });
    });
  });

  describe('buildRoleChartData()', () => {
    it('should build pie chart data from role counts', () => {
      const data = [{ role: 'admin', count: 5 }, { role: 'user', count: 15 }];
      const chart = service.buildRoleChartData(data);
      expect(chart.labels).toEqual(['admin', 'user']);
      expect(chart.datasets[0].data).toEqual([5, 15]);
    });
  });

  describe('buildUserStatusChartData()', () => {
    it('should build doughnut chart data', () => {
      const chart = service.buildUserStatusChartData(8, 2);
      expect(chart.labels).toEqual(['Activos', 'Inactivos']);
      expect(chart.datasets[0].data).toEqual([8, 2]);
    });
  });

  describe('buildSectionChartData()', () => {
    it('should build pie chart with section colors', () => {
      const data = [
        { section: 'Tierras Altas', interactionCount: 50 },
        { section: 'Tierras Medias', interactionCount: 30 }
      ];
      const chart = service.buildSectionChartData(data);
      expect(chart.labels).toEqual(['Tierras Altas', 'Tierras Medias']);
      expect(chart.datasets[0].data).toEqual([50, 30]);
      expect((chart.datasets[0] as any).backgroundColor.length).toBe(2);
    });
  });

  describe('generateTimeLabels()', () => {
    it('should generate daily labels for a month', () => {
      const labels = service.generateTimeLabels('day', 0);
      expect(labels.length).toBeGreaterThan(27);
      expect(labels.length).toBeLessThan(32);
      expect(labels[0]).toMatch(/^\d{4}-\d{2}-01$/);
    });

    it('should generate 12 monthly labels for a year', () => {
      const labels = service.generateTimeLabels('month', 0);
      expect(labels.length).toBe(12);
      expect(labels[0]).toMatch(/^\d{4}-01$/);
      expect(labels[11]).toMatch(/^\d{4}-12$/);
    });

    it('should generate 5 yearly labels', () => {
      const labels = service.generateTimeLabels('year', 0);
      expect(labels.length).toBe(5);
    });

    it('should apply offset for day range', () => {
      const currentLabels = service.generateTimeLabels('day', 0);
      const prevLabels = service.generateTimeLabels('day', -1);
      expect(currentLabels[0]).not.toBe(prevLabels[0]);
    });
  });

  describe('getPeriodLabel()', () => {
    it('should return Spanish month name for day range', () => {
      const label = service.getPeriodLabel('day', 0);
      expect(label).toMatch(/\w+ \d{4}/); // e.g. "Febrero 2026"
    });

    it('should return year for month range', () => {
      const label = service.getPeriodLabel('month', 0);
      expect(label).toMatch(/^\d{4}$/);
    });

    it('should return year range for year range', () => {
      const label = service.getPeriodLabel('year', 0);
      expect(label).toMatch(/^\d{4} – \d{4}$/);
    });
  });

  describe('loadVirtualAssets()', () => {
    it('should cache results after first call', () => {
      virtualAssetSpy.getAllVirtualAssets.and.returnValue(of([
        { id: '1', name: 'A', is_active: true } as any,
        { id: '2', name: 'B', is_active: false } as any
      ]));

      service.loadVirtualAssets().subscribe(assets => {
        expect(assets.length).toBe(1); // Only active
      });

      service.loadVirtualAssets().subscribe();
      expect(virtualAssetSpy.getAllVirtualAssets).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache', () => {
      virtualAssetSpy.getAllVirtualAssets.and.returnValue(of([]));

      service.loadVirtualAssets().subscribe();
      service.invalidateVirtualAssetsCache();
      service.loadVirtualAssets().subscribe();

      expect(virtualAssetSpy.getAllVirtualAssets).toHaveBeenCalledTimes(2);
    });
  });
});
