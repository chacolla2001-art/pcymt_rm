const winston = require('winston');
const path = require('path');

/**
 * Custom log format with timestamp and colorization
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }

    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  }),
);

/**
 * Console format with colors for development
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  logFormat,
);

/**
 * Create transports based on environment
 */
const createTransports = () => {
  const transports = [
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.LOG_LEVEL || 'debug',
    }),
  ];

  // Add file transports in production
  if (process.env.NODE_ENV === 'production') {
    const logsDir = path.join(process.cwd(), 'logs');

    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    );
  }

  return transports;
};

/**
 * Winston logger instance
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: createTransports(),
  exitOnError: false,
});

/**
 * HTTP request logger for Morgan integration
 */
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

/**
 * Log database queries in development
 */
logger.sql = (query) => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`SQL: ${query}`);
  }
};

/**
 * Log API requests with context
 */
logger.request = (req, message = 'API Request') => {
  logger.info(message, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userId: req.user?.id || 'anonymous',
  });
};

/**
 * Log errors with full context
 */
logger.logError = (error, context = {}) => {
  logger.error(error.message, {
    ...context,
    stack: error.stack,
    name: error.name,
    code: error.code,
  });
};

module.exports = logger;
