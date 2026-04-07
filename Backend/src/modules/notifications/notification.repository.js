// src/modules/notifications/notification.repository.js
const Notification = require('./notification.model');
const mongoose = require('mongoose');

class NotificationRepository {

  async create(data) {
    return Notification.create(data);
  }

  async createMany(notifications) {
    // Bulk insert for sending alerts to multiple users (price drop batch)
    return Notification.insertMany(notifications, { ordered: false });
  }

  async findByUser(userId, { cursor, limit = 20, unreadOnly = false } = {}) {
    const query = { userId: new mongoose.Types.ObjectId(userId) };
    if (unreadOnly) query.isRead = false;

    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
        query._id = { $lt: new mongoose.Types.ObjectId(decoded.id) };
      } catch { /* ignore */ }
    }

    const items = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasNext = items.length > limit;
    const results = hasNext ? items.slice(0, limit) : items;

    let nextCursor = null;
    if (hasNext && results.length > 0) {
      const last = results[results.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ id: last._id.toString() })).toString('base64');
    }

    return { items: results, nextCursor, hasNext };
  }

  async markAsRead(notificationId, userId) {
    return Notification.updateOne(
      { _id: notificationId, userId }, // userId prevents reading others' notifications
      { $set: { isRead: true } }
    );
  }

  async markAllAsRead(userId) {
    return Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } }
    );
  }

  async countUnread(userId) {
    return Notification.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      isRead: false,
    });
  }

  async deleteOne(notificationId, userId) {
    return Notification.findOneAndDelete({ _id: notificationId, userId });
  }
}

module.exports = new NotificationRepository();