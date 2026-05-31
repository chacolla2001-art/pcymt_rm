import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { User } from '../models/user.model';
import { ApiRoutesService } from '@core/services/api-routes.service';

/** Respuesta estándar del backend */
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

/** Respuesta genérica con mensaje */
interface MessageResponse {
  message: string;
}

/** Respuesta de verificación de existencia */
interface ExistsResponse {
  exists: boolean;
}

/** Parámetros de paginación */
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  is_active?: boolean;
  role?: string;
}

/** Respuesta paginada del backend */
export interface PaginatedResponse<T> {
  rows: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

/**
 * Servicio de Usuarios
 * Maneja operaciones CRUD y validaciones de usuarios
 *
 * Nota: El token de autenticación se agrega automáticamente por el tokenInterceptor
 * Nota: Los errores HTTP se manejan centralizadamente por el errorInterceptor
 */
@Injectable({
  providedIn: 'root',
})
export class UserService {
  constructor(
    private readonly http: HttpClient,
    private readonly apiRoutes: ApiRoutesService
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // RUTAS PÚBLICAS (sin autenticación requerida)
  // ═══════════════════════════════════════════════════════════════

  /** Registro de nuevo usuario */
  createUser(userData: FormData): Observable<User> {
    return this.http.post<User>(this.apiRoutes.endpoints.users.register, userData);
  }

  /** Solicitar recuperación de contraseña */
  recoverPassword(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      this.apiRoutes.endpoints.users.recoverPassword,
      { email }
    );
  }

  /** Verificar contraseña actual */
  verifyPassword(email: string | undefined, password: string | undefined): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      this.apiRoutes.endpoints.users.verifyPassword,
      { email, password }
    );
  }

  /** Cambiar contraseña */
  changePassword(
    email: string | undefined,
    currentPassword: string | undefined,
    newPassword: string | undefined
  ): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      this.apiRoutes.endpoints.users.changePassword,
      { email, currentPassword, newPassword }
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // VALIDACIONES DE UNICIDAD (públicas)
  // ═══════════════════════════════════════════════════════════════

  /** Verificar si el email ya existe */
  checkEmailExists(email: string): Observable<ExistsResponse> {
    return this.http.post<ExistsResponse>(
      this.apiRoutes.endpoints.users.checkEmail,
      { email }
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RUTAS PROTEGIDAS (requieren autenticación)
  // ═══════════════════════════════════════════════════════════════

  /** Obtener todos los usuarios (opcionalmente filtrar por estado activo) — retorna array para compatibilidad */
  getAllUsers(isActive?: boolean): Observable<User[]> {
    let params = new HttpParams();
    if (isActive !== undefined) {
      params = params.set('is_active', String(isActive));
    }
    return this.http.get<ApiResponse<PaginatedResponse<User>>>(this.apiRoutes.endpoints.users.base, { params })
      .pipe(map(response => response.data?.rows ?? (response.data as unknown as User[])));
  }

  /** Obtener usuarios con paginación y búsqueda del servidor */
  getUsersPaginated(params: PaginationParams = {}): Observable<PaginatedResponse<User>> {
    let httpParams = new HttpParams();
    if (params.is_active !== undefined) {
      httpParams = httpParams.set('is_active', String(params.is_active));
    }
    if (params.role) {
      httpParams = httpParams.set('role', params.role);
    }
    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params.page !== undefined) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params.limit !== undefined) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<ApiResponse<PaginatedResponse<User>>>(
      this.apiRoutes.endpoints.users.base,
      { params: httpParams }
    ).pipe(map(response => response.data));
  }

  /** Obtener usuario por ID */
  getUserById(userId: string): Observable<User> {
    return this.http.get<User>(this.apiRoutes.endpoints.users.byId(userId));
  }

  /** Actualizar datos de usuario */
  updateUser(userId: string, userData: FormData): Observable<User> {
    return this.http.put<User>(this.apiRoutes.endpoints.users.byId(userId), userData);
  }

  /** Eliminar usuario */
  deleteUser(userId: string): Observable<void> {
    return this.http.delete<void>(this.apiRoutes.endpoints.users.byId(userId));
  }

  /** Activar/desactivar usuario */
  toggleUserActive(userId: string, active: boolean): Observable<User> {
    return this.http.patch<User>(
      this.apiRoutes.endpoints.users.toggleActive(userId),
      { is_active: active }
    );
  }

  /** Admin establece nueva contraseña para cualquier usuario (sin requerir contraseña actual) */
  adminSetPassword(userId: string, newPassword: string): Observable<MessageResponse> {
    return this.http.patch<MessageResponse>(
      this.apiRoutes.endpoints.users.adminSetPassword(userId),
      { newPassword }
    );
  }

  /** Actualizar foto de perfil */
  updateProfilePicture(userId: string, file: File): Observable<{ profile_picture_url: string }> {
    const formData = new FormData();
    formData.append('profile_picture_url', file);
    return this.http.patch<ApiResponse<{ profile_picture_url: string }>>(
      this.apiRoutes.endpoints.users.profilePicture(userId), 
      formData
    ).pipe(map(response => response.data));
  }
}
