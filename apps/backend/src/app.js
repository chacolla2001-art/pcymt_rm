const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

const { env, container } = require('./config');
const { createRoutes } = require('./api');
const {
  errorMiddleware,
  apiLimiter,
  sanitizeInput,
  preventParameterPollution,
  securityHeaders,
  mediumTimeout,
  limitPayloadSize,
  authLimiter,
} = require('./api/middlewares');
const { connectDB, closeDB } = require('./infrastructure/database');
const logger = require('./shared/utils/logger.util');

/**
 * Create and configure Express application
 */
const createApp = () => {
  const app = express();

  // Hide framework details
  app.disable('x-powered-by');

  // Trust proxy (for rate limiting behind reverse proxy)
  app.set('trust proxy', 1);

  // Enforce HTTPS in production (behind trusted proxy)
  app.use((req, res, next) => {
    if (env.isProduction && !req.secure && req.get('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }
    next();
  });

  // Security middleware
  app.use(helmet({ crossOriginResourcePolicy: false }));
  if (env.isProduction) {
    app.use(helmet.hsts({ maxAge: 15552000, includeSubDomains: true }));
  }
  app.use(cors({
    origin: env.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    credentials: false,
    optionsSuccessStatus: 204,
  }));
  app.options('*', cors());
  app.use(securityHeaders);

  // Compression middleware
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6, // Balanced compression level
    threshold: 1024, // Only compress responses > 1KB
  }));

  // Logging with Winston — must be BEFORE rate limiting so every request
  // (including rate-limited 429s) is always visible in logs.
  app.use(morgan('dev', { stream: logger.stream }));

  // Rate limiting
  app.use('/api', apiLimiter);
  app.use('/api/v1/auth', authLimiter);

  // Request timeout
  app.use(mediumTimeout);

  // Limit raw payload size early (except for file upload routes)
  app.use((req, res, next) => {
    const contentLength = req.headers['content-length'];
    const contentType = req.headers['content-type'] || '';
    const isMultipart = contentType.includes('multipart/form-data');
    
    // Log upload requests for monitoring (debug level only)
    if (isMultipart) {
      const sizeMB = contentLength ? (parseInt(contentLength, 10) / (1024 * 1024)).toFixed(2) : 'unknown';
      logger.debug('Upload request received', {
        method: req.method,
        path: req.path,
        contentLength,
        sizeMB,
      });
    }
    
    // Skip payload limit for multipart/form-data requests (file uploads)
    if (isMultipart) {
      return next();
    }
    
    return limitPayloadSize('1mb')(req, res, next);
  });

  // Request parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Sanitization
  app.use(sanitizeInput);
  app.use(preventParameterPollution);

  // Backward compatibility: redirect old /uploads/* paths to protected /api/files/*
  // Previously files were served publicly via express.static.
  // Now all files are served through the authenticated /api/files endpoint.
  app.use('/uploads', (req, res) => {
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    res.redirect(301, `/api/files${req.path}${queryString}`);
  });

  // Health check endpoint with DB verification
  app.get('/health', async (req, res) => {
    const { healthCheck } = require('./infrastructure/database');

    const dbHealthy = await healthCheck();
    const status = dbHealthy ? 200 : 503;

    res.status(status).json({
      success: dbHealthy,
      message: dbHealthy ? 'Server is healthy' : 'Database connection failed',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: dbHealthy ? 'ok' : 'fail',
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB',
        },
      },
    });
  });

  // Initialize dependency container
  container.init();

  // API routes
  app.use('/api', createRoutes(container.getRouteContainer()));

  // Error handling
  app.use(errorMiddleware);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: `Route ${req.method} ${req.path} not found`,
    });
  });

  return app;
};

/**
 * Start the server
 */
const startServer = async () => {
  let server = null;

  try {
    // Connect to database
    await connectDB();

    // Create app
    const app = createApp();

    // Start listening
    server = app.listen(env.port, () => {
      logger.info(`[SERVER] Running on port ${env.port}`);
      logger.info(`[ENV] Environment: ${env.nodeEnv}`);

      if (env.databaseUrl) {
        try {
          const url = new URL(env.databaseUrl);
          logger.info(`[DB] Database: ${url.hostname}/${url.pathname.replace('/', '')}`);
        } catch {
          logger.info('[DB] Database: Connected');
        }
      } else {
        logger.info(`[DB] Database: ${env.dbHost}/${env.dbName}`);
      }
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // Close database connection
          await closeDB();
          logger.info('Database connection closed');

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.logError(error, { context: 'graceful shutdown' });
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (error) {
    logger.logError(error, { context: 'server startup' });
    process.exit(1);
  }
};

module.exports = {
  createApp,
  startServer,
};
