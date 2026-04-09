// src/modules/chat/chat.repository.js
const mongoose = require('mongoose');
const ChatRoom = require('./chatRoom.model');
const Message = require('./message.model');

class ChatRepository {

  // ── Rooms ──────────────────────────────────────────────────────────────────

  async findOrCreateRoom(roomId, participants, productId) {
    return ChatRoom.findOneAndUpdate(
      { roomId },
      {
        $setOnInsert: {
          roomId,
          participants,
          productId,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    ).lean();
  }

  async findRoomById(roomId) {
    return ChatRoom.findOne({ roomId })
      .populate('participants', 'name avatar')
      .populate('productId', 'title slug images price status')
      .lean();
  }

  async findRoomsByUser(userId, { cursor, limit = 20 } = {}) {
    const query = {
      participants: new mongoose.Types.ObjectId(userId),
      archivedBy: { $ne: new mongoose.Types.ObjectId(userId) },
    };

    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
        query.updatedAt = { $lt: new Date(decoded.updatedAt) };
      } catch { /* ignore */ }
    }

    const rooms = await ChatRoom.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit + 1)
      .populate('participants', 'name avatar')
      .populate('productId', 'title slug images price status')
      .lean();

    const hasNext = rooms.length > limit;
    const results = hasNext ? rooms.slice(0, limit) : rooms;

    let nextCursor = null;
    if (hasNext && results.length > 0) {
      const last = results[results.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ updatedAt: last.updatedAt })
      ).toString('base64');
    }

    return { items: results, nextCursor, hasNext };
  }

  async updateRoomLastMessage(roomId, message, senderId, otherParticipantId) {
    return ChatRoom.updateOne(
      { roomId },
      {
        $set: {
          lastMessage: {
            content: message.type === 'text' ? message.content : '📷 Image',
            senderId,
            type: message.type,
            sentAt: message.createdAt,
          },
        },
        // Increment unread count for the recipient (not the sender)
        $inc: {
          [`unreadCounts.${otherParticipantId}`]: 1,
          messageCount: 1,
        },
      }
    );
  }

  async clearUnreadCount(roomId, userId) {
    return ChatRoom.updateOne(
      { roomId },
      { $set: { [`unreadCounts.${userId}`]: 0 } }
    );
  }

  async archiveRoom(roomId, userId) {
    return ChatRoom.updateOne(
      { roomId },
      { $addToSet: { archivedBy: userId } }
    );
  }

  async isParticipant(roomId, userId) {
    const room = await ChatRoom.findOne({
      roomId,
      participants: new mongoose.Types.ObjectId(userId),
    }).select('_id').lean();
    return !!room;
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  async createMessage(data) {
    const message = new Message({
      ...data,
      // Sender has automatically read the message they sent
      readBy: [{ userId: data.senderId, readAt: new Date() }],
    });
    return message.save();
  }

  async findMessagesByRoom(roomId, userId, { cursor, limit = 30 } = {}) {
    const query = {
      roomId,
      isDeleted: false,
      deletedFor: { $ne: new mongoose.Types.ObjectId(userId) },
    };

    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
        query._id = { $lt: new mongoose.Types.ObjectId(decoded.id) };
      } catch { /* ignore */ }
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 }) // newest first for cursor pagination
      .limit(limit + 1)
      .populate('senderId', 'name avatar')
      .lean();

    const hasNext = messages.length > limit;
    const results = hasNext ? messages.slice(0, limit) : messages;

    // Reverse so client receives oldest-to-newest within the page
    results.reverse();

    let nextCursor = null;
    if (hasNext) {
      // Cursor points to oldest message in this page (for fetching older messages)
      const oldest = results[0];
      if (oldest) {
        nextCursor = Buffer.from(
          JSON.stringify({ id: oldest._id.toString() })
        ).toString('base64');
      }
    }

    return { items: results, nextCursor, hasNext };
  }

  async markMessagesAsRead(roomId, userId) {
    // Mark all unread messages in room as read by this user
    return Message.updateMany(
      {
        roomId,
        'readBy.userId': { $ne: new mongoose.Types.ObjectId(userId) },
        senderId: { $ne: new mongoose.Types.ObjectId(userId) }, // don't mark own messages
        isDeleted: false,
      },
      {
        $addToSet: {
          readBy: { userId: new mongoose.Types.ObjectId(userId), readAt: new Date() },
        },
      }
    );
  }

  async getUnreadMessageIds(roomId, userId) {
    // Return IDs of messages the user hasn't read yet (for read receipt sync)
    return Message.find({
      roomId,
      'readBy.userId': { $ne: new mongoose.Types.ObjectId(userId) },
      senderId: { $ne: new mongoose.Types.ObjectId(userId) },
      isDeleted: false,
    })
      .select('_id')
      .lean();
  }

  async deleteMessageForUser(messageId, userId) {
    return Message.updateOne(
      { _id: messageId, senderId: userId },
      { $addToSet: { deletedFor: userId } }
    );
  }

  async findMessagesSince(roomId, since) {
    // Fetch messages created after a timestamp (for reconnection sync)
    return Message.find({
      roomId,
      createdAt: { $gt: new Date(since) },
      isDeleted: false,
    })
      .sort({ createdAt: 1 })
      .populate('senderId', 'name avatar')
      .lean();
  }
}

module.exports = new ChatRepository();