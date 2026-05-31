import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiRoutesService } from '../../../core/services/api-routes.service';

export interface AppConfig {
  google: {
    webClientId: string | null;
    androidClientId: string | null;
    mapsApiKey: string | null;
  };
  arcore: {
    cloudAnchorTtlDays: number;
  };
  features: {
    googleAuthEnabled: boolean;
    mapsEnabled: boolean;
  };
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  constructor(
    private readonly http: HttpClient,
    private readonly apiRoutes: ApiRoutesService
  ) {}

  getConfig(): Observable<AppConfig> {
    return this.http
      .get<ApiResponse<AppConfig>>(this.apiRoutes.endpoints.config.base)
      .pipe(map((res) => res.data));
  }

  updateConfig(config: Partial<{ cloudAnchorTtlDays: number }>): Observable<any> {
    return this.http
      .put<ApiResponse<any>>(this.apiRoutes.endpoints.config.base, config)
      .pipe(map((res) => res.data));
  }
}
