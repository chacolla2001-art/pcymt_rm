import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AnchorPoint, AnchorCluster, ParkSection } from '../models/anchor-point.model';
import { ApiRoutesService } from '@core/services/api-routes.service';

/** Respuesta estándar del backend */
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

/** Respuesta del backend en snake_case */
interface AnchorPointDTO {
  id: string;
  name: string;
  anchor_code?: string;
  latitude: number;
  longitude: number;
  section?: string;
  show_in_map?: boolean;
  is_active?: boolean;
  virtual_asset_id?: string;
  created_at?: string;
  updated_at?: string;
}

/** DTO de cluster del backend */
interface AnchorClusterDTO {
  virtualAssetId: string;
  section: string;
  count: number;
  isCluster: boolean;
  center: { lat: number; lng: number };
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  polygon: { lat: number; lng: number }[] | null;
  locations: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    anchorCode?: string;
    showInMap?: boolean;
    scale?: number;
    rotationY?: number;
  }[];
}

const mapToCluster = (dto: AnchorClusterDTO): AnchorCluster => ({
  virtualAssetId: dto.virtualAssetId,
  section: dto.section as ParkSection,
  count: dto.count,
  isCluster: dto.isCluster,
  center: dto.center,
  bounds: dto.bounds,
  polygon: dto.polygon,
  locations: dto.locations,
});

/** Convierte snake_case del backend a camelCase del frontend */
const mapToAnchorPoint = (dto: AnchorPointDTO): AnchorPoint => new AnchorPoint({
  id: dto.id,
  name: dto.name,
  anchorCode: dto.anchor_code,
  latitude: typeof dto.latitude === 'string' ? parseFloat(dto.latitude) : dto.latitude,
  longitude: typeof dto.longitude === 'string' ? parseFloat(dto.longitude) : dto.longitude,
  section: dto.section as ParkSection | undefined,
  showInMap: dto.show_in_map,
  active: dto.is_active ?? true,
  virtualAssetId: dto.virtual_asset_id,
  createdAt: dto.created_at ? new Date(dto.created_at) : new Date(),
  updatedAt: dto.updated_at ? new Date(dto.updated_at) : new Date(),
});

/**
 * Servicio de Puntos de Anclaje
 * Maneja operaciones CRUD para ubicaciones de modelos 3D en el mapa
 *
 * Nota: El token de autenticación se agrega automáticamente por el tokenInterceptor
 */
@Injectable({
  providedIn: 'root',
})
export class AnchorPointService {
  constructor(
    private readonly http: HttpClient,
    private readonly apiRoutes: ApiRoutesService
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // OPERACIONES CRUD
  // ═══════════════════════════════════════════════════════════════

  /** Obtener todos los puntos de anclaje */
  getAllAnchorPoints(isActive?: boolean): Observable<AnchorPoint[]> {
    let url = this.apiRoutes.endpoints.anchorPoints.base;
    if (isActive !== undefined) {
      url += `?is_active=${isActive}`;
    }
    return this.http.get<ApiResponse<AnchorPointDTO[]>>(url)
      .pipe(map(response => response.data.map(mapToAnchorPoint)));
  }

  /** Obtener punto de anclaje por ID */
  getAnchorPointById(anchorPointId: string): Observable<AnchorPoint> {
    return this.http.get<ApiResponse<AnchorPointDTO>>(this.apiRoutes.endpoints.anchorPoints.byId(anchorPointId))
      .pipe(map(response => mapToAnchorPoint(response.data)));
  }

  /** Crear nuevo punto de anclaje */
  createAnchorPoint(anchorPoint: AnchorPoint): Observable<AnchorPoint> {
    return this.http.post<ApiResponse<AnchorPointDTO>>(this.apiRoutes.endpoints.anchorPoints.base, anchorPoint)
      .pipe(map(response => mapToAnchorPoint(response.data)));
  }

  /** Actualizar punto de anclaje existente */
  updateAnchorPoint(anchorPointId: string, anchorPoint: AnchorPoint): Observable<AnchorPoint> {
    return this.http.put<ApiResponse<AnchorPointDTO>>(this.apiRoutes.endpoints.anchorPoints.byId(anchorPointId), anchorPoint)
      .pipe(map(response => mapToAnchorPoint(response.data)));
  }

  /** Eliminar punto de anclaje */
  deleteAnchorPoint(anchorPointId: string): Observable<void> {
    return this.http.delete<void>(this.apiRoutes.endpoints.anchorPoints.byId(anchorPointId));
  }

  /** Obtener solo puntos de anclaje activos */
  getActiveAnchorPoints(): Observable<AnchorPoint[]> {
    return this.http.get<ApiResponse<AnchorPointDTO[]>>(this.apiRoutes.endpoints.anchorPoints.active)
      .pipe(map(response => response.data.map(mapToAnchorPoint)));
  }

  /** Obtener clusters — grupos de puntos de anclaje por virtual asset */
  getClusters(): Observable<AnchorCluster[]> {
    return this.http.get<ApiResponse<AnchorClusterDTO[]>>(this.apiRoutes.endpoints.anchorPoints.clusters)
      .pipe(map(response => response.data.map(mapToCluster)));
  }
}
