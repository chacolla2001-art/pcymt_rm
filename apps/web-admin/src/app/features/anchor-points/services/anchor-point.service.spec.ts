import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AnchorPointService } from './anchor-point.service';
import { ApiRoutesService } from '@core/services/api-routes.service';

describe('AnchorPointService', () => {
  let service: AnchorPointService;
  let httpMock: HttpTestingController;
  let apiRoutes: ApiRoutesService;

  const mockAnchorDTO = {
    id: 'ap-1', name: 'Jaguar Spot', anchor_code: 'JAG-001',
    latitude: -16.5, longitude: -68.15, section: 'Tierras Altas', show_in_map: true,
    is_active: true, virtual_asset_id: 'va-1', created_at: '2026-01-15', updated_at: '2026-01-20'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AnchorPointService, ApiRoutesService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AnchorPointService);
    httpMock = TestBed.inject(HttpTestingController);
    apiRoutes = TestBed.inject(ApiRoutesService);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAllAnchorPoints()', () => {
    it('should GET all anchor points and map DTOs to models', () => {
      service.getAllAnchorPoints().subscribe(points => {
        expect(points.length).toBe(1);
        expect(points[0].name).toBe('Jaguar Spot');
        expect(points[0].anchorCode).toBe('JAG-001');
        expect(points[0].latitude).toBe(-16.5);
        expect(points[0].section).toBe('Tierras Altas');
        expect(points[0].virtualAssetId).toBe('va-1');
      });

      const req = httpMock.expectOne(apiRoutes.endpoints.anchorPoints.base);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [mockAnchorDTO], message: '', timestamp: '' });
    });

    it('should pass isActive filter in URL', () => {
      service.getAllAnchorPoints(true).subscribe();

      const req = httpMock.expectOne(req => req.url.includes('is_active=true'));
      req.flush({ success: true, data: [], message: '', timestamp: '' });
    });

    it('should convert string lat/lng to numbers', () => {
      const stringCoordDTO = { ...mockAnchorDTO, latitude: '-16.5' as any, longitude: '-68.15' as any };

      service.getAllAnchorPoints().subscribe(points => {
        expect(typeof points[0].latitude).toBe('number');
        expect(typeof points[0].longitude).toBe('number');
      });

      const req = httpMock.expectOne(apiRoutes.endpoints.anchorPoints.base);
      req.flush({ success: true, data: [stringCoordDTO], message: '', timestamp: '' });
    });
  });

  describe('getAnchorPointById()', () => {
    it('should GET an anchor point by ID', () => {
      service.getAnchorPointById('ap-1').subscribe(point => {
        expect(point.id).toBe('ap-1');
        expect(point.name).toBe('Jaguar Spot');
      });

      const req = httpMock.expectOne(apiRoutes.endpoints.anchorPoints.byId('ap-1'));
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: mockAnchorDTO, message: '', timestamp: '' });
    });
  });

  describe('createAnchorPoint()', () => {
    it('should POST a new anchor point', () => {
      const newPoint = { name: 'New Point', latitude: -16.0, longitude: -68.0 };

      service.createAnchorPoint(newPoint as any).subscribe(point => {
        expect(point.name).toBe('Jaguar Spot');
      });

      const req = httpMock.expectOne(apiRoutes.endpoints.anchorPoints.base);
      expect(req.request.method).toBe('POST');
      req.flush({ success: true, data: mockAnchorDTO, message: '', timestamp: '' });
    });
  });

  describe('updateAnchorPoint()', () => {
    it('should PUT to update an anchor point', () => {
      service.updateAnchorPoint('ap-1', { name: 'Updated' } as any).subscribe();

      const req = httpMock.expectOne(apiRoutes.endpoints.anchorPoints.byId('ap-1'));
      expect(req.request.method).toBe('PUT');
      req.flush({ success: true, data: mockAnchorDTO, message: '', timestamp: '' });
    });
  });

  describe('deleteAnchorPoint()', () => {
    it('should DELETE an anchor point', () => {
      service.deleteAnchorPoint('ap-1').subscribe();

      const req = httpMock.expectOne(apiRoutes.endpoints.anchorPoints.byId('ap-1'));
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getActiveAnchorPoints()', () => {
    it('should GET active anchor points', () => {
      service.getActiveAnchorPoints().subscribe(points => {
        expect(points.length).toBe(1);
      });

      const req = httpMock.expectOne(apiRoutes.endpoints.anchorPoints.active);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [mockAnchorDTO], message: '', timestamp: '' });
    });
  });
});
