import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal, effect } from '@angular/core';
import { Subject } from 'rxjs';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'theme-mode';

/**
 * Servicio simple para gestionar el tema de la aplicación
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeManagerService {
  private readonly doc = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  
  readonly themeMode = signal<ThemeMode>('light');
  
  /** Observable que emite cuando el tema efectivo cambia */
  private readonly themeChangedSubject = new Subject<'light' | 'dark'>();
  readonly themeChanged$ = this.themeChangedSubject.asObservable();
  
  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem(THEME_KEY) as ThemeMode;
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        this.themeMode.set(saved);
      }
      this.applyTheme();
      
      // Escuchar cambios del sistema
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.themeMode() === 'system') {
          this.applyTheme();
          this.emitThemeChange();
        }
      });
    }
  }

  private getEffectiveTheme(): 'light' | 'dark' {
    const mode = this.themeMode();
    if (mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode;
  }

  private applyTheme(): void {
    const theme = this.getEffectiveTheme();
    const html = this.doc.documentElement;
    
    html.classList.remove('light-theme', 'dark-theme');
    html.classList.add(`${theme}-theme`);
  }

  setThemeMode(mode: ThemeMode): void {
    this.themeMode.set(mode);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(THEME_KEY, mode);
      this.applyTheme();
      this.emitThemeChange();
    }
  }

  private emitThemeChange(): void {
    this.themeChangedSubject.next(this.getEffectiveTheme());
  }

  toggleTheme(): void {
    const modes: ThemeMode[] = ['light', 'dark', 'system'];
    const current = modes.indexOf(this.themeMode());
    this.setThemeMode(modes[(current + 1) % 3]);
  }

  isDarkMode(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    return this.getEffectiveTheme() === 'dark';
  }

  getThemeModeIcon(): string {
    switch (this.themeMode()) {
      case 'light': return 'light_mode';
      case 'dark': return 'dark_mode';
      case 'system': return 'contrast';
    }
  }
}
