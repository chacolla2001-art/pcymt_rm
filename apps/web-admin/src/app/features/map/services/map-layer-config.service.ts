import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiRoutesService } from '@core/services/api-routes.service';
import {
  MapLayerConfig,
  MapLayerConfigDTO,
  MapLayerConfigPayload,
  MapConfigData,
  mapToMapLayerConfig
} from '../models/map-layer-config.model';

/** Standard backend response */
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

/**
 * Service for managing map layer configurations via the backend API.
 * All operations target platform='web' to keep frontend configs
 * separate from mobile configs.
 */
@Injectable({ providedIn: 'root' })
export class MapLayerConfigService {
  private configsSubject = new BehaviorSubject<MapLayerConfig[]>([]);
  configs$ = this.configsSubject.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly apiRoutes: ApiRoutesService
  ) {}

  private get baseUrl(): string {
    return this.apiRoutes.endpoints.mapConfigurations.base;
  }

  /** Get all configs available to the current user (own + public, web platform) */
  getAvailable(): Observable<MapLayerConfig[]> {
    return this.http.get<ApiResponse<MapLayerConfigDTO[]>>(this.baseUrl)
      .pipe(
        map(res => res.data.map(mapToMapLayerConfig)),
        map(configs => configs.filter(c => c.platform === 'web')),
        tap(configs => this.configsSubject.next(configs))
      );
  }

  /** Get only configs created by the current user */
  getMine(): Observable<MapLayerConfig[]> {
    return this.http.get<ApiResponse<MapLayerConfigDTO[]>>(
      this.apiRoutes.endpoints.mapConfigurations.mine
    ).pipe(
      map(res => res.data.map(mapToMapLayerConfig)),
      map(configs => configs.filter(c => c.platform === 'web'))
    );
  }

  /** Get public configs */
  getPublic(): Observable<MapLayerConfig[]> {
    return this.http.get<ApiResponse<MapLayerConfigDTO[]>>(
      this.apiRoutes.endpoints.mapConfigurations.public
    ).pipe(
      map(res => res.data.map(mapToMapLayerConfig)),
      map(configs => configs.filter(c => c.platform === 'web'))
    );
  }

  /** Get a single config by id */
  getById(id: string): Observable<MapLayerConfig> {
    return this.http.get<ApiResponse<MapLayerConfigDTO>>(
      this.apiRoutes.endpoints.mapConfigurations.byId(id)
    ).pipe(map(res => mapToMapLayerConfig(res.data)));
  }

  /** Create a new configuration */
  create(payload: MapLayerConfigPayload): Observable<MapLayerConfig> {
    return this.http.post<ApiResponse<MapLayerConfigDTO>>(this.baseUrl, payload)
      .pipe(
        map(res => mapToMapLayerConfig(res.data)),
        tap(() => this.refreshList())
      );
  }

  /** Update an existing configuration */
  update(id: string, payload: Partial<MapLayerConfigPayload>): Observable<MapLayerConfig> {
    return this.http.put<ApiResponse<MapLayerConfigDTO>>(
      this.apiRoutes.endpoints.mapConfigurations.byId(id),
      payload
    ).pipe(
      map(res => mapToMapLayerConfig(res.data)),
      tap(() => this.refreshList())
    );
  }

  /** Delete a configuration */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(
      this.apiRoutes.endpoints.mapConfigurations.byId(id)
    ).pipe(tap(() => this.refreshList()));
  }

  /** Get the single global web configuration (null data if not saved yet) */
  getGlobal(): Observable<MapLayerConfig | null> {
    return this.http.get<ApiResponse<MapLayerConfigDTO | null>>(
      this.apiRoutes.endpoints.mapConfigurations.global
    ).pipe(map(res => res.data ? mapToMapLayerConfig(res.data) : null));
  }

  /** Create or replace the single global web configuration */
  upsertGlobal(configData: MapConfigData): Observable<MapLayerConfig> {
    return this.http.put<ApiResponse<MapLayerConfigDTO>>(
      this.apiRoutes.endpoints.mapConfigurations.global,
      { config_data: configData }
    ).pipe(map(res => mapToMapLayerConfig(res.data)));
  }

  /** Refresh the cached list */
  private refreshList(): void {
    this.getAvailable().subscribe();
  }
}
