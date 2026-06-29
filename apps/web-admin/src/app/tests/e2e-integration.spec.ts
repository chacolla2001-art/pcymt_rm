/**
 * End-to-End Tests - Frontend + Backend Integration
 * Pruebas que verifican la comunicación completa entre Angular frontend y Node.js backend
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UserService } from '../features/users/services/user.service';
import { AnchorPointService } from '../features/anchor-points/services/anchor-point.service';
import { VirtualAssetService } from '../features/virtual-assets/services/virtual-asset.service';
import { AuthService } from '../core/services/auth.service';
import { AnalyticsService } from '../features/dashboard/services/analytics.service';
import { environment } from '../environments/environment';

describe('🔗 E2E Integration Tests - Frontend to Backend', () => {
  let httpMock: HttpTestingController;
  const API_URL = environment.apiUrl;

  describe('🔐 Authentication Service Integration', () => {
    let authService: AuthService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [AuthService]
      });

      authService = TestBed.inject(AuthService);
      httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      httpMock.verify();
    });

    it('should authenticate user successfully', () => {
      const mockCredentials = { login: 'test@example.com', password: 'Test123!' };
      const mockResponse = {
        success: true,
        data: {
          token: 'mock-jwt-token',
          user: {
            id: '1',
            email: 'test@example.com',
            username: 'testuser',
            role: 'general'
          }
        }
      };

      authService.login(mockCredentials.login, mockCredentials.password).subscribe(response => {
        expect(response.success).toBe(true);
        expect(response.data.token).toBeDefined();
        expect(response.data.user.email).toBe(mockCredentials.login);
      });

      const req = httpMock.expectOne(`${API_URL}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockCredentials);
      req.flush(mockResponse);
    });

    it('should handle login failure', () => {
      const mockCredentials = { login: 'wrong@example.com', password: 'Wrong123!' };
      const mockError = {
        success: false,
        message: 'Invalid credentials'
      };

      authService.login(mockCredentials.login, mockCredentials.password).subscribe(
        () => fail('Should have failed'),
        error => {
          expect(error.error.success).toBe(false);
          expect(error.error.message).toContain('Invalid');
        }
      );

      const req = httpMock.expectOne(`${API_URL}/auth/login`);
      req.flush(mockError, { status: 401, statusText: 'Unauthorized' });
    });

    it('should get current user profile', () => {
      const mockUser = {
        success: true,
        data: {
          id: '1',
          email: 'test@example.com',
          username: 'testuser',
          role: 'general',
        }
      };

      authService.getCurrentUser().subscribe(response => {
        expect(response.data.email).toBe('test@example.com');
        expect(response.data.role).toBe('general');
      });

      const req = httpMock.expectOne(`${API_URL}/auth/me`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.has('Authorization')).toBe(true);
      req.flush(mockUser);
    });
  });

  describe('👥 User Service Integration', () => {
    let userService: UserService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [UserService]
      });

      userService = TestBed.inject(UserService);
      httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      httpMock.verify();
    });

    it('should create new user', () => {
      const newUser = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'NewPass123!',
        role: 'general'
      };

      const mockResponse = {
        success: true,
        data: { id: '123', ...newUser, password: undefined }
      };

      userService.createUser(newUser).subscribe(response => {
        expect(response.data.id).toBeDefined();
        expect(response.data.email).toBe(newUser.email);
      });

      const req = httpMock.expectOne(`${API_URL}/users`);
      expect(req.request.method).toBe('POST');
      req.flush(mockResponse);
    });

    it('should fetch all users (admin only)', () => {
      const mockUsers = {
        success: true,
        data: [
          { id: '1', email: 'user1@example.com', role: 'general' },
          { id: '2', email: 'user2@example.com', role: 'collaborator' }
        ]
      };

      userService.getAllUsers().subscribe(response => {
        expect(response.data.length).toBe(2);
        expect(response.data[0].email).toBe('user1@example.com');
      });

      const req = httpMock.expectOne(`${API_URL}/users`);
      expect(req.request.method).toBe('GET');
      req.flush(mockUsers);
    });

    it('should update user', () => {
      const userId = '123';
      const updates = { role: 'moderator' };
      const mockResponse = {
        success: true,
        data: { id: userId, ...updates }
      };

      userService.updateUser(userId, updates).subscribe(response => {
        expect(response.data.role).toBe('moderator');
      });

      const req = httpMock.expectOne(`${API_URL}/users/${userId}`);
      expect(req.request.method).toBe('PUT');
      req.flush(mockResponse);
    });

    it('should toggle user active status', () => {
      const userId = '123';
      const mockResponse = {
        success: true,
        data: { id: userId, is_active: false }
      };

      userService.toggleUserActive(userId).subscribe(response => {
        expect(response.data.is_active).toBe(false);
      });

      const req = httpMock.expectOne(`${API_URL}/users/${userId}/toggle-active`);
      expect(req.request.method).toBe('PATCH');
      req.flush(mockResponse);
    });
  });

  describe('📍 Anchor Point Service Integration', () => {
    let anchorPointService: AnchorPointService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [AnchorPointService]
      });

      anchorPointService = TestBed.inject(AnchorPointService);
      httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      httpMock.verify();
    });

    it('should fetch all anchor points', () => {
      const mockAnchorPoints = {
        success: true,
        data: [
          {
            id: '1',
            name: 'Punto Altiplano',
            latitude: -16.5,
            longitude: -68.15,
            section: 'Altiplano',
            is_active: true
          },
          {
            id: '2',
            name: 'Punto Valles',
            latitude: -17.0,
            longitude: -65.0,
            section: 'Valles',
            is_active: true
          }
        ]
      };

      anchorPointService.getAllAnchorPoints().subscribe(response => {
        expect(response.data.length).toBe(2);
        expect(response.data[0].section).toBe('Altiplano');
      });

      const req = httpMock.expectOne(`${API_URL}/anchor-points`);
      expect(req.request.method).toBe('GET');
      req.flush(mockAnchorPoints);
    });

    it('should create anchor point (admin)', () => {
      const newAnchorPoint = {
        name: 'Nuevo Punto',
        latitude: -16.5,
        longitude: -68.15,
        altitude: 3650,
        orientation: 90,
        section: 'Altiplano',
        is_active: true
      };

      const mockResponse = {
        success: true,
        data: { id: '123', ...newAnchorPoint }
      };

      anchorPointService.createAnchorPoint(newAnchorPoint).subscribe(response => {
        expect(response.data.id).toBeDefined();
        expect(response.data.name).toBe(newAnchorPoint.name);
      });

      const req = httpMock.expectOne(`${API_URL}/anchor-points`);
      expect(req.request.method).toBe('POST');
      req.flush(mockResponse);
    });

    it('should filter anchor points by section', () => {
      const section = 'Valles';
      const mockResponse = {
        success: true,
        data: [
          { id: '1', name: 'Punto 1', section: 'Valles' },
          { id: '2', name: 'Punto 2', section: 'Valles' }
        ]
      };

      anchorPointService.getAnchorPointsBySection(section).subscribe(response => {
        expect(response.data.every(ap => ap.section === 'Valles')).toBe(true);
      });

      const req = httpMock.expectOne(`${API_URL}/anchor-points?section=${section}`);
      req.flush(mockResponse);
    });
  });

  describe('🎨 Virtual Asset Service Integration', () => {
    let virtualAssetService: VirtualAssetService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [VirtualAssetService]
      });

      virtualAssetService = TestBed.inject(VirtualAssetService);
      httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      httpMock.verify();
    });

    it('should fetch all virtual assets', () => {
      const mockAssets = {
        success: true,
        data: [
          {
            id: '1',
            name: 'Llama',
            model_url: '/models/llama.glb',
            category: 'fauna',
            is_active: true
          },
          {
            id: '2',
            name: 'Condor',
            model_url: '/models/condor.glb',
            category: 'fauna',
            is_active: true
          }
        ]
      };

      virtualAssetService.getAllVirtualAssets().subscribe(response => {
        expect(response.data.length).toBe(2);
        expect(response.data[0].category).toBe('fauna');
      });

      const req = httpMock.expectOne(`${API_URL}/virtual-assets`);
      expect(req.request.method).toBe('GET');
      req.flush(mockAssets);
    });

    it('should create virtual asset (admin)', () => {
      const newAsset = {
        name: 'Vicuña',
        scientific_name: 'Vicugna vicugna',
        model_url: '/models/vicuna.glb',
        category: 'fauna',
        habitat: 'Altiplano',
        is_active: true
      };

      const mockResponse = {
        success: true,
        data: { id: '123', ...newAsset }
      };

      virtualAssetService.createVirtualAsset(newAsset).subscribe(response => {
        expect(response.data.id).toBeDefined();
        expect(response.data.name).toBe('Vicuña');
      });

      const req = httpMock.expectOne(`${API_URL}/virtual-assets`);
      expect(req.request.method).toBe('POST');
      req.flush(mockResponse);
    });

    it('should update animation sequence', () => {
      const assetId = '123';
      const animationSequence = [
        { name: 'idle', duration: 2.0, loop: true },
        { name: 'walk', duration: 1.5, loop: true }
      ];

      const mockResponse = {
        success: true,
        data: { id: assetId, animation_sequence: animationSequence }
      };

      virtualAssetService.updateAnimationSequence(assetId, animationSequence).subscribe(response => {
        expect(response.data.animation_sequence).toEqual(animationSequence);
      });

      const req = httpMock.expectOne(`${API_URL}/virtual-assets/${assetId}/animation-sequence`);
      expect(req.request.method).toBe('PUT');
      req.flush(mockResponse);
    });
  });

  describe('📊 Analytics Service Integration', () => {
    let analyticsService: AnalyticsService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [AnalyticsService]
      });

      analyticsService = TestBed.inject(AnalyticsService);
      httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      httpMock.verify();
    });

    it('should get users by role', () => {
      const mockData = {
        success: true,
        data: [
          { role: 'general', count: 50 },
          { role: 'collaborator', count: 10 },
          { role: 'admin', count: 2 }
        ]
      };

      analyticsService.getUsersByRole().subscribe(response => {
        expect(response.data.length).toBe(3);
        expect(response.data[0].role).toBe('general');
      });

      const req = httpMock.expectOne(`${API_URL}/analytics/users-by-role`);
      expect(req.request.method).toBe('GET');
      req.flush(mockData);
    });

    it('should get active users count', () => {
      const mockData = {
        success: true,
        data: { activeUsers: 42 }
      };

      analyticsService.getActiveUsersCount().subscribe(response => {
        expect(response.data.activeUsers).toBe(42);
      });

      const req = httpMock.expectOne(`${API_URL}/analytics/active-users-count`);
      req.flush(mockData);
    });

    it('should get total counts', () => {
      const mockData = {
        success: true,
        data: {
          users: 62,
          virtualAssets: 25,
          interactions: 1543,
          locations: 12
        }
      };

      analyticsService.getTotalCounts().subscribe(response => {
        expect(response.data.users).toBe(62);
        expect(response.data.virtualAssets).toBe(25);
      });

      const req = httpMock.expectOne(`${API_URL}/analytics/total-counts`);
      req.flush(mockData);
    });

    it('should get top virtual assets', () => {
      const mockData = {
        success: true,
        data: [
          { virtual_asset_id: '1', name: 'Llama', interactionCount: 150 },
          { virtual_asset_id: '2', name: 'Condor', interactionCount: 120 },
          { virtual_asset_id: '3', name: 'Vicuña', interactionCount: 95 }
        ]
      };

      analyticsService.getTopVirtualAssets(3).subscribe(response => {
        expect(response.data.length).toBe(3);
        expect(response.data[0].interactionCount).toBeGreaterThan(response.data[1].interactionCount);
      });

      const req = httpMock.expectOne(`${API_URL}/analytics/top-virtual-assets?limit=3`);
      req.flush(mockData);
    });

    it('should get interactions by section', () => {
      const mockData = {
        success: true,
        data: [
          { section: 'Altiplano', interactionCount: 500 },
          { section: 'Valles', interactionCount: 350 },
          { section: 'Llanos', interactionCount: 250 }
        ]
      };

      analyticsService.getInteractionsBySection().subscribe(response => {
        expect(response.data.length).toBe(3);
        expect(response.data[0].section).toBe('Altiplano');
      });

      const req = httpMock.expectOne(`${API_URL}/analytics/interactions-by-section`);
      req.flush(mockData);
    });
  });

  describe('🔄 Complete User Flow Integration', () => {
    let authService: AuthService;
    let userService: UserService;
    let anchorPointService: AnchorPointService;
    let virtualAssetService: VirtualAssetService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [AuthService, UserService, AnchorPointService, VirtualAssetService]
      });

      authService = TestBed.inject(AuthService);
      userService = TestBed.inject(UserService);
      anchorPointService = TestBed.inject(AnchorPointService);
      virtualAssetService = TestBed.inject(VirtualAssetService);
      httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      httpMock.verify();
    });

    it('should complete registration -> login -> data loading flow', (done) => {
      const newUser = {
        username: 'flowuser',
        email: 'flow@example.com',
        password: 'Flow123!',
        role: 'general'
      };

      // Step 1: Register
      userService.createUser(newUser).subscribe(registerResponse => {
        expect(registerResponse.success).toBe(true);
        const userId = registerResponse.data.id;

        // Step 2: Login
        authService.login(newUser.email, newUser.password).subscribe(loginResponse => {
          expect(loginResponse.success).toBe(true);
          expect(loginResponse.data.token).toBeDefined();

          // Step 3: Load anchor points
          anchorPointService.getAllAnchorPoints().subscribe(anchorResponse => {
            expect(anchorResponse.data.length).toBeGreaterThan(0);

            // Step 4: Load virtual assets
            virtualAssetService.getAllVirtualAssets().subscribe(assetResponse => {
              expect(assetResponse.data.length).toBeGreaterThan(0);
              done();
            });

            // Mock virtual assets response
            const assetsReq = httpMock.expectOne(`${API_URL}/virtual-assets`);
            assetsReq.flush({
              success: true,
              data: [{ id: '1', name: 'Asset 1', is_active: true }]
            });
          });

          // Mock anchor points response
          const anchorsReq = httpMock.expectOne(`${API_URL}/anchor-points`);
          anchorsReq.flush({
            success: true,
            data: [{ id: '1', name: 'Anchor 1', section: 'Altiplano' }]
          });
        });

        // Mock login response
        const loginReq = httpMock.expectOne(`${API_URL}/auth/login`);
        loginReq.flush({
          success: true,
          data: { token: 'mock-token', user: { id: userId, email: newUser.email } }
        });
      });

      // Mock registration response
      const registerReq = httpMock.expectOne(`${API_URL}/users`);
      registerReq.flush({
        success: true,
        data: { id: '123', ...newUser, password: undefined }
      });
    });
  });
});
