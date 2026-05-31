import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { UserService } from './user.service';
import { ApiRoutesService } from '@core/services/api-routes.service';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;
  let apiRoutes: ApiRoutesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UserService,
        ApiRoutesService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
    apiRoutes = TestBed.inject(ApiRoutesService);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAllUsers()', () => {
    it('should fetch all users', () => {
      const mockResponse = {
        success: true, message: 'OK', data: [
          { id: '1', username: 'admin', email: 'admin@test.com', role: 'admin', is_active: true },
          { id: '2', username: 'user1', email: 'user1@test.com', role: 'user', is_active: true }
        ], timestamp: new Date().toISOString()
      };

      service.getAllUsers().subscribe(users => {
        expect(users.length).toBe(2);
        expect(users[0].username).toBe('admin');
      });

      const req = httpMock.expectOne(apiRoutes.endpoints.users.base);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should pass isActive filter as query param', () => {
      service.getAllUsers(true).subscribe();

      const req = httpMock.expectOne(req => req.url === apiRoutes.endpoints.users.base && req.params.get('is_active') === 'true');
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [], message: '', timestamp: '' });
    });

    it('should not include isActive param when undefined', () => {
      service.getAllUsers().subscribe();

      const req = httpMock.expectOne(apiRoutes.endpoints.users.base);
      expect(req.request.params.has('is_active')).toBeFalse();
      req.flush({ success: true, data: [], message: '', timestamp: '' });
    });
  });

  describe('createUser()', () => {
    it('should POST to register endpoint with FormData', () => {
      const formData = new FormData();
      formData.append('username', 'newuser');
      formData.append('email', 'new@test.com');
      formData.append('password', 'P@ssw0rd123!');

      service.createUser(formData).subscribe(user => {
        expect(user).toBeTruthy();
      });

      const req = httpMock.expectOne(apiRoutes.endpoints.users.register);
      expect(req.request.method).toBe('POST');
      req.flush({ id: '3', username: 'newuser', email: 'new@test.com', role: 'user', is_active: true });
    });
  });

  describe('getUserById()', () => {
    it('should GET user by ID', () => {
      service.getUserById('123').subscribe(user => {
        expect(user).toBeTruthy();
      });

      const req = httpMock.expectOne(apiRoutes.endpoints.users.byId('123'));
      expect(req.request.method).toBe('GET');
      req.flush({ id: '123', username: 'testuser', email: 'test@test.com' });
    });
  });

  describe('updateUser()', () => {
    it('should PUT to user endpoint', () => {
      const formData = new FormData();
      formData.append('username', 'updated');

      service.updateUser('123', formData).subscribe();

      const req = httpMock.expectOne(apiRoutes.endpoints.users.byId('123'));
      expect(req.request.method).toBe('PUT');
      req.flush({ id: '123', username: 'updated' });
    });
  });

  describe('deleteUser()', () => {
    it('should DELETE user by ID', () => {
      service.deleteUser('123').subscribe();

      const req = httpMock.expectOne(apiRoutes.endpoints.users.byId('123'));
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('toggleUserActive()', () => {
    it('should PATCH toggle-active endpoint', () => {
      service.toggleUserActive('123', false).subscribe();

      const req = httpMock.expectOne(apiRoutes.endpoints.users.toggleActive('123'));
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ active: false });
      req.flush({ id: '123', is_active: false });
    });
  });

  describe('checkEmailExists()', () => {
    it('should POST to check-email endpoint', () => {
      service.checkEmailExists('test@test.com').subscribe(result => {
        expect(result.exists).toBeTrue();
      });

      const req = httpMock.expectOne(apiRoutes.endpoints.users.checkEmail);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'test@test.com' });
      req.flush({ exists: true });
    });
  });

  describe('checkUsernameExists()', () => {
    it('should POST to check-username endpoint', () => {
      service.checkUsernameExists('testuser').subscribe(result => {
        expect(result.exists).toBeFalse();
      });

      const req = httpMock.expectOne(apiRoutes.endpoints.users.checkUsername);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ username: 'testuser' });
      req.flush({ exists: false });
    });
  });

  describe('recoverPassword()', () => {
    it('should POST to recover-password endpoint', () => {
      service.recoverPassword('test@test.com').subscribe();

      const req = httpMock.expectOne(apiRoutes.endpoints.users.recoverPassword);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'test@test.com' });
      req.flush({ message: 'Email sent' });
    });
  });

  describe('changePassword()', () => {
    it('should POST to change-password endpoint', () => {
      service.changePassword('test@test.com', 'old123', 'new123').subscribe();

      const req = httpMock.expectOne(apiRoutes.endpoints.users.changePassword);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'test@test.com', currentPassword: 'old123', newPassword: 'new123' });
      req.flush({ message: 'Changed' });
    });
  });

  describe('updateProfilePicture()', () => {
    it('should PATCH profile picture with file FormData', () => {
      const file = new File([''], 'avatar.png', { type: 'image/png' });

      service.updateProfilePicture('123', file).subscribe(result => {
        expect(result.profile_picture_url).toBeTruthy();
      });

      const req = httpMock.expectOne(apiRoutes.endpoints.users.profilePicture('123'));
      expect(req.request.method).toBe('PATCH');
      req.flush({ success: true, data: { profile_picture_url: '/uploads/avatar.png' }, message: '' });
    });
  });
});
