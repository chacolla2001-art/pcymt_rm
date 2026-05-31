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
}

module.exports = SupabaseStorageService;
