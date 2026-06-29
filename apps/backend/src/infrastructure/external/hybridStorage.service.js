'use strict';

/** @typedef {{ buffer: Buffer, mimetype: string, originalname: string, size: number }} MemoryFile */

/**
 * Persists uploaded files to Supabase Storage when configured, otherwise local disk via FileUploadService.
 */
class HybridStorageService {
  /**
   * @param {import('./fileUpload.service')} fileUploadService
   * @param {import('./supabaseStorage.service')|null} supabaseStorage
   * @param {{ preferRemoteWrites?: boolean }} [options]
   */
  constructor(fileUploadService, supabaseStorage, options = {}) {
    this.fileUploadService = fileUploadService;
    this.supabaseStorage = supabaseStorage;
    this.preferRemoteWrites = options.preferRemoteWrites ?? false;
  }

  shouldUseSupabase() {
    return this.preferRemoteWrites && this.supabaseStorage?.isConfigured();
  }

  /** On Vercel, disk is ephemeral — remote storage is mandatory for uploads. */
  #assertRemoteWritesAvailable() {
    if (process.env.VERCEL && !this.shouldUseSupabase()) {
      throw new Error(
        'Storage misconfigured: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required on Vercel',
      );
    }
  }

  /**
   * Persist a buffer (profile pictures, optimized uploads).
   * @param {Buffer} buffer
   * @param {{ filename: string, folder?: string, contentType?: string, objectPath?: string }} meta
   * @returns {Promise<string>} API path (/api/files/...)
   */
  async persistBuffer(buffer, meta) {
    this.#assertRemoteWritesAvailable();

    const folder = meta.folder || '';
    const filename = meta.filename;
    const contentType = meta.contentType || 'application/octet-stream';
    const objectPath = meta.objectPath || (folder ? `${folder}/${filename}` : filename);

    if (this.shouldUseSupabase()) {
      await this.supabaseStorage.uploadObject(objectPath, buffer, contentType);
      return this.fileUploadService.getPublicUrl(filename, folder);
    }

    const fs = require('fs');
    const path = require('path');
    const destDir = folder
      ? path.join(this.fileUploadService.uploadDir, folder)
      : this.fileUploadService.uploadDir;

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.writeFileSync(path.join(destDir, filename), buffer);
    return this.fileUploadService.getPublicUrl(filename, folder);
  }

  /**
   * Persist a multer disk file and return API path (/api/files/...).
   * @param {{ path: string, filename: string, mimetype: string, originalname: string, size: number }} file
   * @param {string} [folder]
   */
  async persistDiskFile(file, folder = '') {
    this.#assertRemoteWritesAvailable();

    if (!this.shouldUseSupabase()) {
      return this.fileUploadService.getPublicUrl(file.filename, folder);
    }

    const fs = require('fs');
    const buffer = fs.readFileSync(file.path);
    const objectPath = folder
      ? `${folder}/${file.filename}`
      : file.filename;

    await this.supabaseStorage.uploadObject(objectPath, buffer, file.mimetype);

    try {
      fs.unlinkSync(file.path);
    } catch {
      // ignore cleanup errors on ephemeral disk
    }

    return this.fileUploadService.getPublicUrl(file.filename, folder);
  }

  /**
   * Persist an in-memory upload (multer memoryStorage).
   * @param {MemoryFile} file
   * @param {string} filename
   * @param {string} [folder]
   */
  async persistMemoryFile(file, filename, folder = '') {
    this.#assertRemoteWritesAvailable();

    const objectPath = folder ? `${folder}/${filename}` : filename;

    if (this.shouldUseSupabase()) {
      await this.supabaseStorage.uploadObject(objectPath, file.buffer, file.mimetype);
    } else {
      const fs = require('fs');
      const path = require('path');
      const destDir = folder
        ? path.join(this.fileUploadService.uploadDir, folder)
        : this.fileUploadService.uploadDir;

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.writeFileSync(path.join(destDir, filename), file.buffer);
    }

    return this.fileUploadService.getPublicUrl(filename, folder);
  }

  /**
   * Delete object from Supabase (when configured) and local disk.
   * @param {string} objectPath - e.g. profile-pictures/{userId}.webp
   * @returns {Promise<void>}
   */
  async deleteObject(objectPath) {
    if (!objectPath) return;

    if (this.supabaseStorage?.isConfigured()) {
      await this.supabaseStorage.deleteObject(objectPath);
    }

    try {
      await this.fileUploadService.delete(objectPath);
    } catch {
      // local file may not exist in production-only Supabase setups
    }
  }
}

module.exports = HybridStorageService;
