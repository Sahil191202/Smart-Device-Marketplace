// src/sockets/socket.handlers.js
const chatService = require('../modules/chat/chat.service');
const notificationRepository = require('../modules/notifications/notification.repository');
const { userRoom, chatRoom } = require('./socket.rooms');
const { createRateLimiter } = require('../shared/middleware/rateLimiter');
const { getRedisClient } = require('../config/redis');
const logger = require('../config/logger');

// ── Socket-level rate limiters ─────────────────────────────────────────────────
// Implemented with Redis sliding window (reuse the same logic)
// 30 messages per minute per user
const MESSAGE_RATE_LIMIT = 30;
const MESSAGE_RATE_WINDOW = 60 * 1000; // 1 minute

const checkMessageRateLimit = async (userId) => {
  const redis = getRedisClient();
  const key = `ratelimit:socket:chat:${userId}`;
  const now = Date.now();
  const windowStart = now - MESSAGE_RATE_WINDOW;

  const pipeline = redis.multi();
  pipeline.zRemRangeByScore(key, 0, windowStart);
  pipeline.zCard(key);
  pipeline.zAdd(key, { score: now, value: `${now}` });
  pipeline.expire(key, 60);

  const results = await pipeline.exec();
  const count = results[1];
  return count >= MESSAGE_RATE_LIMIT;
};

/**
 * Register all Socket.io event handlers for a connected socket.
 * Called once per connection after auth middleware passes.
 *
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
const registerHandlers = (socket, io) => {
  const userId = socket.user.id;

  // ── Join user's private room on connect ────────────────────────────────────
  socket.join(userRoom(userId));
  logger.debug('Socket connected', { socketId: socket.id, userId });

  // ── Set presence online ────────────────────────────────────────────────────
  chatService.setOnline(userId).catch(() => {});

  // Notify contacts that user came online (broadcast to relevant chat rooms)
  socket.broadcast.emit('presence:online', { userId });

  // ── CHAT EVENTS ────────────────────────────────────────────────────────────

  /**
   * Join a specific chat room.
   * Client must call this before sending messages to a room.
   *
   * Emits back: missed messages since last seen (reconnection support)
   */
  socket.on('chat:join', async ({ roomId, lastSeen }) => {
    try {
      // Verify participant
      const room = await chatService.getRoomById(roomId, userId);

      socket.join(chatRoom(roomId));
      logger.debug('User joined chat room', { userId, roomId });

      // Send missed messages if lastSeen timestamp provided (reconnection)
      if (lastSeen) {
        const missed = await chatService.getMissedMessages(roomId, userId, lastSeen);
        if (missed.length > 0) {
          socket.emit('chat:missed', { roomId, messages: missed });
        }
      }

      // Mark room as read when user joins
      const readMessageIds = await chatService.markRoomAsRead(roomId, userId);

      // Notify the other participant that messages were read
      if (readMessageIds.length > 0) {
        socket.to(chatRoom(roomId)).emit('chat:read', {
          roomId,
          readBy: userId,
          messageIds: readMessageIds,
        });
      }

      socket.emit('chat:joined', {
        roomId,
        room,
        unreadCount: 0,
      });
    } catch (err) {
      socket.emit('chat:error', {
        event: 'chat:join',
        message: err.message,
      });
    }
  });

  /**
   * Send a chat message.
   *
   * Flow:
   * 1. Rate limit check
   * 2. Store in MongoDB (durable)
   * 3. Emit to room (real-time)
   * 4. If recipient offline → in-app notification (already in DB from Phase 6)
   */
  socket.on('chat:send', async ({ roomId, content, type = 'text', media = null }) => {
    try {
      // Rate limit: 30 messages/minute
      const limited = await checkMessageRateLimit(userId);
      if (limited) {
        socket.emit('chat:error', {
          event: 'chat:send',
          message: 'Message rate limit exceeded. Please slow down.',
          code: 'RATE_LIMIT_EXCEEDED',
        });
        return;
      }

      // Store + get recipient
      const { message, otherParticipantId } = await chatService.sendMessage({
        roomId,
        senderId: userId,
        content,
        type,
        media,
      });

      // Populate sender for the emitted payload
      const payload = {
        roomId,
        message: {
          _id: message._id,
          roomId,
          content: message.content,
          type: message.type,
          media: message.media,
          senderId: {
            _id: userId,
            name: socket.user.name || '',
          },
          readBy: message.readBy,
          createdAt: message.createdAt,
        },
      };

      // Emit to everyone in the room (including sender — confirms delivery)
      io.to(chatRoom(roomId)).emit('chat:message', payload);

      // If recipient is NOT in the chat room (offline or on different page)
      // → send a notification ping to their private user room
      if (otherParticipantId) {
        const recipientSocketsInRoom = await io
          .in(chatRoom(roomId))
          .fetchSockets();

        const recipientInRoom = recipientSocketsInRoom.some(
          s => s.user?.id === otherParticipantId
        );

        if (!recipientInRoom) {
          // Ping recipient's private room with notification
          io.to(userRoom(otherParticipantId)).emit('notification:chat', {
            roomId,
            senderId: userId,
            senderName: socket.user.name,
            preview: type === 'text'
              ? content.slice(0, 60)
              : '📷 Sent an image',
          });
        }
      }
    } catch (err) {
      logger.error('chat:send error', { userId, roomId, error: err.message });
      socket.emit('chat:error', {
        event: 'chat:send',
        message: err.isOperational ? err.message : 'Failed to send message',
      });
    }
  });

  /**
   * Typing indicator — ephemeral, NOT stored in DB.
   * Broadcast to others in room only (not back to sender).
   */
  socket.on('chat:typing', ({ roomId, isTyping }) => {
    socket.to(chatRoom(roomId)).emit('chat:typing', {
      roomId,
      userId,
      isTyping: Boolean(isTyping),
    });
  });

  /**
   * Mark messages as read when user reads them in UI.
   */
  socket.on('chat:markRead', async ({ roomId }) => {
    try {
      const readMessageIds = await chatService.markRoomAsRead(roomId, userId);

      if (readMessageIds.length > 0) {
        // Notify sender their messages were read
        socket.to(chatRoom(roomId)).emit('chat:read', {
          roomId,
          readBy: userId,
          messageIds: readMessageIds,
        });
      }
    } catch (err) {
      logger.warn('chat:markRead error', { userId, roomId, error: err.message });
    }
  });

  /**
   * Leave a chat room (user navigates away from chat page).
   */
  socket.on('chat:leave', ({ roomId }) => {
    socket.leave(chatRoom(roomId));
    logger.debug('User left chat room', { userId, roomId });
  });

  // ── PRESENCE EVENTS ────────────────────────────────────────────────────────

  /**
   * Heartbeat — client sends every 25s to maintain online presence.
   */
  socket.on('presence:heartbeat', async () => {
    await chatService.refreshPresence(userId).catch(() => {});
  });

  /**
   * Check if specific users are online.
   */
  socket.on('presence:check', async ({ userIds }) => {
    try {
      if (!Array.isArray(userIds) || userIds.length > 50) return;
      const presence = await chatService.getPresenceBulk(userIds);
      socket.emit('presence:status', presence);
    } catch (err) {
      logger.warn('presence:check error', { error: err.message });
    }
  });

  // ── NOTIFICATION EVENTS ───────────────────────────────────────────────────

  /**
   * Client acknowledges receiving a notification.
   * Marks it as read in DB.
   */
  socket.on('notification:ack', async ({ notificationId }) => {
    try {
      await notificationRepository.markAsRead(notificationId, userId);
    } catch (err) {
      logger.warn('notification:ack error', { error: err.message });
    }
  });

  // ── DISCONNECT ────────────────────────────────────────────────────────────

  socket.on('disconnect', async (reason) => {
    logger.debug('Socket disconnected', { socketId: socket.id, userId, reason });

    // Check if user has other active sockets before marking offline
    // (user may have multiple tabs open)
    const socketsForUser = await io.in(userRoom(userId)).fetchSockets();
    const hasOtherSockets = socketsForUser.length > 0;

    if (!hasOtherSockets) {
      await chatService.setOffline(userId).catch(() => {});
      io.emit('presence:offline', { userId });
    }
  });

  // ── ERROR HANDLING ────────────────────────────────────────────────────────

  socket.on('error', (err) => {
    logger.error('Socket error', { socketId: socket.id, userId, error: err.message });
  });
};

module.exports = { registerHandlers };