// src/modules/notifications/notification.routes.js
const router = require('express').Router();
const controller = require('./notification.controller');
const { authenticate } = require('../../shared/middleware/authenticate');

router.use(authenticate);

// GET  /api/v1/notifications
router.get('/', controller.getNotifications);

// GET  /api/v1/notifications/unread-count
router.get('/unread-count', controller.getUnreadCount);

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', controller.markAllAsRead);

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', controller.markAsRead);

// DELETE /api/v1/notifications/:id
router.delete('/:id', controller.deleteNotification);

module.exports = router;