import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { ES_TRANSLATIONS } from '../i18n/es';
import { EN_TRANSLATIONS } from '../i18n/en';

export type AppLanguage = 'es' | 'en';

const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  es: ES_TRANSLATIONS,
  en: EN_TRANSLATIONS,
};

const STORAGE_KEY = 'app_language';

@Injectable({
  providedIn: 'root',
})
export class I18nService {
  private readonly currentLang$: BehaviorSubject<AppLanguage>;
  private readonly isBrowser: boolean;

  /** Available languages */
  readonly languages: { code: AppLanguage; label: string; flag: string }[] = [
    { code: 'es', label: 'Español', flag: '🇧🇴' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
  ];

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
    const saved = this.isBrowser ? localStorage.getItem(STORAGE_KEY) as AppLanguage : null;
    this.currentLang$ = new BehaviorSubject<AppLanguage>(saved || 'es');
  }

  /** Current language as observable */
  get lang$(): Observable<AppLanguage> {
    return this.currentLang$.asObservable();
  }

  /** Current language value */
  get currentLang(): AppLanguage {
    return this.currentLang$.value;
  }

  /** Switch language */
  setLanguage(lang: AppLanguage): void {
    if (this.isBrowser) {
      localStorage.setItem(STORAGE_KEY, lang);
    }
    this.currentLang$.next(lang);
  }

  /** Translate a key */
  t(key: string): string {
    return TRANSLATIONS[this.currentLang][key] || key;
  }
}
