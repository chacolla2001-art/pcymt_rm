/**
 * Main entry point for the new architecture
 * src/index.js
 */
const { startServer } = require('./app');
const logger = require('./shared/utils/logger.util');

// Handle uncaught exceptions — log but keep process alive in development
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Unhandled rejections: respond with 500 via error middleware when possible; avoid exit in dev
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Start the server
startServer();
