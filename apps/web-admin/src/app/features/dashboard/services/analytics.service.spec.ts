import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AnalyticsService } from './analytics.service';
import { ApiRoutesService } from '@core/services/api-routes.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let httpMock: HttpTestingController;
  let apiRoutes: ApiRoutesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AnalyticsService, ApiRoutesService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AnalyticsService);
    httpMock = TestBed.inject(HttpTestingController);
    apiRoutes = TestBed.inject(ApiRoutesService);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getUsersByRole()', () => {
    it('should GET and map data', () => {
      service.getUsersByRole().subscribe(data => {
        expect(data).toEqual([{ role: 'admin', count: 5 }]);
      });

      const req = httpMock.expectOne(apiRoutes.endpoints.analytics.usersByRole);
      req.flush({ success: true, data: [{ role: 'admin', count: 5 }], message: '', timestamp: '' });
    });
  });

  describe('getActiveUsersCount()', () => {
    it('should GET active users count', () => {
      service.getActiveUsersCount().subscribe(data => {
        expect(data.activeUsers).toBe(42);
      });

      const req = httpMock.expectOne(apiRoutes.endpoints.analytics.activeUsersCount);
      req.flush({ success: true, data: { activeUsers: 42 }, message: '', timestamp: '' });
    });
  });

  describe('getTotalCounts()', () => {
    it('should GET totals', () => {
      const totals = { users: 100, virtualAssets: 50, interactions: 1000, locations: 25 };

      service.getTotalCounts().subscribe(data => {
        expect(data.users).toBe(100);
        expect(data.virtualAssets).toBe(50);
      });

      const req = httpMock.expectOne(apiRoutes.endpoints.analytics.totals);
      req.flush({ success: true, data: totals, message: '', timestamp: '' });
    });
  });

  describe('getTopVirtualAssets()', () => {
    it('should GET top assets with limit', () => {
      service.getTopVirtualAssets(3).subscribe(data => {
        expect(data.length).toBe(2);
      });

      const req = httpMock.expectOne(req => req.url.includes('top-virtual-assets') && req.url.includes('limit=3'));
      req.flush({ success: true, data: [{ id: '1', name: 'A', interactionCount: 10 }, { id: '2', name: 'B', interactionCount: 5 }], message: '', timestamp: '' });
    });

    it('should default limit to 5', () => {
      service.getTopVirtualAssets().subscribe();

      const req = httpMock.expectOne(req => req.url.includes('limit=5'));
      req.flush({ success: true, data: [], message: '', timestamp: '' });
    });
  });

  describe('getTopUsers()', () => {
    it('should GET top users with limit', () => {
      service.getTopUsers(10).subscribe(data => {
        expect(data).toBeTruthy();
      });

      const req = httpMock.expectOne(req => req.url.includes('top-users') && req.url.includes('limit=10'));
      req.flush({ success: true, data: [], message: '', timestamp: '' });
    });
  });

  describe('getInteractionsBySection()', () => {
    it('should GET interactions grouped by section', () => {
      const sections = [
        { section: 'Tierras Altas', interactionCount: 100 },
        { section: 'Tierras Bajas', interactionCount: 200 }
      ];

      service.getInteractionsBySection().subscribe(data => {
        expect(data.length).toBe(2);
        expect(data[0].section).toBe('Tierras Altas');
      });

      const req = httpMock.expectOne(apiRoutes.endpoints.analytics.interactionsBySection);
      req.flush({ success: true, data: sections, message: '', timestamp: '' });
    });
  });

  describe('getTimeSeriesBySection()', () => {
    it('should build query with section, range, and offset', () => {
      service.getTimeSeriesBySection('Tierras Altas', 'day', 0).subscribe();

      const req = httpMock.expectOne(req =>
        req.url.includes('time-series-by-section') &&
        req.url.includes('range=day') &&
        req.url.includes('offset=0') &&
        req.url.includes('section=Tierras%20Altas')
      );
      req.flush({ success: true, data: [], message: '', timestamp: '' });
    });

    it('should omit section param when null', () => {
      service.getTimeSeriesBySection(null, 'month', 0).subscribe();

      const req = httpMock.expectOne(req =>
        req.url.includes('range=month') && !req.url.includes('section=')
      );
      req.flush({ success: true, data: [], message: '', timestamp: '' });
    });
  });

  describe('getTimeSeriesInteractionsByVirtualAsset()', () => {
    it('should build query with asset ID, range, type, and offset', () => {
      service.getTimeSeriesInteractionsByVirtualAsset('va-1', 'day', 'view', -1).subscribe();

      const req = httpMock.expectOne(req =>
        req.url.includes('by-virtual-asset/va-1') &&
        req.url.includes('range=day') &&
        req.url.includes('type=view') &&
        req.url.includes('offset=-1')
      );
      req.flush({ success: true, data: [], message: '', timestamp: '' });
    });

    it('should omit optional params when not provided', () => {
      service.getTimeSeriesInteractionsByVirtualAsset('va-1', 'month').subscribe();

      const req = httpMock.expectOne(req =>
        req.url.includes('range=month') &&
        !req.url.includes('type=') &&
        !req.url.includes('offset=')
      );
      req.flush({ success: true, data: [], message: '', timestamp: '' });
    });
  });

  describe('CRUD for user interactions', () => {
    it('should GET all interactions', () => {
      service.getAllUserInteractions().subscribe();
      const req = httpMock.expectOne(apiRoutes.endpoints.userInteractions.base);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [], message: '', timestamp: '' });
    });

    it('should GET interaction by ID', () => {
      service.getUserInteractionById('int-1').subscribe();
      const req = httpMock.expectOne(apiRoutes.endpoints.userInteractions.byId('int-1'));
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: {}, message: '', timestamp: '' });
    });

    it('should POST create interaction', () => {
      service.createUserInteraction({ type: 'view' }).subscribe();
      const req = httpMock.expectOne(apiRoutes.endpoints.userInteractions.base);
      expect(req.request.method).toBe('POST');
      req.flush({ success: true, data: {}, message: '', timestamp: '' });
    });

    it('should PUT update interaction', () => {
      service.updateUserInteraction('int-1', { type: 'click' }).subscribe();
      const req = httpMock.expectOne(apiRoutes.endpoints.userInteractions.byId('int-1'));
      expect(req.request.method).toBe('PUT');
      req.flush({ success: true, data: {}, message: '', timestamp: '' });
    });

    it('should DELETE interaction', () => {
      service.deleteUserInteraction('int-1').subscribe();
      const req = httpMock.expectOne(apiRoutes.endpoints.userInteractions.byId('int-1'));
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true, data: {}, message: '', timestamp: '' });
    });
  });
});
