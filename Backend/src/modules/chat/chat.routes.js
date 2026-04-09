// src/modules/chat/chat.routes.js
const router = require('express').Router();
const controller = require('./chat.controller');
const { authenticate } = require('../../shared/middleware/authenticate');

router.use(authenticate);

// GET  /api/v1/chat/rooms
router.get('/rooms', controller.getRooms);

// POST /api/v1/chat/rooms
router.post('/rooms', controller.getOrCreateRoom);

// GET  /api/v1/chat/rooms/:roomId
router.get('/rooms/:roomId', controller.getRoom);

// GET  /api/v1/chat/rooms/:roomId/messages
router.get('/rooms/:roomId/messages', controller.getMessages);

// PATCH /api/v1/chat/rooms/:roomId/read
router.patch('/rooms/:roomId/read', controller.markAsRead);

// GET  /api/v1/chat/presence/:userId
router.get('/presence/:userId', controller.getPresence);

module.exports = router;