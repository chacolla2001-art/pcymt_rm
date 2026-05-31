import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { LoggerService } from './logger.service';
import { HttpErrorResponse } from '@angular/common/http';
import { API_ERROR_CODES } from '../models/api-response.model';

describe('LoggerService', () => {
  let service: LoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        LoggerService,
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });
    service = TestBed.inject(LoggerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('console methods', () => {
    beforeEach(() => {
      spyOn(console, 'debug');
      spyOn(console, 'info');
      spyOn(console, 'warn');
      spyOn(console, 'error');
    });

    it('should log debug messages', () => {
      service.debug('Debug message', 'TestContext');
      expect(console.debug).toHaveBeenCalled();
    });

    it('should log info messages', () => {
      service.info('Info message', 'TestContext');
      expect(console.info).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      service.warn('Warning message', 'TestContext');
      expect(console.warn).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      service.error('Error message', 'TestContext');
      expect(console.error).toHaveBeenCalled();
    });

    it('should include context in log output', () => {
      service.info('Test', 'MyContext');
      const logArg = (console.info as jasmine.Spy).calls.argsFor(0)[0];
      expect(logArg).toContain('[MyContext]');
    });

    it('should include timestamp in log output', () => {
      service.info('Test', 'Ctx');
      const logArg = (console.info as jasmine.Spy).calls.argsFor(0)[0];
      // ISO timestamp has 'T' in it
      expect(logArg).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('logHttpError()', () => {
    beforeEach(() => {
      spyOn(console, 'error');
    });

    it('should log HTTP error with status', () => {
      const error = new HttpErrorResponse({ status: 404, statusText: 'Not Found', url: '/api/users' });
      service.logHttpError(error, 'TestContext');
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle network error (status 0)', () => {
      const error = new HttpErrorResponse({ status: 0, url: '/api/data' });
      service.logHttpError(error);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('logAuthError()', () => {
    beforeEach(() => {
      spyOn(console, 'error');
    });

    it('should log auth error from HttpErrorResponse', () => {
      const error = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' });
      service.logAuthError(error, 'login');
      expect(console.error).toHaveBeenCalled();
    });

    it('should log auth error from regular Error', () => {
      const error = new Error('Token expired');
      service.logAuthError(error, 'refresh');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('logValidationError()', () => {
    beforeEach(() => {
      spyOn(console, 'warn');
    });

    it('should log validation errors', () => {
      const errors = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' }
      ];
      service.logValidationError(errors, 'FormContext');
      expect(console.warn).toHaveBeenCalled();
      const logArg = (console.warn as jasmine.Spy).calls.argsFor(0)[0];
      expect(logArg).toContain('email, password');
    });
  });

  describe('logNetworkError()', () => {
    beforeEach(() => {
      spyOn(console, 'error');
    });

    it('should log connection failure', () => {
      const error = new HttpErrorResponse({ status: 0, url: '/api/data' });
      service.logNetworkError(error);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Server-side rendering', () => {
    it('should not log on server platform', () => {
      const serverService = new LoggerService('server' as any);
      spyOn(console, 'info');
      serverService.info('Test');
      expect(console.info).not.toHaveBeenCalled();
    });
  });
});
