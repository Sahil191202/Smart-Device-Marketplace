// src/modules/chat/chat.service.js
const chatRepository = require('./chat.repository');
const productRepository = require('../products/product.repository');
const { generateRoomId } = require('../../sockets/socket.rooms');
const AppError = require('../../shared/utils/AppError');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../config/logger');

const PRESENCE_TTL = 35;    // seconds — expires if no heartbeat
const HEARTBEAT_INTERVAL = 25 * 1000; // client sends heartbeat every 25s
const PRESENCE_KEY = (userId) => `presence:online:${userId}`;

class ChatService {

  // ── Room management ───────────────────────────────────────────────────────

  /**
   * Get or create a chat room between buyer and seller for a product.
   * Validates that the product exists and the initiator is not the seller.
   */
  async getOrCreateRoom(initiatorId, productId) {
    const product = await productRepository.findById(productId);
    if (!product) throw AppError.notFound('Product');

    const sellerId = product.sellerId.toString();

    if (initiatorId === sellerId) {
      throw AppError.badRequest('You cannot chat with yourself about your own product');
    }

    const roomId = generateRoomId(initiatorId, sellerId, productId);
    const participants = [
      new (require('mongoose').Types.ObjectId)(initiatorId),
      new (require('mongoose').Types.ObjectId)(sellerId),
    ];

    const room = await chatRepository.findOrCreateRoom(roomId, participants, productId);

    logger.debug('Chat room resolved', {
      roomId,
      participants: [initiatorId, sellerId],
      productId,
    });

    return room;
  }

  async getRoomById(roomId, userId) {
    const isParticipant = await chatRepository.isParticipant(roomId, userId);
    if (!isParticipant) throw AppError.forbidden('You are not a participant in this room');

    const room = await chatRepository.findRoomById(roomId);
    if (!room) throw AppError.notFound('Chat room');

    return room;
  }

  async getUserRooms(userId, pagination) {
    return chatRepository.findRoomsByUser(userId, pagination);
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  async sendMessage({ roomId, senderId, content, type = 'text', media = null }) {
    // Verify sender is a participant
    const isParticipant = await chatRepository.isParticipant(roomId, senderId);
    if (!isParticipant) throw AppError.forbidden('You are not a participant in this room');

    // Basic content validation
    if (type === 'text' && (!content || content.trim().length === 0)) {
      throw AppError.badRequest('Message content cannot be empty');
    }
    if (content && content.length > 2000) {
      throw AppError.badRequest('Message too long (max 2000 characters)');
    }

    // Store in MongoDB FIRST (durability before real-time delivery)
    const message = await chatRepository.createMessage({
      roomId,
      senderId: new (require('mongoose').Types.ObjectId)(senderId),
      content: type === 'text' ? content.trim() : content,
      type,
      media,
    });

    // Get other participant to update their unread count
    const room = await chatRepository.findRoomById(roomId);
    const otherParticipantId = room.participants
      .find(p => p._id.toString() !== senderId)
      ?._id?.toString();

    // Update room's lastMessage snapshot + increment unread for recipient
    if (otherParticipantId) {
      await chatRepository.updateRoomLastMessage(
        roomId,
        message,
        senderId,
        otherParticipantId
      );
    }

    logger.debug('Message stored', { messageId: message._id, roomId, senderId });

    return { message, otherParticipantId };
  }

  async getMessages(roomId, userId, pagination) {
    const isParticipant = await chatRepository.isParticipant(roomId, userId);
    if (!isParticipant) throw AppError.forbidden('You are not a participant in this room');

    return chatRepository.findMessagesByRoom(roomId, userId, pagination);
  }

  async markRoomAsRead(roomId, userId) {
    const isParticipant = await chatRepository.isParticipant(roomId, userId);
    if (!isParticipant) throw AppError.forbidden();

    // Get IDs of messages being marked read (for read receipt event)
    const unreadMsgIds = await chatRepository.getUnreadMessageIds(roomId, userId);

    // Mark messages in DB
    await chatRepository.markMessagesAsRead(roomId, userId);

    // Reset room unread counter
    await chatRepository.clearUnreadCount(roomId, userId);

    return unreadMsgIds.map(m => m._id.toString());
  }

  async getMissedMessages(roomId, userId, since) {
    const isParticipant = await chatRepository.isParticipant(roomId, userId);
    if (!isParticipant) return [];

    return chatRepository.findMessagesSince(roomId, since);
  }

  // ── Presence ──────────────────────────────────────────────────────────────

  async setOnline(userId) {
    const redis = getRedisClient();
    await redis.setEx(PRESENCE_KEY(userId), PRESENCE_TTL, Date.now().toString());
  }

  async setOffline(userId) {
    const redis = getRedisClient();
    await redis.del(PRESENCE_KEY(userId));
  }

  async refreshPresence(userId) {
    // Called on heartbeat — extend TTL without changing value
    const redis = getRedisClient();
    await redis.expire(PRESENCE_KEY(userId), PRESENCE_TTL);
  }

  async isOnline(userId) {
    const redis = getRedisClient();
    const val = await redis.get(PRESENCE_KEY(userId));
    return val !== null;
  }

  async getPresenceBulk(userIds) {
    if (!userIds || userIds.length === 0) return {};
    const redis = getRedisClient();
    const keys = userIds.map(id => PRESENCE_KEY(id));
    const values = await redis.mGet(keys);
    const result = {};
    userIds.forEach((id, i) => {
      result[id] = values[i] !== null;
    });
    return result;
  }
}

module.exports = new ChatService();