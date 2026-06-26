/**
 * Fetches files from Supabase Storage (public bucket) for proxy serving via /api/files/.
 */
class SupabaseStorageService {
  /**
   * @param {{ url: string|null, bucket: string, serviceRoleKey?: string|null }} config
   */
  constructor({ url, bucket, serviceRoleKey = null }) {
    this.url = url ? url.replace(/\/$/, '') : null;
    this.bucket = bucket || 'uploads';
    this.serviceRoleKey = serviceRoleKey || null;
  }

  isConfigured() {
    return Boolean(this.url && this.bucket);
  }

  /**
   * @param {string} objectPath - Path inside the bucket, e.g. "bear.glb" or "map-icons/foo.svg"
   * @returns {string|null}
   */
  buildPublicUrl(objectPath) {
    if (!this.isConfigured()) return null;
    const encoded = objectPath
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `${this.url}/storage/v1/object/public/${this.bucket}/${encoded}`;
  }

  /**
   * @param {string} objectPath
   * @returns {Promise<Response|null>}
   */
  async fetchObject(objectPath) {
    if (!this.isConfigured()) return null;

    const url = this.buildPublicUrl(objectPath);
    const headers = {};

    let response = await fetch(url, { headers, redirect: 'follow' });

    // Private bucket fallback when service role key is configured
    if (!response.ok && this.serviceRoleKey) {
      const encoded = objectPath
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      const privateUrl = `${this.url}/storage/v1/object/${this.bucket}/${encoded}`;
      response = await fetch(privateUrl, {
        headers: {
          Authorization: `Bearer ${this.serviceRoleKey}`,
          apikey: this.serviceRoleKey,
        },
        redirect: 'follow',
      });
    }

    if (!response.ok) return null;
    return response;
  }

  /**
   * Upload or replace an object in Supabase Storage.
   * @param {string} objectPath
   * @param {Buffer} body
   * @param {string} contentType
   */
  async uploadObject(objectPath, body, contentType = 'application/octet-stream') {
    if (!this.isConfigured() || !this.serviceRoleKey) {
      throw new Error('Supabase Storage upload requires SUPABASE_SERVICE_ROLE_KEY');
    }

    const encoded = objectPath
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    const url = `${this.url}/storage/v1/object/${this.bucket}/${encoded}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        apikey: this.serviceRoleKey,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase upload failed (${response.status}): ${text}`);
    }

    return objectPath;
  }

  /**
   * Delete an object from Supabase Storage.
   * @param {string} objectPath
   * @returns {Promise<boolean>} true when deleted or object did not exist
   */
  async deleteObject(objectPath) {
    if (!this.isConfigured() || !this.serviceRoleKey) {
      return false;
    }

    const encoded = objectPath
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    const url = `${this.url}/storage/v1/object/${this.bucket}/${encoded}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        apikey: this.serviceRoleKey,
      },
    });

    return response.ok || response.status === 404;
  }
}

module.exports = SupabaseStorageService;
