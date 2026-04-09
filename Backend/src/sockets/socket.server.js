// src/sockets/socket.server.js
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { getRedisPub, getRedisSub } = require('../config/redis');
const { socketAuthMiddleware } = require('./socket.middleware');
const { registerHandlers } = require('./socket.handlers');
const env = require('../config/env');
const logger = require('../config/logger');

let io = null;

/**
 * Initialize Socket.io server.
 *
 * Why Redis adapter?
 * Without it: user A connects to Node instance 1, user B to instance 2.
 * io.to('user:B').emit() from instance 1 → does nothing (B is on instance 2).
 * With Redis adapter: emit is published to Redis → all instances relay it → reaches B.
 *
 * @param {import('http').Server} httpServer
 */
const initSocketServer = (httpServer) => {
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    // Ping settings: detect dead connections faster
    pingTimeout: 20000,   // 20s: close if no pong within 20s
    pingInterval: 25000,  // 25s: send ping every 25s

    // Transports: prefer WebSocket, fallback to polling
    transports: ['websocket', 'polling'],

    // Connection state recovery: store recent events in Redis
    // Allows clients to reconnect and receive missed events (up to 2 minutes)
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: false,
    },

    // Max HTTP buffer size (for binary messages — keep reasonable)
    maxHttpBufferSize: 1e6, // 1MB
  });

  // ── Redis adapter ──────────────────────────────────────────────────────────
  // Uses dedicated pub/sub Redis clients (can't reuse general client)
  const pubClient = getRedisPub();
  const subClient = getRedisSub();
  io.adapter(createAdapter(pubClient, subClient));
  logger.info('Socket.io Redis adapter attached');

  // ── Auth middleware ────────────────────────────────────────────────────────
  io.use(socketAuthMiddleware);

  // ── Connection handler ─────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    registerHandlers(socket, io);
  });

  logger.info('Socket.io server initialized');
  return io;
};

/**
 * Get the Socket.io server instance.
 * Used by notification worker + other services to emit events.
 */
const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized. Call initSocketServer() first.');
  return io;
};

/**
 * Emit a notification to a specific user (called from notification service).
 * Works across all Node.js instances via Redis adapter.
 *
 * @param {string} userId
 * @param {string} event - socket event name
 * @param {object} data
 */
const emitToUser = (userId, event, data) => {
  if (!io) return; // graceful degradation if socket not initialized
  io.to(`user:${userId}`).emit(event, data);
};

module.exports = { initSocketServer, getIO, emitToUser };