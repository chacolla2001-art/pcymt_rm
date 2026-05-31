import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthFormComponent } from './auth-form.component';
import { AuthService } from '../../../core/services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';

describe('AuthFormComponent', () => {
  let fixture: ComponentFixture<AuthFormComponent>;
  let component: AuthFormComponent;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['login']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [AuthFormComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        LoggerService,
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AuthFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('form initialization', () => {
    it('should create login form with email, password, and rememberMe controls', () => {
      expect(component.loginForm).toBeTruthy();
      expect(component.loginForm.contains('email')).toBeTrue();
      expect(component.loginForm.contains('password')).toBeTrue();
      expect(component.loginForm.contains('rememberMe')).toBeTrue();
    });

    it('should have email required and email validator', () => {
      const email = component.loginForm.get('email')!;
      email.setValue('');
      expect(email.valid).toBeFalse();
      expect(email.errors?.['required']).toBeTrue();

      email.setValue('invalidformat');
      expect(email.errors?.['email']).toBeTrue();

      email.setValue('valid@test.com');
      expect(email.valid).toBeTrue();
    });

    it('should have password required', () => {
      const password = component.loginForm.get('password')!;
      password.setValue('');
      expect(password.valid).toBeFalse();
      expect(password.errors?.['required']).toBeTrue();

      password.setValue('any-password');
      expect(password.valid).toBeTrue();
    });

    it('should default rememberMe to false', () => {
      expect(component.loginForm.get('rememberMe')?.value).toBeFalse();
    });
  });

  describe('togglePasswordVisibility()', () => {
    it('should toggle password visibility', () => {
      expect(component.passwordVisible).toBeFalse();
      component.togglePasswordVisibility();
      expect(component.passwordVisible).toBeTrue();
      component.togglePasswordVisibility();
      expect(component.passwordVisible).toBeFalse();
    });
  });

  describe('onSubmit()', () => {
    it('should not call login when form is invalid', () => {
      component.onSubmit();
      expect(authServiceSpy.login).not.toHaveBeenCalled();
    });

    it('should call login and redirect on success', fakeAsync(() => {
      authServiceSpy.login.and.returnValue(of({
        success: true, message: 'OK',
        data: { token: 't', user: { id: '1', username: 'u', email: 'e@e.com', role: 'user', is_active: true } }
      } as any));

      component.loginForm.setValue({ email: 'test@test.com', password: 'pass123', rememberMe: false });
      component.onSubmit();
      tick();

      expect(authServiceSpy.login).toHaveBeenCalledWith({ email: 'test@test.com', password: 'pass123' });
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
      expect(component.isLoading).toBeFalse();
    }));

    it('should set loading state during login', fakeAsync(() => {
      authServiceSpy.login.and.returnValue(of({ success: true } as any));
      component.loginForm.setValue({ email: 'a@b.com', password: 'p', rememberMe: false });

      component.onSubmit();
      // isLoading is set before subscribe resolves
      tick();
      expect(component.isLoading).toBeFalse();
    }));

    it('should handle 401 error with appropriate message', fakeAsync(() => {
      authServiceSpy.login.and.returnValue(throwError(() =>
        new HttpErrorResponse({ status: 401, error: { message: 'Bad credentials' } })
      ));

      component.loginForm.setValue({ email: 'a@b.com', password: 'wrong', rememberMe: false });
      component.onSubmit();
      tick();

      expect(component.isLoading).toBeFalse();
      expect(component.loginError).toContain('Bad credentials');
    }));

    it('should handle 403 error', fakeAsync(() => {
      authServiceSpy.login.and.returnValue(throwError(() =>
        new HttpErrorResponse({ status: 403, error: { message: 'Account inactive' } })
      ));

      component.loginForm.setValue({ email: 'a@b.com', password: 'p', rememberMe: false });
      component.onSubmit();
      tick();

      expect(component.loginError).toContain('Account inactive');
    }));

    it('should handle network error (status 0)', fakeAsync(() => {
      authServiceSpy.login.and.returnValue(throwError(() =>
        new HttpErrorResponse({ status: 0 })
      ));

      component.loginForm.setValue({ email: 'a@b.com', password: 'p', rememberMe: false });
      component.onSubmit();
      tick();

      expect(component.loginError).toContain('servidor');
    }));

    it('should handle 429 rate limit error', fakeAsync(() => {
      authServiceSpy.login.and.returnValue(throwError(() =>
        new HttpErrorResponse({ status: 429 })
      ));

      component.loginForm.setValue({ email: 'a@b.com', password: 'p', rememberMe: false });
      component.onSubmit();
      tick();

      expect(component.loginError).toContain('límite');
    }));
  });

  describe('Remember me', () => {
    it('should save email when remember me is checked', fakeAsync(() => {
      authServiceSpy.login.and.returnValue(of({ success: true } as any));

      component.loginForm.setValue({ email: 'saved@test.com', password: 'pass', rememberMe: true });
      component.onSubmit();
      tick();

      expect(localStorage.getItem('rememberUser')).toBe('true');
      expect(localStorage.getItem('savedEmail')).toBe('saved@test.com');
    }));

    it('should clear saved email when remember me is unchecked', fakeAsync(() => {
      localStorage.setItem('rememberUser', 'true');
      localStorage.setItem('savedEmail', 'old@test.com');

      authServiceSpy.login.and.returnValue(of({ success: true } as any));
      component.loginForm.setValue({ email: 'new@test.com', password: 'pass', rememberMe: false });
      component.onSubmit();
      tick();

      expect(localStorage.getItem('rememberUser')).toBeNull();
      expect(localStorage.getItem('savedEmail')).toBeNull();
    }));

    it('should load saved email on init when remember is active', () => {
      localStorage.setItem('rememberUser', 'true');
      localStorage.setItem('savedEmail', 'remembered@test.com');

      // Re-create component to trigger loadSavedCredentials
      fixture = TestBed.createComponent(AuthFormComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.loginForm.get('email')?.value).toBe('remembered@test.com');
      expect(component.loginForm.get('rememberMe')?.value).toBeTrue();
    });
  });
});
