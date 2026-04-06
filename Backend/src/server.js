// src/server.js
require('dotenv').config(); // load .env FIRST before any other require

const env = require('./config/env');
const logger = require('./config/logger');
const { connectDB, disconnectDB } = require('./config/db');
const { connectRedis, disconnectRedis } = require('./config/redis');
const createApp = require('./app');
const { startEmailWorker } = require('./jobs/email.worker');
const { closeAllQueues } = require('./jobs/queue');

let server;

const bootstrap = async () => {
  try {
    logger.info(`Starting ${env.APP_NAME} in ${env.NODE_ENV} mode...`);

    // 1. Connect to databases BEFORE starting HTTP server
    //    If DB fails, we don't accept any requests
    await connectDB();
    await connectRedis();
    startEmailWorker();

    // 2. Create Express app (all middleware registered here)
    const app = createApp();

    // 3. Start HTTP server
    server = app.listen(env.PORT, () => {
      logger.info(`HTTP server running on port ${env.PORT}`, {
        port: env.PORT,
        pid: process.pid,
        node: process.version,
      });
    });

    // 4. Configure server timeouts
    server.keepAliveTimeout = 65000;  // > Nginx's 60s keepalive timeout
    server.headersTimeout = 66000;    // > keepAliveTimeout (Node.js default is 60s)

    logger.info('Bootstrap complete. Ready to accept connections.');
  } catch (err) {
    logger.error('Bootstrap failed', { error: err.message, stack: err.stack });
    process.exit(1);
  }
};

/**
 * Graceful shutdown handler.
 * Allows in-flight requests to complete before closing connections.
 * Critical for zero-downtime deployments.
 */
const shutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // 1. Stop accepting new connections
  server?.close(async () => {
    logger.info('HTTP server closed');

    try {
      // 2. Close DB connections (order matters — DB after server stops)
      await disconnectDB();
      await disconnectRedis();
      logger.info('Graceful shutdown complete');
      await closeAllQueues();
      process.exit(0);
    } catch (err) {
      logger.error('Shutdown error', { error: err.message });
      process.exit(1);
    }
  });

  // Force exit after 30s (in case some connection hangs)
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// ── Signal handlers ───────────────────────────────────────────────────────────
process.on('SIGTERM', () => shutdown('SIGTERM')); // Docker stop / K8s scale down
process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C in development

// ── Uncaught exception handler ────────────────────────────────────────────────
// These are programmer bugs — crash and let process manager restart
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION — shutting down', {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED PROMISE REJECTION — shutting down', {
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
  process.exit(1);
});

bootstrap();