const HTTP_STATUS = require('./httpStatus');
const { ROLES, ROLE_VALUES } = require('./roles');

// System constants
const SYSTEM_USER = 'sistema';
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

// Cache TTL constants (milliseconds)
const CACHE_TTL = Object.freeze({
  SHORT: 60 * 1000,        // 1 minute
  MEDIUM: 5 * 60 * 1000,   // 5 minutes
  LONG: 30 * 60 * 1000,    // 30 minutes
  HOUR: 60 * 60 * 1000,    // 1 hour
  DAY: 24 * 60 * 60 * 1000, // 24 hours
});

// File upload constants
const UPLOAD = Object.freeze({
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENTS: ['application/pdf', 'application/msword'],
  ALLOWED_3D: ['.glb', '.gltf', '.obj', '.fbx'],
});

// Regex patterns for validation
const PATTERNS = Object.freeze({
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  PHONE: /^\+?[1-9]\d{1,14}$/,
  PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
});

// Error codes for client handling
const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

// Platform types for sessions
const PLATFORMS = Object.freeze({
  WEB: 'web',
  MOBILE: 'mobile',
  DESKTOP: 'desktop',
});
const PLATFORM_VALUES = Object.values(PLATFORMS);

// Interaction types
const INTERACTION_TYPES = Object.freeze({
  VIEW: 'view',
  CLICK: 'click',
  SCAN: 'scan',
  SHARE: 'share',
});
const INTERACTION_TYPE_VALUES = Object.values(INTERACTION_TYPES);

// Database configuration defaults
const DB_DEFAULTS = Object.freeze({
  POOL_MAX: 10,
  POOL_MIN: 2,
  POOL_ACQUIRE: 30000,
  POOL_IDLE: 10000,
  RETRY_ATTEMPTS: 5,
  RETRY_DELAY_MS: 3000,
});

// Rate limiting defaults (milliseconds)
const RATE_LIMITS = Object.freeze({
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100,
  AUTH_WINDOW_MS: 60 * 60 * 1000, // 1 hour
  AUTH_MAX_REQUESTS: 5,
  PASSWORD_RESET_WINDOW_MS: 60 * 60 * 1000,
  PASSWORD_RESET_MAX: 3,
});

module.exports = {
  HTTP_STATUS,
  ROLES,
  ROLE_VALUES,
  SYSTEM_USER,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  CACHE_TTL,
  UPLOAD,
  PATTERNS,
  ERROR_CODES,
  PLATFORMS,
  PLATFORM_VALUES,
  INTERACTION_TYPES,
  INTERACTION_TYPE_VALUES,
  DB_DEFAULTS,
  RATE_LIMITS,
};
