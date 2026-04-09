// src/server.js
require('dotenv').config(); // load .env FIRST before any other require

const http = require('http');
const env = require('./config/env');
const logger = require('./config/logger');
const { connectDB, disconnectDB } = require('./config/db');
const { connectRedis, disconnectRedis } = require('./config/redis');
const createApp = require('./app');
const { startEmailWorker } = require('./jobs/email.worker');
const { startAIWorker } = require('./jobs/ai.worker');
const { closeAllQueues } = require('./jobs/queue');
const { startNotificationWorker } = require('./jobs/notification.worker');
const { startPriceDropScheduler } = require('./jobs/priceDropScheduler');
const { startCacheJobs } = require('./jobs/cacheWarmer');
const cacheManager = require('./shared/cache/cache.manager');
const { initSocketServer } = require('./sockets/socket.server');

let server;

const bootstrap = async () => {
  try {
    logger.info(`Starting ${env.APP_NAME} in ${env.NODE_ENV} mode...`);

    // 1. Connect databases FIRST — workers need Redis, routes need MongoDB
    await connectDB();
    await connectRedis();

    // 2. Create Express app (registers all middleware + routes)
    const app = createApp();

    // 3. Create raw HTTP server — required for Socket.io to share the same port
    //    app.listen() creates an HTTP server internally but doesn't expose it.
    //    Socket.io needs the raw http.Server reference to attach its engine.
    server = http.createServer(app);

    // 4. Attach Socket.io to HTTP server (BEFORE server.listen())
    //    Must happen before listen so Socket.io is ready when first connection arrives
    initSocketServer(server);

    // 5. Start background workers (DB + Redis are confirmed up at this point)
    startEmailWorker();
    startAIWorker();
    startNotificationWorker();
    await startPriceDropScheduler(); // async: registers repeatable Bull jobs in Redis
    await startCacheJobs();          // async: registers repeatable cache jobs in Redis

    // 6. Start listening
    server.listen(env.PORT, () => {
      logger.info(`HTTP server running on port ${env.PORT}`, {
        port: env.PORT,
        pid: process.pid,
        node: process.version,
      });
    });

    // 7. Configure timeouts AFTER server creation
    //    keepAliveTimeout must be > Nginx's keepalive_timeout (default 60s)
    //    headersTimeout must be > keepAliveTimeout
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // 8. Warm cache after server is confirmed listening (non-blocking)
    //    'listening' fires once the port is bound — DB is definitely up here
    server.on('listening', () => {
      cacheManager.warmProductCache().catch((err) => {
        logger.warn('Cache warm failed on startup', { error: err.message });
      });
    });

    logger.info('Bootstrap complete. Ready to accept connections.');
  } catch (err) {
    logger.error('Bootstrap failed', { error: err.message, stack: err.stack });
    process.exit(1);
  }
};

/**
 * Graceful shutdown handler.
 *
 * Shutdown order matters:
 * 1. Stop accepting new HTTP + WebSocket connections
 * 2. Close Bull queues (let in-flight jobs finish)
 * 3. Disconnect MongoDB (flush any pending writes)
 * 4. Disconnect Redis (after queues — Bull uses Redis internally)
 *
 * 30s hard timeout: if something hangs, force kill.
 * Docker sends SIGTERM on `docker stop`, waits 10s, then SIGKILL.
 * Set Docker stop_grace_period to 35s to give this handler time.
 */
const shutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Force kill after 30s regardless (prevents zombie process)
  const forceKillTimer = setTimeout(() => {
    logger.error('Forced shutdown after timeout — some connections may have been dropped');
    process.exit(1);
  }, 30000);

  // Don't let this timer keep the process alive
  forceKillTimer.unref();

  // Stop accepting new connections (existing ones finish naturally)
  server?.close(async () => {
    logger.info('HTTP server closed — no new connections accepted');

    try {
      // Close in dependency order:
      // Queues first (they depend on Redis) → then DB → then Redis
      await closeAllQueues();
      await disconnectDB();
      await disconnectRedis();

      logger.info('Graceful shutdown complete');
      clearTimeout(forceKillTimer);
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown sequence', { error: err.message });
      process.exit(1);
    }
  });
};

// ── OS signal handlers ────────────────────────────────────────────────────────
process.on('SIGTERM', () => shutdown('SIGTERM')); // Docker stop / K8s pod termination
process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C in development

// ── Unhandled error handlers ──────────────────────────────────────────────────
// These indicate programmer bugs (not operational errors).
// Crash fast — let Docker/PM2/K8s restart the process cleanly.

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