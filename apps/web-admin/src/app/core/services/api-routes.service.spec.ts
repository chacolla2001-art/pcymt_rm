import { TestBed } from '@angular/core/testing';
import { ApiRoutesService } from './api-routes.service';
import { AppConfigService } from './app-config.service';
import { environment } from '../../environments/environment';

describe('ApiRoutesService', () => {
  let service: ApiRoutesService;
  let appConfigSpy: jasmine.SpyObj<AppConfigService>;

  beforeEach(() => {
    appConfigSpy = jasmine.createSpyObj('AppConfigService', ['getStoragePublicBaseUrl']);
    appConfigSpy.getStoragePublicBaseUrl.and.returnValue(null);

    TestBed.configureTestingModule({
      providers: [
        { provide: AppConfigService, useValue: appConfigSpy },
      ],
    });
    service = TestBed.inject(ApiRoutesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set baseUrl from environment', () => {
    expect(service.baseUrl).toBe(environment.apiUrl);
  });

  it('should set apiPrefix to /api', () => {
    expect(service.apiPrefix).toBe('/api');
  });

  describe('endpoints', () => {
    const api = `${environment.apiUrl}/api`;

    describe('auth', () => {
      it('should build auth endpoints', () => {
        expect(service.endpoints.auth.login).toBe(`${api}/auth/login`);
        expect(service.endpoints.auth.register).toBe(`${api}/auth/register`);
        expect(service.endpoints.auth.logout).toBe(`${api}/auth/logout`);
        expect(service.endpoints.auth.google).toBe(`${api}/auth/google`);
        expect(service.endpoints.auth.me).toBe(`${api}/auth/me`);
        expect(service.endpoints.auth.refresh).toBe(`${api}/auth/refresh`);
      });
    });

    describe('users', () => {
      it('should build static user endpoints', () => {
        expect(service.endpoints.users.base).toBe(`${api}/users`);
        expect(service.endpoints.users.register).toBe(`${api}/users/register`);
        expect(service.endpoints.users.checkEmail).toBe(`${api}/users/check-email`);
        expect(service.endpoints.users.checkUsername).toBe(`${api}/users/check-username`);
      });

      it('should build dynamic user endpoints', () => {
        expect(service.endpoints.users.byId('123')).toBe(`${api}/users/123`);
        expect(service.endpoints.users.toggleActive('456')).toBe(`${api}/users/456/toggle-active`);
        expect(service.endpoints.users.profilePicture('789')).toBe(`${api}/users/789/profile-picture`);
      });
    });

    describe('virtualAssets', () => {
      it('should build virtual asset endpoints', () => {
        expect(service.endpoints.virtualAssets.base).toBe(`${api}/virtual-assets`);
        expect(service.endpoints.virtualAssets.byId('va1')).toBe(`${api}/virtual-assets/va1`);
        expect(service.endpoints.virtualAssets.active).toBe(`${api}/virtual-assets/active`);
        expect(service.endpoints.virtualAssets.animationSequence('va1')).toBe(`${api}/virtual-assets/va1/animation-sequence`);
      });
    });

    describe('anchorPoints', () => {
      it('should build anchor point endpoints', () => {
        expect(service.endpoints.anchorPoints.base).toBe(`${api}/anchor-points`);
        expect(service.endpoints.anchorPoints.byId('ap1')).toBe(`${api}/anchor-points/ap1`);
        expect(service.endpoints.anchorPoints.active).toBe(`${api}/anchor-points/active`);
      });
    });

    describe('analytics', () => {
      it('should build analytics endpoints', () => {
        expect(service.endpoints.analytics.usersByRole).toBe(`${api}/analytics/users-by-role`);
        expect(service.endpoints.analytics.activeUsersCount).toBe(`${api}/analytics/active-users`);
        expect(service.endpoints.analytics.totals).toBe(`${api}/analytics/totals`);
        expect(service.endpoints.analytics.topVirtualAssets).toBe(`${api}/analytics/top-virtual-assets`);
        expect(service.endpoints.analytics.topUsers).toBe(`${api}/analytics/top-users`);
        expect(service.endpoints.analytics.interactionsBySection).toBe(`${api}/analytics/interactions-by-section`);
        expect(service.endpoints.analytics.timeSeriesBySection).toBe(`${api}/analytics/time-series-by-section`);
      });
    });

    describe('userSessions', () => {
      it('should build session endpoints', () => {
        expect(service.endpoints.userSessions.base).toBe(`${api}/user-sessions`);
        expect(service.endpoints.userSessions.stats).toBe(`${api}/user-sessions/stats`);
        expect(service.endpoints.userSessions.start).toBe(`${api}/user-sessions/start`);
        expect(service.endpoints.userSessions.byId('s1')).toBe(`${api}/user-sessions/s1`);
        expect(service.endpoints.userSessions.byUserId('u1')).toBe(`${api}/user-sessions/user/u1`);
        expect(service.endpoints.userSessions.end('s1')).toBe(`${api}/user-sessions/s1/end`);
      });
    });

    describe('mapConfigurations', () => {
      it('should build map config endpoints', () => {
        expect(service.endpoints.mapConfigurations.base).toBe(`${api}/map-configurations`);
        expect(service.endpoints.mapConfigurations.mine).toBe(`${api}/map-configurations/mine`);
        expect(service.endpoints.mapConfigurations.public).toBe(`${api}/map-configurations/public`);
        expect(service.endpoints.mapConfigurations.global).toBe(`${api}/map-configurations/global`);
        expect(service.endpoints.mapConfigurations.byId('mc1')).toBe(`${api}/map-configurations/mc1`);
      });
    });
  });

  describe('getFullUrl()', () => {
    it('should build full URL with leading slash', () => {
      expect(service.getFullUrl('/users')).toBe(`${environment.apiUrl}/api/users`);
    });

    it('should add leading slash if missing', () => {
      expect(service.getFullUrl('users')).toBe(`${environment.apiUrl}/api/users`);
    });
  });

  describe('getAssetUrl()', () => {
    it('should return empty string for null/undefined', () => {
      expect(service.getAssetUrl(null)).toBe('');
      expect(service.getAssetUrl(undefined)).toBe('');
    });

    it('should return absolute URLs as-is', () => {
      expect(service.getAssetUrl('https://cdn.example.com/img.png')).toBe('https://cdn.example.com/img.png');
      expect(service.getAssetUrl('http://cdn.example.com/img.png')).toBe('http://cdn.example.com/img.png');
    });

    it('should normalize /uploads/ path to /api/files/', () => {
      const result = service.getAssetUrl('/uploads/images/photo.jpg');
      expect(result).toContain('/api/files/images/photo.jpg');
    });
  });

  describe('getModelUrl()', () => {
    it('should return empty string for null/undefined', () => {
      expect(service.getModelUrl(null)).toBe('');
      expect(service.getModelUrl(undefined)).toBe('');
    });

    it('should use Supabase public URL for .glb when storage is configured', () => {
      appConfigSpy.getStoragePublicBaseUrl.and.returnValue(
        'https://example.supabase.co/storage/v1/object/public/uploads'
      );

      const result = service.getModelUrl('/api/files/bear.glb');
      expect(result).toBe(
        'https://example.supabase.co/storage/v1/object/public/uploads/bear.glb'
      );
    });

    it('should fall back to getAssetUrl when storage is not configured', () => {
      const result = service.getModelUrl('/api/files/bear.glb');
      expect(result).toContain('/api/files/bear.glb');
    });
  });

  describe('isSameOrigin()', () => {
    it('should return true for same origin URL', () => {
      expect(service.isSameOrigin(`${environment.apiUrl}/some/path`)).toBeTrue();
    });

    it('should return false for different origin', () => {
      expect(service.isSameOrigin('https://different-domain.com/path')).toBeFalse();
    });

    it('should return false for invalid URL', () => {
      expect(service.isSameOrigin('not-a-url')).toBeFalse();
    });
  });
});
