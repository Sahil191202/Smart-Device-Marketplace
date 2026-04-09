// src/jobs/notification.worker.js
const { getQueue, QUEUE_NAMES } = require('./queue');
const { emitToUser } = require('../sockets/socket.server');
const logger = require('../config/logger');

/**
 * Upgraded notification worker.
 * Now actually emits via Socket.io (Phase 9 complete).
 *
 * Flow:
 * notify:push job → worker picks up → emitToUser()
 * → Redis adapter broadcasts → recipient's Socket.io connection receives it
 * → If user offline: silently dropped (notification already in DB from Phase 6)
 */
const startNotificationWorker = () => {
  const notifQueue = getQueue(QUEUE_NAMES.NOTIFICATION_QUEUE);

  notifQueue.process('notify:push', 10, async (job) => {
    const { userId, notification } = job.data;

    // Emit real-time event to user's private room
    // Works across all Node.js instances via Redis pub/sub adapter
    emitToUser(userId, 'notification:new', notification);

    logger.debug('Real-time notification emitted', {
      userId,
      notificationId: notification._id,
      type: notification.type,
    });
  });

  logger.info('Notification worker started with Socket.io support');
};

module.exports = { startNotificationWorker };