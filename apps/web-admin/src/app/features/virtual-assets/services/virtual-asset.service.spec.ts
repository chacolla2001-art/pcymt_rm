import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { VirtualAssetService } from './virtual-asset.service';
import { environment } from '../../../environments/environment';

describe('VirtualAssetService', () => {
  let service: VirtualAssetService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/api/virtual-assets`;

  const mockAssetDTO = {
    id: 'va-1', name: 'Jaguar', scientific_name: 'Panthera onca',
    description: 'Big cat', model_url: '/models/jaguar.glb',
    icon_url: '/icons/jaguar.png', is_active: true,
    created_at: '2026-01-15', updated_at: '2026-01-20'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VirtualAssetService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(VirtualAssetService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAllVirtualAssets()', () => {
    it('should GET all assets and map to VirtualAsset models', () => {
      service.getAllVirtualAssets().subscribe(assets => {
        expect(assets.length).toBe(1);
        expect(assets[0].name).toBe('Jaguar');
        expect(assets[0].scientific_name).toBe('Panthera onca');
        expect(assets[0].is_active).toBeTrue();
      });

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [mockAssetDTO], message: '' });
    });

    it('should filter by isActive', () => {
      service.getAllVirtualAssets(true).subscribe();

      const req = httpMock.expectOne(`${baseUrl}?is_active=true`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [], message: '' });
    });
  });

  describe('getVirtualAssetById()', () => {
    it('should GET asset by ID', () => {
      service.getVirtualAssetById('va-1').subscribe(asset => {
        expect(asset.id).toBe('va-1');
        expect(asset.name).toBe('Jaguar');
      });

      const req = httpMock.expectOne(`${baseUrl}/va-1`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: mockAssetDTO, message: '' });
    });
  });

  describe('createVirtualAsset()', () => {
    it('should POST new asset', () => {
      service.createVirtualAsset({ name: 'New' } as any).subscribe(asset => {
        expect(asset.name).toBe('Jaguar');
      });

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      req.flush({ success: true, data: mockAssetDTO, message: '' });
    });

    it('should accept FormData', () => {
      const formData = new FormData();
      formData.append('name', 'New');
      service.createVirtualAsset(formData).subscribe();

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      req.flush({ success: true, data: mockAssetDTO, message: '' });
    });
  });

  describe('updateVirtualAsset()', () => {
    it('should PUT update asset', () => {
      service.updateVirtualAsset('va-1', { name: 'Updated' } as any).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/va-1`);
      expect(req.request.method).toBe('PUT');
      req.flush({ success: true, data: mockAssetDTO, message: '' });
    });
  });

  describe('deleteVirtualAsset()', () => {
    it('should DELETE asset by ID', () => {
      service.deleteVirtualAsset('va-1').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/va-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('updateAnimationSequence()', () => {
    it('should PUT animation sequence', () => {
      const sequence = { name: 'walk', steps: [] };

      service.updateAnimationSequence('va-1', sequence as any).subscribe(asset => {
        expect(asset.name).toBe('Jaguar');
      });

      const req = httpMock.expectOne(`${baseUrl}/va-1/animation-sequence`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ animation_sequence: sequence });
      req.flush({ success: true, data: mockAssetDTO, message: '' });
    });
  });
});
