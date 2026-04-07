// src/modules/notifications/notification.controller.js
const notificationService = require('./notification.service');
const apiResponse = require('../../shared/utils/apiResponse');
const asyncWrapper = require('../../shared/utils/asyncWrapper');

const getNotifications = asyncWrapper(async (req, res) => {
  const { cursor, limit = 20, unread } = req.query;
  const result = await notificationService.getNotifications(req.user.id, {
    cursor,
    limit: parseInt(limit),
    unreadOnly: unread === 'true',
  });
  apiResponse.success(res, {
    message: 'Notifications fetched',
    data: { notifications: result.items },
    meta: { nextCursor: result.nextCursor, hasNext: result.hasNext },
  });
});

const getUnreadCount = asyncWrapper(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user.id);
  apiResponse.success(res, { message: 'Unread count', data: { count } });
});

const markAsRead = asyncWrapper(async (req, res) => {
  await notificationService.markAsRead(req.params.id, req.user.id);
  apiResponse.success(res, { message: 'Notification marked as read', data: null });
});

const markAllAsRead = asyncWrapper(async (req, res) => {
  await notificationService.markAllAsRead(req.user.id);
  apiResponse.success(res, { message: 'All notifications marked as read', data: null });
});

const deleteNotification = asyncWrapper(async (req, res) => {
  await notificationService.deleteNotification(req.params.id, req.user.id);
  apiResponse.success(res, { message: 'Notification deleted', data: null });
});

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};