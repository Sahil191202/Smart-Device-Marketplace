// src/sockets/socket.rooms.js
const crypto = require('crypto');

/**
 * Generate a deterministic chat room ID.
 *
 * Why deterministic?
 * - If buyer opens chat with seller for product X, we want the SAME room
 *   whether buyer or seller initiates.
 * - Sort participant IDs alphabetically → same result regardless of order
 * - Include productId → same buyer+seller can have multiple chats (different products)
 *
 * Format: chat_{sha256(sorted_ids + productId).slice(0, 16)}
 */
const generateRoomId = (userId1, userId2, productId) => {
  const sorted = [userId1.toString(), userId2.toString()].sort().join(':');
  const hash = crypto
    .createHash('sha256')
    .update(`${sorted}:${productId}`)
    .digest('hex')
    .slice(0, 16);
  return `chat_${hash}`;
};

/**
 * Room naming conventions:
 * - user:{userId}     → private room, user joins on connect
 * - chat:{roomId}     → shared chat room, joined explicitly
 */
const userRoom = (userId) => `user:${userId}`;
const chatRoom = (roomId) => `chat:${roomId}`;

module.exports = { generateRoomId, userRoom, chatRoom };