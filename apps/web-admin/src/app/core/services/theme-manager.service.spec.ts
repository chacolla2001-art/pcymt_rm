import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ThemeManagerService, ThemeMode } from './theme-manager.service';

describe('ThemeManagerService', () => {
  let service: ThemeManagerService;
  let mockDocument: Document;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        ThemeManagerService,
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });
    service = TestBed.inject(ThemeManagerService);
    mockDocument = TestBed.inject(DOCUMENT);
  });

  afterEach(() => localStorage.clear());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default to light theme', () => {
    expect(service.themeMode()).toBe('light');
  });

  describe('setThemeMode()', () => {
    it('should set theme to dark', () => {
      service.setThemeMode('dark');
      expect(service.themeMode()).toBe('dark');
      expect(localStorage.getItem('theme-mode')).toBe('dark');
    });

    it('should set theme to light', () => {
      service.setThemeMode('light');
      expect(service.themeMode()).toBe('light');
      expect(localStorage.getItem('theme-mode')).toBe('light');
    });

    it('should set theme to system', () => {
      service.setThemeMode('system');
      expect(service.themeMode()).toBe('system');
    });

    it('should apply CSS class to document', () => {
      service.setThemeMode('dark');
      expect(mockDocument.documentElement.classList.contains('dark-theme')).toBeTrue();
      expect(mockDocument.documentElement.classList.contains('light-theme')).toBeFalse();
    });

    it('should emit theme change', (done) => {
      service.themeChanged$.subscribe(theme => {
        expect(['light', 'dark']).toContain(theme);
        done();
      });
      service.setThemeMode('dark');
    });
  });

  describe('toggleTheme()', () => {
    it('should cycle through light -> dark -> system -> light', () => {
      expect(service.themeMode()).toBe('light');
      service.toggleTheme();
      expect(service.themeMode()).toBe('dark');
      service.toggleTheme();
      expect(service.themeMode()).toBe('system');
      service.toggleTheme();
      expect(service.themeMode()).toBe('light');
    });
  });

  describe('isDarkMode()', () => {
    it('should return true when dark theme', () => {
      service.setThemeMode('dark');
      expect(service.isDarkMode()).toBeTrue();
    });

    it('should return false when light theme', () => {
      service.setThemeMode('light');
      expect(service.isDarkMode()).toBeFalse();
    });
  });

  describe('getThemeModeIcon()', () => {
    it('should return light_mode for light theme', () => {
      service.setThemeMode('light');
      expect(service.getThemeModeIcon()).toBe('light_mode');
    });

    it('should return dark_mode for dark theme', () => {
      service.setThemeMode('dark');
      expect(service.getThemeModeIcon()).toBe('dark_mode');
    });

    it('should return contrast for system theme', () => {
      service.setThemeMode('system');
      expect(service.getThemeModeIcon()).toBe('contrast');
    });
  });

  describe('restores saved theme', () => {
    it('should load saved theme from localStorage', () => {
      localStorage.setItem('theme-mode', 'dark');
      const newService = new ThemeManagerService();
      expect(newService.themeMode()).toBe('dark');
    });
  });
});
