// src/sockets/socket.middleware.js
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const logger = require('../config/logger');

/**
 * Socket.io authentication middleware.
 * Runs during the WebSocket handshake (before connection established).
 * Rejects unauthenticated sockets with an error.
 *
 * Client sends token in one of two ways:
 * 1. socket.auth.token = 'Bearer xxx' (recommended)
 * 2. query parameter: ?token=xxx (fallback for environments blocking headers)
 */
const socketAuthMiddleware = (socket, next) => {
  try {
    // Extract token from auth object or query params
    const authToken =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization ||
      socket.handshake.query?.token;

    if (!authToken) {
      return next(new Error('SOCKET_UNAUTHORIZED: No token provided'));
    }

    const token = authToken.startsWith('Bearer ')
      ? authToken.slice(7)
      : authToken;

    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'smart-marketplace',
      audience: 'smart-marketplace-client',
    });

    // Attach user payload to socket for use in all handlers
    socket.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };

    logger.debug('Socket authenticated', {
      socketId: socket.id,
      userId: decoded.sub,
    });

    next();
  } catch (err) {
    logger.warn('Socket auth failed', {
      socketId: socket.id,
      error: err.message,
    });
    next(new Error('SOCKET_UNAUTHORIZED: Invalid or expired token'));
  }
};

module.exports = { socketAuthMiddleware };