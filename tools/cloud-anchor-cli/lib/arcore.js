/**
 * lib/arcore.js — Cliente para ARCore Cloud Anchors Management REST API v1beta2
 *
 * Documentación oficial:
 *   https://developers.google.com/ar/develop/rest-api
 *
 * Endpoints usados:
 *   GET    /v1beta2/management/anchors             → listar
 *   GET    /v1beta2/management/anchors/{id}        → obtener uno
 *   DELETE /v1beta2/management/anchors/{id}        → eliminar
 *
 * El anchor_id en la URL debe estar URL-encoded (ej: ua:XXXX → ua%3AXXXX)
 */

'use strict';

const axios = require('axios');

const BASE_URL = 'https://arcore.googleapis.com/v1beta2';

class ArcoreClient {
  /**
   * @param {string} accessToken - OAuth2 Bearer token
   */
  constructor(accessToken) {
    this._token = accessToken;
    this._http = axios.create({
      baseURL: BASE_URL,
      timeout: 20_000,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Goog-User-Project': process.env.GOOGLE_PROJECT_ID || 'pedrochacolla-488420',
      },
    });

    // Normalize errors
    this._http.interceptors.response.use(
      (r) => r,
      (err) => {
        const d = err.response?.data;
        const status = err.response?.status ?? 0;

        let msg = d?.error?.message
          ?? d?.error?.status
          ?? d?.message
          ?? err.message
          ?? 'Error desconocido';

        if (status === 401) msg = 'Token de acceso inválido o expirado. Usa "Re-autenticar con Google".';
        if (status === 403) msg = 'Acceso denegado. Verifica que la cuenta tenga permisos de ARCore Management.';
        if (status === 404) msg = 'Anchor no encontrado (puede haber sido eliminado o el ID es incorrecto).';

        const error = new Error(`[HTTP ${status}] ${msg}`);
        error.status = status;
        error.raw = d;
        return Promise.reject(error);
      }
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Extraer solo el anchor_id desde un nombre completo como:
   *   "management/anchors/ua:XXXX..."  →  "ua:XXXX..."
   * Si ya es solo el ID, lo devuelve tal cual.
   */
  static extractId(nameOrId) {
    if (!nameOrId) return nameOrId;
    // "management/anchors/ua:XXXX" → "ua:XXXX"
    const parts = nameOrId.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Construye el path URL para un anchor ID dado.
   * URL-encodes el ID (ej: "ua:XXXX" → "ua%3AXXXX")
   */
  static anchorPath(anchorId) {
    const id = ArcoreClient.extractId(anchorId);
    return `/management/anchors/${encodeURIComponent(id)}`;
  }

  // ── API calls ──────────────────────────────────────────────────────────────

  /**
   * Listar anchors con paginación.
   * @returns {{ anchors?: object[], nextPageToken?: string }}
   */
  async listAnchors(pageSize = 100, pageToken = null) {
    const params = { page_size: pageSize };
    if (pageToken) params.page_token = pageToken;
    const res = await this._http.get('/management/anchors', { params });
    return res.data;
  }

  /**
   * Obtener TODOS los anchors del proyecto (maneja paginación automáticamente).
   * @returns {object[]}
   */
  async getAllAnchors() {
    const all = [];
    let pageToken = null;
    do {
      const result = await this.listAnchors(100, pageToken);
      if (result.anchors && result.anchors.length > 0) {
        all.push(...result.anchors);
      }
      pageToken = result.nextPageToken ?? null;
    } while (pageToken);
    return all;
  }

  /**
   * Obtener los detalles de un anchor específico.
   * @param {string} anchorId - ID del anchor (con o sin prefijo "ua:")
   * @returns {object} anchor
   */
  async getAnchor(anchorId) {
    const res = await this._http.get(ArcoreClient.anchorPath(anchorId));
    return res.data;
  }

  /**
   * Eliminar un Cloud Anchor de ARCore.
   * @param {string} anchorId - ID del anchor
   */
  async deleteAnchor(anchorId) {
    await this._http.delete(ArcoreClient.anchorPath(anchorId));
  }

  /**
   * Actualizar el expireTime de un anchor (extender TTL).
   * @param {string} anchorId
   * @param {string} newExpireTime - ISO 8601 datetime (ej: "2027-03-19T00:00:00Z")
   * @returns {object} anchor actualizado
   */
  async updateAnchorTtl(anchorId, newExpireTime) {
    const path = ArcoreClient.anchorPath(anchorId);
    const res = await this._http.patch(`${path}?updateMask=expire_time`, {
      expireTime: newExpireTime,
    });
    return res.data;
  }

  /**
   * Eliminar múltiples anchors en batch (endpoint nativo de ARCore).
   * @param {string[]} anchorIds - Lista de IDs (sin prefijo "anchors/")
   * @returns {object} respuesta de la API
   */
  async batchDelete(anchorIds) {
    const names = anchorIds.map(id => `anchors/${ArcoreClient.extractId(id)}`);
    const res = await this._http.post('/management/anchors:batchDelete', { names });
    return res.data;
  }

  /**
   * Eliminar múltiples anchors, tolerando fallos individuales.
   * @param {string[]} anchorIds
   * @returns {{ success: string[], failed: Array<{id: string, error: string}> }}
   */
  async deleteMultiple(anchorIds) {
    const results = { success: [], failed: [] };
    for (const id of anchorIds) {
      try {
        await this.deleteAnchor(id);
        results.success.push(id);
      } catch (err) {
        results.failed.push({ id, error: err.message });
      }
    }
    return results;
  }

  /**
   * Verifica si el token tiene acceso a la API (hace un listado pequeño).
   * @returns {boolean}
   */
  async testConnection() {
    try {
      await this.listAnchors(1);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = ArcoreClient;
