/**
 * Main entry point for the new architecture
 * src/index.js
 */
const { startServer } = require('./app');
const logger = require('./shared/utils/logger.util');

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise: String(promise) });
  process.exit(1);
});

// Start the server
startServer();
