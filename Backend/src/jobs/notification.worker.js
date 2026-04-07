// src/jobs/notification.worker.js
const { getQueue, QUEUE_NAMES } = require('./queue');
const logger = require('../config/logger');

/**
 * Notification worker: processes jobs queued by notificationService.
 *
 * notify:push → placeholder for Phase 9 Socket.io real-time push.
 *               When Socket.io is wired in Phase 9, the socket handler
 *               will emit directly and this job becomes the fallback
 *               for users who are offline.
 *
 * email:notification → price drop + system email notifications
 *                       (email.worker.js handles actual sending)
 */
const startNotificationWorker = () => {
  const notifQueue = getQueue(QUEUE_NAMES.NOTIFICATION_QUEUE);

  notifQueue.process('notify:push', 10, async (job) => {
    const { userId, notification } = job.data;

    // Phase 9 will replace this with actual Socket.io emit:
    // io.to(`user:${userId}`).emit('notification', notification);
    //
    // For now, log it — the in-app notification is already saved to DB
    // by notificationService.create(), so the user will see it on next poll.
    logger.debug('Real-time push (Phase 9 pending)', {
      userId,
      notificationId: notification._id,
      type: notification.type,
    });
  });

  logger.info('Notification worker started');
};

module.exports = { startNotificationWorker };