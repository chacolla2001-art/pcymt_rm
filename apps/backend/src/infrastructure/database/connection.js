const { Sequelize } = require('sequelize');
const logger = require('../../shared/utils/logger.util');
const env = require('../../config/env');

const isServerless = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

// Configuration constants (tighter pool/retries on Vercel serverless)
const DB_CONFIG = Object.freeze({
  RETRY_ATTEMPTS: isServerless ? 2 : 5,
  RETRY_DELAY_MS: isServerless ? 1000 : 3000,
  POOL_MAX: isServerless
    ? 1
    : parseInt(process.env.DB_POOL_MAX, 10) || 10,
  POOL_MIN: isServerless
    ? 0
    : parseInt(process.env.DB_POOL_MIN, 10) || 2,
  POOL_ACQUIRE: isServerless ? 10000 : 30000,
  POOL_IDLE: isServerless ? 5000 : 10000,
});

/** @type {Promise<boolean>|null} */
let dbConnectPromise = null;

const connectionString = env.databaseUrl;
const isProduction = env.isProduction;
const isDevelopment = env.isDevelopment;

if (!connectionString && !env.dbHost) {
  logger.warn('No database configuration found. Using defaults.');
}

// Sequelize logging function - only log SQL if LOG_LEVEL is 'debug'
const sequelizeLogger = (process.env.LOG_LEVEL === 'debug')
  ? (sql, timing) => logger.debug(`[SQL] ${sql}`, { timing })
  : false;

const parseDatabaseUrl = (url) => {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 5432,
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, '') || 'postgres',
  };
};

// Determine if SSL is required
// SSL is only for cloud providers (Render, Railway, Neon, Supabase, etc.)
// Local PostgreSQL typically doesn't support SSL
const isCloudProvider = connectionString && (
  connectionString.includes('render.com') ||
  connectionString.includes('railway.app') ||
  connectionString.includes('neon.tech') ||
  connectionString.includes('supabase.co') ||
  connectionString.includes('pooler.supabase.com') ||
  connectionString.includes('amazonaws.com') ||
  connectionString.includes('azure.com')
);
const requiresSSL = connectionString?.includes('sslmode=require') ||
                    process.env.DB_SSL === 'true' ||
                    isCloudProvider;

// pg v8+ ignores rejectUnauthorized when using a connection string — parse URL for cloud DBs
const useParsedConfig = Boolean(requiresSSL && connectionString);

// Build Sequelize configuration
const sequelizeOptions = {
  dialect: 'postgres',
  protocol: 'postgres',
  logging: sequelizeLogger,
  pool: {
    max: DB_CONFIG.POOL_MAX,
    min: DB_CONFIG.POOL_MIN,
    acquire: DB_CONFIG.POOL_ACQUIRE,
    idle: DB_CONFIG.POOL_IDLE,
  },
  // Performance optimizations
  benchmark: isDevelopment,
  retry: {
    max: DB_CONFIG.RETRY_ATTEMPTS,
  },
  // SSL configuration for cloud providers (Neon, RDS, etc.)
  ...(requiresSSL && connectionString && {
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: env.dbSslRejectUnauthorized ?? false,
      },
    },
  }),
};

const sequelize = useParsedConfig
  ? new Sequelize({ ...parseDatabaseUrl(connectionString), ...sequelizeOptions })
  : connectionString
    ? new Sequelize(connectionString, sequelizeOptions)
    : new Sequelize({
      host: env.dbHost,
      database: env.dbName,
      username: env.dbUser,
      password: env.dbPassword,
      port: env.dbPort,
      ...sequelizeOptions,
    });

/**
 * Delay helper for retry logic
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Connect to the database with retry logic
 * @param {number} attempt - Current attempt number
 */
const connectDB = async (attempt = 1) => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Schema changes must be handled via migrations, never auto-alter on startup.
    if (isDevelopment) {
      logger.info('Development mode: automatic sequelize.sync() is disabled. Use migrations instead.');
    }

    return true;
  } catch (error) {
    logger.error(`Database connection attempt ${attempt} failed`, { error: error.message });

    if (attempt < DB_CONFIG.RETRY_ATTEMPTS) {
      logger.info(`Retrying database connection in ${DB_CONFIG.RETRY_DELAY_MS / 1000}s...`);
      await delay(DB_CONFIG.RETRY_DELAY_MS);
      return connectDB(attempt + 1);
    }

    logger.error('All database connection attempts failed');
    throw new Error(`Database connection failed after ${DB_CONFIG.RETRY_ATTEMPTS} attempts: ${error.message}`);
  }
};

/**
 * Close the database connection gracefully
 */
const closeDB = async () => {
  try {
    await sequelize.close();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection', { error: error.message });
    throw error;
  }
};

/**
 * Check database health
 * @returns {Promise<boolean>}
 */
const healthCheck = async () => {
  try {
    await sequelize.query('SELECT 1');
    return true;
  } catch (error) {
    logger.warn('Database health check failed', { error: error.message });
    return false;
  }
};

/**
 * Start DB connection in the background (serverless cold start).
 * Does not throw — failures are retried on the next ensureDB() call.
 */
const startDBConnection = () => {
  if (dbConnectPromise) {
    return dbConnectPromise;
  }

  dbConnectPromise = connectDB()
    .then(() => true)
    .catch((error) => {
      logger.error('Background database connection failed', { error: error.message });
      dbConnectPromise = null;
      return false;
    });

  return dbConnectPromise;
};

/**
 * Wait until the database is connected (used by serverless request middleware).
 * @returns {Promise<boolean>}
 */
const ensureDB = async () => {
  if (dbConnectPromise) {
    const result = await dbConnectPromise;
    if (result === true) {
      return true;
    }
  }

  dbConnectPromise = connectDB()
    .then(() => true)
    .catch((error) => {
      dbConnectPromise = null;
      throw error;
    });

  return dbConnectPromise;
};

module.exports = {
  sequelize,
  connectDB,
  closeDB,
  healthCheck,
  startDBConnection,
  ensureDB,
};
