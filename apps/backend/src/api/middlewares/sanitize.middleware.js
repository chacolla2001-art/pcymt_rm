const hpp = require('hpp');

/**
 * Request sanitization middleware
 * Protects against common injection attacks including XSS and NoSQL injection
 */

/**
 * XSS dangerous patterns to sanitize
 */
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
  /javascript:/gi, // JavaScript protocol
  /on\w+\s*=/gi, // Event handlers (onclick, onerror, etc.)
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, // Iframe tags
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, // Object tags
  /<embed\b[^>]*>/gi, // Embed tags
  /data:/gi, // Data URLs (can be used for XSS)
  /vbscript:/gi, // VBScript protocol
];

/**
 * Sanitize string for XSS prevention
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeXSS = (str) => {
  if (typeof str !== 'string') {
    return str;
  }

  let sanitized = str;

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove dangerous XSS patterns
  for (const pattern of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Encode HTML entities for common dangerous characters
  sanitized = sanitized
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return sanitized.trim();
};

/**
 * Sanitize request body, query and params
 * Removes null bytes, XSS patterns, and potential NoSQL injection patterns
 */
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj, depth = 0) => {
    // Prevent deep recursion attacks
    if (depth > 10) {
      return obj;
    }

    if (typeof obj !== 'object' || obj === null) {
      return typeof obj === 'string' ? sanitizeXSS(obj) : obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => sanitize(item, depth + 1));
    }

    // Handle objects
    const sanitized = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Sanitize the key as well (prevent prototype pollution)
        const safeKey = key.replace(/[^\w.-]/g, '');
        if (safeKey === '__proto__' || safeKey === 'constructor' || safeKey === 'prototype') {
          continue; // Skip dangerous keys
        }
        sanitized[safeKey] = sanitize(obj[key], depth + 1);
      }
    }

    return sanitized;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
};

/**
 * Prevent HTTP Parameter Pollution
 * Allows only the last value for duplicate parameters
 * Whitelist common parameters that can be arrays
 */
const preventParameterPollution = hpp({
  whitelist: [
    'sort',
    'fields',
    'page',
    'limit',
    'status',
    'role',
    'type',
    'ids',
  ],
});

/**
 * Limit request body size
 * Prevents denial of service through large payloads
 */
const limitPayloadSize = (maxSize = '10kb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'], 10);
    const maxBytes = parseSize(maxSize);

    if (contentLength > maxBytes) {
      return res.status(413).json({
        success: false,
        message: 'Request payload too large',
      });
    }

    next();
  };
};

/**
 * Parse size string to bytes
 * @param {string} size - Size string like '10kb', '1mb'
 * @returns {number} Size in bytes
 */
const parseSize = (size) => {
  if (typeof size === 'number') {
    return size;
  }

  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)?$/);
  if (!match) {
    return 10 * 1024;
  } // Default 10kb

  const value = parseInt(match[1], 10);
  const unit = match[2] || 'b';

  return value * units[unit];
};

/**
 * Add security headers beyond helmet defaults
 */
const securityHeaders = (req, res, next) => {
  // Prevent caching of sensitive data
  if (req.path.includes('/api/')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
  }

  next();
};

module.exports = {
  sanitizeInput,
  preventParameterPollution,
  limitPayloadSize,
  securityHeaders,
};
