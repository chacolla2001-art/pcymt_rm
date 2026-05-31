const path = require('path');

/**
 * Load .env file
 */
const loadEnvFile = () => {
  const envPath = path.resolve(process.cwd(), '.env');

  // Suppress dotenv tips
  const originalLog = console.log;
  console.log = (...args) => {
    const msg = args[0];
    if (typeof msg === 'string' && msg.includes('[dotenv@')) return;
    originalLog.apply(console, args);
  };

  const result = require('dotenv').config({ path: envPath });
  console.log = originalLog;

  if (result.error) {
    const required = ['DATABASE_URL', 'JWT_SECRET'];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      console.error('[ENV] ERROR: .env file not found!');
      console.error('[ENV] ACTION: Copy .env.example to .env and configure your secrets');
      process.exit(1);
    }
    // Cloud deploy (Vercel, Render, etc.) — vars injected via platform env
    return;
  }

  // Validate critical environment variables
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`[ENV] ERROR: Missing required variables: ${missing.join(', ')}`);
    process.exit(1);
  }
};

loadEnvFile();

/**
 * Environment configuration
 */
const env = {
  // Server
  port: parseInt(process.env.PORT, 10) || 5000,

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // JWT
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // Email
  emailUser: process.env.EMAIL_USER || process.env.MAIL_USER,
  emailPass: process.env.EMAIL_PASS || process.env.MAIL_PASS,
  emailFrom: process.env.EMAIL_FROM || process.env.MAIL_FROM,
  // SMTP / service options (optional)
  emailService: process.env.EMAIL_SERVICE || process.env.MAIL_SERVICE, // e.g. 'Gmail' or other
  emailHost: process.env.EMAIL_HOST || process.env.MAIL_HOST, // SMTP host (overrides service)
  emailPort: (() => {
    const rawPort = process.env.EMAIL_PORT || process.env.MAIL_PORT;
    return rawPort ? parseInt(rawPort, 10) : undefined;
  })(),
  emailSecure: (() => {
    const rawSecure = process.env.EMAIL_SECURE ?? process.env.MAIL_SECURE;
    return rawSecure === 'true';
  })(), // true for TLS
  emailTlsRejectUnauthorized: (() => {
    const rawTls = process.env.EMAIL_TLS_REJECT_UNAUTHORIZED ?? process.env.MAIL_TLS_REJECT_UNAUTHORIZED;
    if (rawTls === undefined) return false;
    return rawTls === 'true';
  })(),
  emailConnectionTimeout: parseInt(process.env.EMAIL_CONNECTION_TIMEOUT_MS || process.env.MAIL_CONNECTION_TIMEOUT_MS, 10) || 10000,
  emailGreetingTimeout: parseInt(process.env.EMAIL_GREETING_TIMEOUT_MS || process.env.MAIL_GREETING_TIMEOUT_MS, 10) || 10000,
  emailSocketTimeout: parseInt(process.env.EMAIL_SOCKET_TIMEOUT_MS || process.env.MAIL_SOCKET_TIMEOUT_MS, 10) || 15000,
  // OAuth2 for Gmail (optional) - prefer this over plain password when possible
  emailOauthClientId: process.env.EMAIL_OAUTH_CLIENT_ID,
  emailOauthClientSecret: process.env.EMAIL_OAUTH_CLIENT_SECRET,
  emailOauthRefreshToken: process.env.EMAIL_OAUTH_REFRESH_TOKEN,
  emailOauthAccessToken: process.env.EMAIL_OAUTH_ACCESS_TOKEN,

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,

  // Google Maps
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,

  // ARCore Cloud Anchors
  cloudAnchorTtlDays: Math.min(365, Math.max(1, parseInt(process.env.CLOUD_ANCHOR_TTL_DAYS, 10) || 1)),
  arcoreServiceAccountKeyFile: process.env.ARCORE_SERVICE_ACCOUNT_KEY_FILE || null,

  // CORS
  corsOrigin: (() => {
    const origin = process.env.CORS_ORIGIN;
    if (!origin) return '*';
    if (origin.includes(',')) {
      return origin.split(',').map(o => o.trim());
    }
    return origin;
  })(),

  // Upload
  uploadDir: process.env.UPLOAD_DIR || path.resolve(__dirname, '..', '..', '..', '..', 'shared', 'uploads'),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 50 * 1024 * 1024,

  // Supabase Storage (proxy /api/files/* in production when local disk is unavailable)
  supabaseUrl: (() => {
    const explicit = process.env.SUPABASE_URL;
    if (explicit) return explicit.replace(/\/$/, '');
    const ref = process.env.SUPABASE_PROJECT_REF;
    if (ref) return `https://${ref}.supabase.co`;
    return null;
  })(),
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'uploads',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || null,

  // Admin credentials
  adminEmail: process.env.ADMIN_EMAIL,
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH,

  // Rate limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Redis Cache
  redisUrl: process.env.REDIS_URL,

  // Environment detection
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  nodeEnv: process.env.NODE_ENV || 'development',
};

// ─── Runtime config overrides (persisted via PUT /api/config) ───
const fs = require('fs');
const RUNTIME_CONFIG_PATH = path.resolve(process.cwd(), 'runtime-config.json');

/**
 * Load persisted runtime config overrides on startup.
 * These values take priority over .env defaults.
 */
const loadRuntimeConfig = () => {
  try {
    if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf8'));
      if (data.cloudAnchorTtlDays != null) {
        const ttl = parseInt(data.cloudAnchorTtlDays, 10);
        if (!isNaN(ttl) && ttl >= 1 && ttl <= 365) {
          env.cloudAnchorTtlDays = ttl;
        }
      }
    }
  } catch {
    // Silently ignore — .env value is used as fallback
  }
};

/**
 * Persist a runtime config override to disk.
 * @param {string} key
 * @param {*} value
 */
const saveRuntimeConfig = (key, value) => {
  let data = {};
  try {
    if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
      data = JSON.parse(fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf8'));
    }
  } catch {
    data = {};
  }
  data[key] = value;
  fs.writeFileSync(RUNTIME_CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
};

loadRuntimeConfig();

env.saveRuntimeConfig = saveRuntimeConfig;

module.exports = env;
