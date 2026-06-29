'use strict';

const fs = require('fs');
const { ValidationError } = require('../../shared/errors');
const {
  PROFILE_PICTURE_FOLDER,
  MAX_PROFILE_PICTURE_BYTES,
  buildProfilePictureApiUrl,
  buildProfilePictureObjectPath,
  isCustomProfilePictureUrl,
  avatarUrlToStoragePath,
} = require('../../shared/utils/avatar.util');
const logger = require('../../shared/utils/logger.util');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROFILE_PICTURE_MAX_EDGE = 512;
const PROFILE_PICTURE_WEBP_QUALITY = 85;

/**
 * Profile picture pipeline: validate → resize/WebP → persist (local or Supabase) → canonical URL.
 *
 * Storage layout (Supabase bucket `uploads`):
 *   profile-pictures/{userId}.webp   — one canonical object per user (upsert on change)
 *   model-icons/*.png                — predefined avatars (static, separate script)
 */
class ProfilePictureService {
  /**
   * @param {import('../../infrastructure/external/hybridStorage.service')} hybridStorage
   * @param {import('../../infrastructure/external/fileUpload.service')} fileUploadService
   */
  constructor(hybridStorage, fileUploadService) {
    this.hybridStorage = hybridStorage;
    this.fileUploadService = fileUploadService;
  }

  /**
   * @param {string} userId
   * @returns {string}
   */
  getCanonicalUrl(userId) {
    this.#assertUserId(userId);
    return buildProfilePictureApiUrl(userId);
  }

  /**
   * Upload and process a profile picture for a user.
   * @param {string} userId
   * @param {{ buffer?: Buffer, path?: string, mimetype: string, size?: number }} file
   * @returns {Promise<string>} Canonical API path
   */
  async uploadForUser(userId, file) {
    this.#assertUserId(userId);

    const buffer = await this.#readFileBuffer(file);
    const declaredMime = file.mimetype;

    if (buffer.length > MAX_PROFILE_PICTURE_BYTES) {
      throw new ValidationError('Profile picture exceeds maximum size', [
        { field: 'profile_picture_url', message: 'Image must be 5 MB or smaller' },
      ]);
    }

    const isValid = await this.fileUploadService.verifyBufferContent(buffer, declaredMime);
    if (!isValid) {
      throw new ValidationError('Invalid image file content', [
        { field: 'profile_picture_url', message: 'File content does not match declared image type' },
      ]);
    }

    const processed = await this.#processImage(buffer);
    const filename = `${userId}.webp`;
    const objectPath = buildProfilePictureObjectPath(userId);

    await this.hybridStorage.persistBuffer(processed, {
      filename,
      folder: PROFILE_PICTURE_FOLDER,
      contentType: 'image/webp',
      objectPath,
    });

    return buildProfilePictureApiUrl(userId);
  }

  /**
   * Remove a custom profile picture from storage (local + Supabase when configured).
   * No-op for predefined avatars, Google URLs, or empty values.
   * @param {string|null|undefined} avatarUrl
   */
  async deleteIfCustom(avatarUrl) {
    if (!avatarUrl || !isCustomProfilePictureUrl(avatarUrl)) return;

    const storagePath = avatarUrlToStoragePath(avatarUrl);
    if (!storagePath) return;

    try {
      await this.hybridStorage.deleteObject(storagePath);
    } catch (error) {
      logger.warn('Failed to delete profile picture from storage', {
        storagePath,
        error: error.message,
      });
    }
  }

  #assertUserId(userId) {
    if (!userId || !UUID_RE.test(userId)) {
      throw new ValidationError('Invalid user id for profile picture', [
        { field: 'userId', message: 'Invalid user id' },
      ]);
    }
  }

  async #readFileBuffer(file) {
    if (file.buffer && Buffer.isBuffer(file.buffer)) {
      return file.buffer;
    }

    if (file.path) {
      try {
        return fs.readFileSync(file.path);
      } finally {
        try {
          fs.unlinkSync(file.path);
        } catch {
          // ignore ephemeral cleanup
        }
      }
    }

    throw new ValidationError('No image data provided', [
      { field: 'profile_picture_url', message: 'No image provided' },
    ]);
  }

  /**
   * Resize, auto-orient, strip metadata, convert to WebP.
   * Falls back to original buffer if sharp is unavailable.
   * @param {Buffer} buffer
   * @returns {Promise<Buffer>}
   */
  async #processImage(buffer) {
    try {
      const sharp = require('sharp');
      return await sharp(buffer)
        .rotate()
        .resize(PROFILE_PICTURE_MAX_EDGE, PROFILE_PICTURE_MAX_EDGE, {
          fit: 'cover',
          position: 'centre',
        })
        .webp({ quality: PROFILE_PICTURE_WEBP_QUALITY })
        .toBuffer();
    } catch (error) {
      logger.warn('Profile picture processing fallback (sharp unavailable or failed)', {
        error: error.message,
      });
      return buffer;
    }
  }
}

module.exports = ProfilePictureService;
