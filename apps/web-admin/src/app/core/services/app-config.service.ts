import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { PublicAppConfig } from '../models/app-config.model';

/**
 * Carga la configuración pública del backend (Google IDs, Supabase Storage, etc.)
 */
@Injectable({
  providedIn: 'root',
})
export class AppConfigService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private config: PublicAppConfig | null = null;
  private loadPromise: Promise<void> | null = null;

  /** Precarga la config al iniciar la app (solo en navegador) */
  ensureLoaded(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve();
    }

    if (this.config) {
      return Promise.resolve();
    }

    if (!this.loadPromise) {
      this.loadPromise = firstValueFrom(
        this.http.get<ApiResponse<PublicAppConfig>>(`${environment.apiUrl}/api/config`)
      )
        .then((response) => {
          this.config = response.data ?? null;
        })
        .catch(() => {
          this.config = null;
        });
    }

    return this.loadPromise;
  }

  /** URL base pública de Supabase Storage, ej. .../object/public/uploads */
  getStoragePublicBaseUrl(): string | null {
    const baseUrl = this.config?.storage?.publicBaseUrl;
    return baseUrl && this.config?.storage?.enabled ? baseUrl.replace(/\/$/, '') : null;
  }
}
