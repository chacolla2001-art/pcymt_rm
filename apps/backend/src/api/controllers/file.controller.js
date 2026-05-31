const path = require('path');
const fs = require('fs');
const logger = require('../../shared/utils/logger.util');

/**
 * File Controller - Serves uploaded files through authenticated API endpoints
 *
 * Instead of exposing files via express.static (public),
 * this controller requires authentication and serves files
 * using res.sendFile() with path traversal protection.
 */
class FileController {
  /**
   * @param {string} uploadDir - Absolute path to the uploads directory
   */
  constructor(uploadDir) {
    this.uploadDir = uploadDir;
    this.resolvedUploadDir = path.resolve(uploadDir);
  }

  /**
   * Serve a file from the uploads directory
   * GET /api/files/:filename
   *
   * Supports token authentication via:
   *   - Authorization: Bearer <token> (header)
   *   - ?token=<jwt> (query parameter, for <img> tags)
   */
  serve = async (req, res, next) => {
    try {
      const { filename } = req.params;

      if (!filename) {
        return res.status(400).json({
          success: false,
          message: 'File name is required',
        });
      }

      // Sanitize: only allow the basename (no slashes, no path traversal)
      const sanitizedName = path.basename(filename);

      if (sanitizedName !== filename) {
        logger.warn('Path traversal attempt blocked in file serving', {
          requestedFile: filename,
          sanitized: sanitizedName,
          ip: req.ip,
          userId: req.user?.user_id,
        });
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      const fullPath = path.join(this.resolvedUploadDir, sanitizedName);
      const resolvedPath = path.resolve(fullPath);

      // Double-check the resolved path is within the upload directory
      if (!resolvedPath.startsWith(this.resolvedUploadDir)) {
        logger.warn('Path traversal attempt blocked (resolve check)', {
          requestedFile: filename,
          resolvedPath,
          ip: req.ip,
          userId: req.user?.user_id,
        });
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      // Check file existence
      if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
        return res.status(404).json({
          success: false,
          message: 'File not found',
        });
      }

      // MIME type overrides for formats not in Express's default MIME database
      const mimeOverrides = {
        '.glb': 'model/gltf-binary',
        '.gltf': 'model/gltf+json',
        '.fbx': 'application/octet-stream',
      };
      const ext = path.extname(resolvedPath).toLowerCase();
      if (mimeOverrides[ext]) {
        res.type(mimeOverrides[ext]);
      }

      // Set cache and security headers
      res.set({
        'Cache-Control': 'private, max-age=86400', // 1 day, private (requires auth)
        'X-Content-Type-Options': 'nosniff',
      });

      return res.sendFile(resolvedPath);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Serve a file from a subdirectory within uploads
   * GET /api/files/:folder/:filename
   */
  serveFromFolder = async (req, res, next) => {
    try {
      const { folder, filename } = req.params;

      if (!folder || !filename) {
        return res.status(400).json({
          success: false,
          message: 'Folder and file name are required',
        });
      }

      // Sanitize both folder and filename
      const sanitizedFolder = path.basename(folder);
      const sanitizedName = path.basename(filename);

      if (sanitizedFolder !== folder || sanitizedName !== filename) {
        logger.warn('Path traversal attempt blocked in folder file serving', {
          requestedFolder: folder,
          requestedFile: filename,
          ip: req.ip,
          userId: req.user?.user_id,
        });
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      const fullPath = path.join(this.resolvedUploadDir, sanitizedFolder, sanitizedName);
      const resolvedPath = path.resolve(fullPath);

      // Verify resolved path is within uploads directory
      if (!resolvedPath.startsWith(this.resolvedUploadDir)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      // Check file existence
      if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
        return res.status(404).json({
          success: false,
          message: 'File not found',
        });
      }

      // MIME type overrides for formats not in Express's default MIME database
      const ext = path.extname(resolvedPath).toLowerCase();
      const mimeOverrides = {
        '.glb': 'model/gltf-binary',
        '.gltf': 'model/gltf+json',
        '.fbx': 'application/octet-stream',
      };
      if (mimeOverrides[ext]) {
        res.type(mimeOverrides[ext]);
      }

      res.set({
        'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      });

      return res.sendFile(resolvedPath);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = FileController;
