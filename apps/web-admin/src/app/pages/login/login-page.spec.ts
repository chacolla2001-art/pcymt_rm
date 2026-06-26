import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { LoginPageComponent } from './login-page';
import { AuthService } from '../../core/services/auth.service';

describe('LoginPageComponent', () => {
  let fixture: ComponentFixture<LoginPageComponent>;
  let component: LoginPageComponent;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['login']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [LoginPageComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not call login when form is invalid', () => {
    component.onSubmit();
    expect(authServiceSpy.login).not.toHaveBeenCalled();
  });

  it('should trim email and call login on success', fakeAsync(() => {
    authServiceSpy.login.and.returnValue(of({
      success: true,
      message: 'OK',
      data: { token: 't', user: { id: '1', email: 'test@test.com', role: 'user', is_active: true } },
    } as any));

    component.loginForm.setValue({ email: '  Test@Test.com  ', password: 'pass123', rememberMe: false });
    component.onSubmit();
    tick();

    expect(authServiceSpy.login).toHaveBeenCalledWith({ email: 'test@test.com', password: 'pass123' });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.isLoading).toBeFalse();
  }));

  it('should show server error on 401', fakeAsync(() => {
    authServiceSpy.login.and.returnValue(throwError(() =>
      new HttpErrorResponse({ status: 401, error: { message: 'Credenciales incorrectas' } }),
    ));

    component.loginForm.setValue({ email: 'a@b.com', password: 'wrong', rememberMe: false });
    component.onSubmit();
    tick();

    expect(component.loginError).toContain('Credenciales incorrectas');
    expect(component.isLoading).toBeFalse();
  }));

  it('should save email when remember me is checked', fakeAsync(() => {
    authServiceSpy.login.and.returnValue(of({ success: true } as any));

    component.loginForm.setValue({ email: 'saved@test.com', password: 'pass', rememberMe: true });
    component.onSubmit();
    tick();

    expect(localStorage.getItem('rememberUser')).toBe('true');
    expect(localStorage.getItem('savedEmail')).toBe('saved@test.com');
  }));

  it('should load saved email on init', () => {
    localStorage.setItem('rememberUser', 'true');
    localStorage.setItem('savedEmail', 'remembered@test.com');

    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.loginForm.get('email')?.value).toBe('remembered@test.com');
    expect(component.loginForm.get('rememberMe')?.value).toBeTrue();
  });
});
