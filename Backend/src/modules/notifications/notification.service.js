// src/modules/notifications/notification.service.js
const notificationRepository = require("./notification.repository");
const { addEmailJob, addNotificationJob } = require("../../jobs/queue");
const { getRedisClient } = require("../../config/redis");
const logger = require("../../config/logger");
const { NOTIFICATION_TYPES } = require("./notification.model");

const UNREAD_COUNT_KEY = (userId) => `notif:unread:${userId}`;
const ALERT_DEDUP_TTL = 60 * 60 * 24; // 24h dedup window

class NotificationService {
  /**
   * Core notification creation.
   * Saves to DB + increments Redis unread counter.
   * Optionally queues email.
   */
  async create({
    userId,
    type,
    title,
    body,
    metadata = {},
    actionUrl = null,
    sendEmail = false,
    emailData = null,
  }) {
    const notification = await notificationRepository.create({
      userId,
      type,
      title,
      body,
      metadata,
      actionUrl,
    });

    const redis = getRedisClient();
    await redis.incr(UNREAD_COUNT_KEY(userId.toString()));

    // Queue email with all emailData fields
    if (sendEmail && emailData && emailData.to) {
      await addEmailJob("email:notification", {
        ...emailData, // ← spread ALL emailData fields
        type, // ← pass type so worker knows context
        title,
        body,
        actionUrl,
      }).catch((err) =>
        logger.warn("Failed to queue notification email", {
          error: err.message,
        }),
      );
    }

    await addNotificationJob("notify:push", {
      userId: userId.toString(),
      notification: {
        _id: notification._id,
        type,
        title,
        body,
        actionUrl,
        createdAt: notification.createdAt,
      },
    }).catch(() => {});

    return notification;
  }

  /**
   * Price drop notification with dedup guard.
   * Prevents the same user getting 10 alerts if scheduler runs hourly
   * and price keeps dropping gradually.
   */
  async createPriceDropNotification({
    userId,
    productId,
    productTitle,
    productSlug,
    oldPrice,
    newPrice,
    dropAmount,
    dropPercent,
  }) {
    // Dedup: one alert per user per product per 24h
    const redis = getRedisClient();
    const dedupKey = `notif:dedup:pricedrop:${userId}:${productId}`;
    const alreadySent = await redis.get(dedupKey);
    if (alreadySent) {
      logger.debug("Price drop alert suppressed (dedup)", {
        userId,
        productId,
      });
      return;
    }

    await redis.setEx(dedupKey, ALERT_DEDUP_TTL, "1");

    const title = `Price Drop on ${productTitle}`;
    const body = `Price dropped by ₹${dropAmount.toLocaleString("en-IN")} (${dropPercent}% off) — now ₹${newPrice.toLocaleString("en-IN")}`;

    return this.create({
      userId,
      type: NOTIFICATION_TYPES.PRICE_DROP,
      title,
      body,
      metadata: {
        productId,
        productTitle,
        oldPrice,
        newPrice,
        dropAmount,
        dropPercent,
      },
      actionUrl: `/products/slug/${productSlug}`,
      sendEmail: true,
      emailData: {
        productSlug,
        oldPrice,
        newPrice,
        dropAmount,
        dropPercent,
        productTitle,
      },
    });
  }

  async getNotifications(userId, { cursor, limit, unreadOnly }) {
    return notificationRepository.findByUser(userId, {
      cursor,
      limit,
      unreadOnly,
    });
  }

  async getUnreadCount(userId) {
    // Try Redis first (O(1) vs COUNT query)
    const redis = getRedisClient();
    const cached = await redis.get(UNREAD_COUNT_KEY(userId));

    if (cached !== null) return parseInt(cached);

    // Cache miss: query DB and repopulate Redis
    const count = await notificationRepository.countUnread(userId);
    await redis.set(UNREAD_COUNT_KEY(userId), count);
    return count;
  }

  async markAsRead(notificationId, userId) {
    const result = await notificationRepository.markAsRead(
      notificationId,
      userId,
    );
    if (result.modifiedCount > 0) {
      const redis = getRedisClient();
      // Decrement, don't go below 0
      const current = parseInt(
        (await redis.get(UNREAD_COUNT_KEY(userId))) || "0",
      );
      if (current > 0) await redis.decr(UNREAD_COUNT_KEY(userId));
    }
    return result;
  }

  async markAllAsRead(userId) {
    const result = await notificationRepository.markAllAsRead(userId);
    // Reset Redis counter to 0
    const redis = getRedisClient();
    await redis.set(UNREAD_COUNT_KEY(userId), 0);
    return result;
  }

  async deleteNotification(notificationId, userId) {
    const notification = await notificationRepository.deleteOne(
      notificationId,
      userId,
    );
    if (!notification) {
      const AppError = require("../../shared/utils/AppError");
      throw AppError.notFound("Notification");
    }
    // Decrement unread count if it was unread
    if (!notification.isRead) {
      const redis = getRedisClient();
      const current = parseInt(
        (await redis.get(UNREAD_COUNT_KEY(userId))) || "0",
      );
      if (current > 0) await redis.decr(UNREAD_COUNT_KEY(userId));
    }
    return notification;
  }
}

module.exports = new NotificationService();
