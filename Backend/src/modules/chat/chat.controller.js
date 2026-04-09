// src/modules/chat/chat.controller.js
const chatService = require('./chat.service');
const apiResponse = require('../../shared/utils/apiResponse');
const asyncWrapper = require('../../shared/utils/asyncWrapper');

// GET /api/v1/chat/rooms — list user's conversations
const getRooms = asyncWrapper(async (req, res) => {
  const { cursor, limit = 20 } = req.query;
  const result = await chatService.getUserRooms(req.user.id, {
    cursor,
    limit: parseInt(limit),
  });
  apiResponse.success(res, {
    message: 'Conversations fetched',
    data: { rooms: result.items },
    meta: { nextCursor: result.nextCursor, hasNext: result.hasNext },
  });
});

// POST /api/v1/chat/rooms — get or create a room (buyer initiates from product page)
const getOrCreateRoom = asyncWrapper(async (req, res) => {
  const { productId } = req.body;
  const room = await chatService.getOrCreateRoom(req.user.id, productId);
  apiResponse.success(res, { message: 'Chat room ready', data: { room } });
});

// GET /api/v1/chat/rooms/:roomId — get single room details
const getRoom = asyncWrapper(async (req, res) => {
  const room = await chatService.getRoomById(req.params.roomId, req.user.id);
  apiResponse.success(res, { message: 'Room fetched', data: { room } });
});

// GET /api/v1/chat/rooms/:roomId/messages — paginated message history
const getMessages = asyncWrapper(async (req, res) => {
  const { cursor, limit = 30 } = req.query;
  const result = await chatService.getMessages(
    req.params.roomId,
    req.user.id,
    { cursor, limit: parseInt(limit) }
  );
  apiResponse.success(res, {
    message: 'Messages fetched',
    data: { messages: result.items },
    meta: { nextCursor: result.nextCursor, hasNext: result.hasNext },
  });
});

// PATCH /api/v1/chat/rooms/:roomId/read — mark all messages as read (REST fallback)
const markAsRead = asyncWrapper(async (req, res) => {
  const readIds = await chatService.markRoomAsRead(req.params.roomId, req.user.id);
  apiResponse.success(res, {
    message: 'Messages marked as read',
    data: { markedCount: readIds.length },
  });
});

// GET /api/v1/chat/presence/:userId — check if a user is online
const getPresence = asyncWrapper(async (req, res) => {
  const isOnline = await chatService.isOnline(req.params.userId);
  apiResponse.success(res, {
    message: 'Presence fetched',
    data: { userId: req.params.userId, isOnline },
  });
});

module.exports = {
  getRooms,
  getOrCreateRoom,
  getRoom,
  getMessages,
  markAsRead,
  getPresence,
};