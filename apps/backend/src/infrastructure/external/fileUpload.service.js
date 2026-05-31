const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Allowed MIME types for uploads
const ALLOWED_MIMES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'model/gltf-binary',
  'model/gltf+json',
  'application/octet-stream', // For .glb files
]);

const ALLOWED_EXTENSIONS = /\.(glb|gltf|jpg|jpeg|png|gif|webp)$/i;

// Magic bytes (file signatures) for file type verification
const MAGIC_BYTES = Object.freeze({
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header
  'model/gltf-binary': [0x67, 0x6C, 0x54, 0x46], // glTF
});

/**
 * File upload service using Multer
 * Handles file storage, validation, and cleanup
 */
class FileUploadService {
  constructor(uploadDir = './uploads') {
    this.uploadDir = uploadDir;
    this.#ensureUploadDir();
  }

  #ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Create storage configuration
   * @param {string} folder - Subfolder within upload directory
   * @returns {multer.StorageEngine}
   */
  #createStorage(folder = '') {
    const destination = folder ? path.join(this.uploadDir, folder) : this.uploadDir;

    return multer.diskStorage({
      destination: (req, file, cb) => {
        if (!fs.existsSync(destination)) {
          fs.mkdirSync(destination, { recursive: true });
        }
        cb(null, destination);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      },
    });
  }

  /**
   * Create a single file upload middleware
   * @param {string} fieldName - Form field name
   * @param {object} options - Upload options
   * @returns {Function} Multer middleware
   */
  single(fieldName, options = {}) {
    const storage = this.#createStorage(options.folder);
    const upload = multer({
      storage,
      limits: {
        fileSize: options.maxSize || 10 * 1024 * 1024, // Default 10MB
      },
      fileFilter: options.fileFilter || this.#defaultFileFilter,
    });

    return upload.single(fieldName);
  }

  /**
   * Create an array upload middleware (multiple files, same field)
   * @param {string} fieldName - Form field name
   * @param {number} maxCount - Maximum number of files
   * @param {object} options - Upload options
   * @returns {Function} Multer middleware
   */
  array(fieldName, maxCount = 10, options = {}) {
    const storage = this.#createStorage(options.folder);
    const upload = multer({
      storage,
      limits: {
        fileSize: options.maxSize || 50 * 1024 * 1024,
      },
      fileFilter: options.fileFilter || this.#defaultFileFilter,
    });

    return upload.array(fieldName, maxCount);
  }

  /**
   * Create a multiple files upload middleware
   * @param {Array} fields - Array of field configurations
   * @param {object} options - Upload options
   * @returns {Function} Multer middleware
   */
  fields(fields, options = {}) {
    const storage = this.#createStorage(options.folder);
    const upload = multer({
      storage,
      limits: {
        fileSize: options.maxSize || 50 * 1024 * 1024, // Default 50MB
      },
      fileFilter: options.fileFilter || this.#defaultFileFilter,
    });

    return upload.fields(fields);
  }

  /**
   * Default file filter (allow common image types and 3D models)
   * Uses arrow function to maintain proper context
   * @private
   */
  #defaultFileFilter = (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype) || ALLOWED_EXTENSIONS.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  };

  /**
   * Get public URL for an uploaded file
   * Returns a path through the authenticated API endpoint
   * @param {string} filename - Filename
   * @param {string} folder - Subfolder
   * @returns {string} Public URL path via API
   */
  getPublicUrl(filename, folder = '') {
    return folder ? `/api/files/${folder}/${filename}` : `/api/files/${filename}`;
  }

  /**
   * Verify file content matches declared MIME type using magic bytes
   * @param {string} filePath - Path to uploaded file
   * @param {string} declaredMime - MIME type declared by client
   * @returns {Promise<boolean>} True if file content matches MIME type
   */
  async verifyFileContent(filePath, declaredMime) {
    try {
      const expectedBytes = MAGIC_BYTES[declaredMime];
      if (!expectedBytes) {
        // No magic bytes defined for this type, allow it
        return true;
      }

      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(expectedBytes.length);
      fs.readSync(fd, buffer, 0, expectedBytes.length, 0);
      fs.closeSync(fd);

      return expectedBytes.every((byte, i) => buffer[i] === byte);
    } catch (error) {
      const logger = require('../../shared/utils/logger.util');
      logger.warn('File content verification failed', { filePath, error: error.message });
      return false;
    }
  }

  /**
   * Sanitize filename to prevent path traversal
   * @param {string} filename - Original filename
   * @returns {string} Sanitized filename
   */
  sanitizeFilename(filename) {
    return path.basename(filename)
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars
      .substring(0, 255); // Limit length
  }

  /**
   * Delete a file
   * @param {string} filePath - Path to file
   */
  async delete(filePath) {
    // Prevent path traversal attacks
    const sanitized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(this.uploadDir, sanitized.replace('/uploads/', ''));

    // Ensure the resolved path is within uploadDir
    const resolvedPath = path.resolve(fullPath);
    const resolvedUploadDir = path.resolve(this.uploadDir);

    if (!resolvedPath.startsWith(resolvedUploadDir)) {
      throw new Error('Invalid file path');
    }

    if (fs.existsSync(resolvedPath)) {
      fs.unlinkSync(resolvedPath);
    }
  }
}

module.exports = FileUploadService;
