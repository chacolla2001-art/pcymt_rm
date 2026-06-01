const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const logger = require('../../shared/utils/logger.util');

const MIME_OVERRIDES = {
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.fbx': 'application/octet-stream',
};

/**
 * File Controller - Serves uploaded files through authenticated API endpoints
 *
 * Local disk is tried first (development). When the file is missing locally and
 * Supabase Storage is configured, the file is fetched from Supabase and streamed
 * to the client (production / Vercel).
 */
class FileController {
  /**
   * @param {string} uploadDir - Absolute path to the uploads directory
   * @param {import('../../infrastructure/external/supabaseStorage.service')|null} [supabaseStorage]
   */
  constructor(uploadDir, supabaseStorage = null) {
    this.uploadDir = uploadDir;
    this.resolvedUploadDir = path.resolve(uploadDir);
    this.supabaseStorage = supabaseStorage;
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

      const sanitizedName = path.basename(filename);
      if (sanitizedName !== filename) {
        return this._denyPathTraversal(req, res, { requestedFile: filename, sanitized: sanitizedName });
      }

      const resolvedPath = this._resolveLocalPath(sanitizedName);
      if (!resolvedPath) {
        return this._denyPathTraversal(req, res, { requestedFile: filename, reason: 'resolve check' });
      }

      if (this.supabaseStorage?.isConfigured()) {
        const served = await this._serveFromSupabase(req, res, sanitizedName);
        if (served) return;
      }

      if (this._localFileExists(resolvedPath)) {
        return this._sendLocalFile(res, resolvedPath, sanitizedName, next);
      }

      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
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

      const sanitizedFolder = path.basename(folder);
      const sanitizedName = path.basename(filename);

      if (sanitizedFolder !== folder || sanitizedName !== filename) {
        return this._denyPathTraversal(req, res, {
          requestedFolder: folder,
          requestedFile: filename,
        });
      }

      const resolvedPath = this._resolveLocalPath(sanitizedFolder, sanitizedName);
      if (!resolvedPath) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      const objectPath = `${sanitizedFolder}/${sanitizedName}`;

      if (this.supabaseStorage?.isConfigured()) {
        const served = await this._serveFromSupabase(req, res, objectPath, sanitizedName);
        if (served) return;
      }

      if (this._localFileExists(resolvedPath)) {
        return this._sendLocalFile(res, resolvedPath, sanitizedName, next);
      }

      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    } catch (error) {
      next(error);
    }
  };

  _resolveLocalPath(...segments) {
    const fullPath = path.join(this.resolvedUploadDir, ...segments);
    const resolvedPath = path.resolve(fullPath);

    if (!resolvedPath.startsWith(this.resolvedUploadDir)) {
      return null;
    }

    return resolvedPath;
  }

  _localFileExists(resolvedPath) {
    return fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile();
  }

  _denyPathTraversal(req, res, details) {
    logger.warn('Path traversal attempt blocked in file serving', {
      ...details,
      ip: req.ip,
      userId: req.user?.user_id,
    });
    return res.status(403).json({
      success: false,
      message: 'Access denied',
    });
  }

  _applyFileHeaders(res, filename) {
    const ext = path.extname(filename).toLowerCase();

    if (MIME_OVERRIDES[ext]) {
      res.type(MIME_OVERRIDES[ext]);
    }

    if (ext === '.glb' || ext === '.gltf') {
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
    }

    res.set({
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    });
  }

  _sendLocalFile(res, resolvedPath, filename, next) {
    this._applyFileHeaders(res, filename);
    return res.sendFile(resolvedPath, (err) => {
      if (err && !res.headersSent) {
        if (next) {
          next(err);
        } else {
          res.status(404).json({ success: false, message: 'File not found' });
        }
      }
    });
  }

  /**
   * @returns {Promise<boolean>} true if the file was streamed to the client
   */
  async _serveFromSupabase(req, res, objectPath, downloadName = objectPath) {
    if (!this.supabaseStorage?.isConfigured()) {
      return false;
    }

    const remoteResponse = await this.supabaseStorage.fetchObject(objectPath);
    if (!remoteResponse) {
      logger.debug('File not found in Supabase Storage', {
        objectPath,
        userId: req.user?.user_id,
      });
      return false;
    }

    // Vercel caps serverless response bodies (~4.5 MB). Redirect after auth for oversized files.
    if (process.env.VERCEL) {
      const contentLength = Number(remoteResponse.headers.get('content-length') || 0);
      const redirectThreshold = 4 * 1024 * 1024;

      if (contentLength > redirectThreshold) {
        const publicUrl = this.supabaseStorage.buildPublicUrl(objectPath);
        if (publicUrl) {
          remoteResponse.body?.cancel?.();
          res.redirect(302, publicUrl);
          return true;
        }
      }
    }

    const filename = path.basename(downloadName);
    this._applyFileHeaders(res, filename);

    const remoteContentType = remoteResponse.headers.get('content-type');
    if (remoteContentType && !MIME_OVERRIDES[path.extname(filename).toLowerCase()]) {
      res.type(remoteContentType);
    }

    const contentLength = remoteResponse.headers.get('content-length');
    if (contentLength) {
      res.set('Content-Length', contentLength);
    }

    if (!remoteResponse.body) {
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          message: 'Unable to stream file from storage',
        });
      }
      return true;
    }

    const nodeStream = Readable.fromWeb(remoteResponse.body);
    nodeStream.on('error', (err) => {
      logger.error('Error streaming file from Supabase Storage', {
        objectPath,
        error: err.message,
      });
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          message: 'Unable to stream file from storage',
        });
      } else {
        res.destroy(err);
      }
    });

    nodeStream.pipe(res);
    return true;
  }
}

module.exports = FileController;
