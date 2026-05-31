import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Definición de todos los endpoints de la API
 * Centraliza todas las rutas para evitar hardcoding
 */
export interface ApiEndpoints {
  // Auth
  auth: {
    login: string;
    register: string;
    logout: string;
    google: string;
    me: string;
    refresh: string;
  };
  // Users
  users: {
    base: string;
    byId: (id: string) => string;
    register: string;
    recoverPassword: string;
    verifyPassword: string;
    changePassword: string;
    adminSetPassword: (id: string) => string;
    checkEmail: string;
    toggleActive: (id: string) => string;
    profilePicture: (id: string) => string;
  };
  // Virtual Assets
  virtualAssets: {
    base: string;
    byId: (id: string) => string;
    active: string;
    animationSequence: (id: string) => string;
  };
  // Anchor Points
  anchorPoints: {
    base: string;
    byId: (id: string) => string;
    active: string;
    clusters: string;
  };
  // User Interactions
  userInteractions: {
    base: string;
    byId: (id: string) => string;
  };
  // User Sessions
  userSessions: {
    base: string;
    byId: (id: string) => string;
    byUserId: (userId: string) => string;
    stats: string;
    timeSeries: string;
    start: string;
    end: (id: string) => string;
  };
  // Analytics
  analytics: {
    base: string;
    usersByRole: string;
    activeUsersCount: string;
    interactionsByType: string;
    activeVirtualAssets: string;
    anchorPointsByLocation: string;
    usersStatus: string;
    totalInteractions: string;
    lastAccess: string;
    totals: string;
    topVirtualAssets: string;
    topUsers: string;
    interactionsBySection: string;
    timeSeriesBySection: string;
  };
  // Uploads (archivos estáticos)
  uploads: {
    base: string;
    file: (path: string) => string;
  };
  // Map Configurations
  mapConfigurations: {
    base: string;
    mine: string;
    public: string;
    global: string;
    byId: (id: string) => string;
  };
  // Map Tiles
  mapTiles: {
    manifest: string;
    tile: (z: number, x: number, y: number) => string;
    overlay: (name: string) => string;
    publish: string;
    tilesets: string;
    stickers: string;
    zoomZip: (z: number) => string;
  };
  // Config
  config: {
    base: string;
  };
}

/**
 * Servicio centralizado de rutas API
 * Proporciona acceso a todas las rutas de la API de forma tipada y centralizada
 *
 * @example
 * ```typescript
 * constructor(private apiRoutes: ApiRoutesService) {}
 *
 * // Usar rutas
 * this.http.get(this.apiRoutes.endpoints.users.base);
 * this.http.get(this.apiRoutes.endpoints.users.byId('123'));
 * this.http.get(this.apiRoutes.getFullUrl('/custom/path'));
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class ApiRoutesService {
  /** URL base de la API */
  readonly baseUrl: string = environment.apiUrl;

  /** Prefijo de la API (v1) */
  readonly apiPrefix: string = '/api';

  /** Todos los endpoints disponibles */
  readonly endpoints: ApiEndpoints;

  constructor() {
    const api = `${this.baseUrl}${this.apiPrefix}`;

    this.endpoints = {
      // ═══════════════════════════════════════════════════════════════
      // AUTH
      // ═══════════════════════════════════════════════════════════════
      auth: {
        login: `${api}/auth/login`,
        register: `${api}/auth/register`,
        logout: `${api}/auth/logout`,
        google: `${api}/auth/google`,
        me: `${api}/auth/me`,
        refresh: `${api}/auth/refresh`,
      },

      // ═══════════════════════════════════════════════════════════════
      // USERS
      // ═══════════════════════════════════════════════════════════════
      users: {
        base: `${api}/users`,
        byId: (id: string) => `${api}/users/${id}`,
        register: `${api}/users/register`,
        recoverPassword: `${api}/users/recover-password`,
        verifyPassword: `${api}/users/verify-password`,
        changePassword: `${api}/users/change-password`,
        adminSetPassword: (id: string) => `${api}/users/${id}/set-password`,
        checkEmail: `${api}/users/check-email`,
        toggleActive: (id: string) => `${api}/users/${id}/toggle-active`,
        profilePicture: (id: string) => `${api}/users/${id}/profile-picture`,
      },

      // ═══════════════════════════════════════════════════════════════
      // VIRTUAL ASSETS
      // ═══════════════════════════════════════════════════════════════
      virtualAssets: {
        base: `${api}/virtual-assets`,
        byId: (id: string) => `${api}/virtual-assets/${id}`,
        active: `${api}/virtual-assets/active`,
        animationSequence: (id: string) => `${api}/virtual-assets/${id}/animation-sequence`,
      },

      // ═══════════════════════════════════════════════════════════════
      // ANCHOR POINTS
      // ═══════════════════════════════════════════════════════════════
      anchorPoints: {
        base: `${api}/anchor-points`,
        byId: (id: string) => `${api}/anchor-points/${id}`,
        active: `${api}/anchor-points/active`,
        clusters: `${api}/anchor-points/clusters`,
      },

      // ═══════════════════════════════════════════════════════════════
      // USER INTERACTIONS
      // ═══════════════════════════════════════════════════════════════
      userInteractions: {
        base: `${api}/user-interactions`,
        byId: (id: string) => `${api}/user-interactions/${id}`,
      },

      // ═══════════════════════════════════════════════════════════════
      // USER SESSIONS
      // ═══════════════════════════════════════════════════════════════
      userSessions: {
        base: `${api}/user-sessions`,
        byId: (id: string) => `${api}/user-sessions/${id}`,
        byUserId: (userId: string) => `${api}/user-sessions/user/${userId}`,
        stats: `${api}/user-sessions/stats`,
        timeSeries: `${api}/user-sessions/time-series`,
        start: `${api}/user-sessions/start`,
        end: (id: string) => `${api}/user-sessions/${id}/end`,
      },

      // ═══════════════════════════════════════════════════════════════
      // ANALYTICS - Rutas sincronizadas con backend
      // ═══════════════════════════════════════════════════════════════
      analytics: {
        base: `${api}/analytics`,
        usersByRole: `${api}/analytics/users-by-role`,
        activeUsersCount: `${api}/analytics/active-users`,
        interactionsByType: `${api}/analytics/interactions-by-type`,
        activeVirtualAssets: `${api}/analytics/active-virtual-assets`,
        anchorPointsByLocation: `${api}/analytics/anchor-points`,
        usersStatus: `${api}/analytics/users-status`,
        totalInteractions: `${api}/analytics/total-interactions`,
        lastAccess: `${api}/analytics/last-access`,
        totals: `${api}/analytics/totals`,
        topVirtualAssets: `${api}/analytics/top-virtual-assets`,
        topUsers: `${api}/analytics/top-users`,
        interactionsBySection: `${api}/analytics/interactions-by-section`,
        timeSeriesBySection: `${api}/analytics/time-series-by-section`,
      },

      // ═══════════════════════════════════════════════════════════════
      // FILES (Archivos protegidos por autenticación)
      // ═══════════════════════════════════════════════════════════════
      uploads: {
        base: `${this.baseUrl}/api/files`,
        file: (path: string) => this.getAssetUrl(path),
      },

      // ═══════════════════════════════════════════════════════════════
      // MAP CONFIGURATIONS
      // ═══════════════════════════════════════════════════════════════
      mapConfigurations: {
        base: `${api}/map-configurations`,
        mine: `${api}/map-configurations/mine`,
        public: `${api}/map-configurations/public`,
        global: `${api}/map-configurations/global`,
        byId: (id: string) => `${api}/map-configurations/${id}`,
      },

      // ═══════════════════════════════════════════════════════════════
      // MAP TILES
      // ═══════════════════════════════════════════════════════════════
      mapTiles: {
        manifest: `${api}/map/manifest`,
        tile: (z: number, x: number, y: number) => `${api}/map/tiles/${z}/${x}_${y}.png`,
        overlay: (name: string) => `${api}/map/overlays/${name}`,
        publish: `${api}/map/publish`,
        tilesets: `${api}/map/tilesets`,
        stickers: `${api}/map/stickers`,
        zoomZip: (z: number) => `${api}/map/tiles/${z}/all.zip`,
      },

      // ═══════════════════════════════════════════════════════════════
      // CONFIG
      // ═══════════════════════════════════════════════════════════════
      config: {
        base: `${api}/config`,
      },
    };
  }

  /**
   * Construye una URL completa a partir de un path relativo
   * @param path - Path relativo (ej: '/custom/endpoint')
   * @returns URL completa
   */
  getFullUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${this.apiPrefix}${cleanPath}`;
  }

  /**
   * Construye una URL autenticada para archivos protegidos (uploads, iconos, modelos 3D).
   * - Normaliza paths antiguos /uploads/ a /api/files/ (retrocompatibilidad con BD)
   * - Adjunta el JWT como query param para que funcione con <img> tags
   *   (los navegadores no envían el header Authorization en peticiones de <img>)
   * @param path - Path del archivo (puede incluir o no el '/' inicial)
   * @returns URL completa del archivo con token de autenticación
   */
  getAssetUrl(path: string | null | undefined): string {
    if (!path) return '';

    // Si es una URL externa (ej: Google profile pictures), devolverla tal cual
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // Normalizar paths antiguos: /uploads/file.png → /api/files/file.png
    let normalizedPath = path.replace(/^\/uploads\//, '/api/files/');

    // Asegurar que empiece con /
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = `/${normalizedPath}`;
    }

    const url = `${this.baseUrl}${normalizedPath}`;

    // Adjuntar token JWT como query param para autenticación en <img> tags
    const token = localStorage.getItem('token');
    return token ? `${url}?token=${token}` : url;
  }

  /**
   * Verifica si una URL es del mismo dominio que la API
   * @param url - URL a verificar
   * @returns true si es del mismo dominio
   */
  isSameOrigin(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const baseUrlObj = new URL(this.baseUrl);
      return urlObj.origin === baseUrlObj.origin;
    } catch {
      return false;
    }
  }
}
