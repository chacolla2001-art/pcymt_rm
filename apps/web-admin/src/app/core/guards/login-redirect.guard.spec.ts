import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { LoginRedirectGuard } from './login-redirect.guard';

describe('LoginRedirectGuard', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['isUserAuthenticated']);
    routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);
    routerSpy.createUrlTree.and.returnValue({} as UrlTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });
  });

  it('should redirect to /main when already authenticated', () => {
    authServiceSpy.isUserAuthenticated.and.returnValue(true);

    const result = TestBed.runInInjectionContext(() => LoginRedirectGuard({} as any, {} as any));
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/main']);
    expect(result).toEqual(jasmine.any(Object)); // UrlTree
  });

  it('should allow access when not authenticated', () => {
    authServiceSpy.isUserAuthenticated.and.returnValue(false);

    const result = TestBed.runInInjectionContext(() => LoginRedirectGuard({} as any, {} as any));
    expect(result).toBeTrue();
  });
});
