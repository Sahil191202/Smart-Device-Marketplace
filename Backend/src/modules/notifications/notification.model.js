// src/modules/notifications/notification.model.js
const mongoose = require('mongoose');

const NOTIFICATION_TYPES = {
  PRICE_DROP: 'price_drop',
  ORDER_UPDATE: 'order_update',       // Phase 7
  NEW_MESSAGE: 'new_message',         // Phase 9
  PRODUCT_SOLD: 'product_sold',
  SYSTEM: 'system',
};

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: Object.values(NOTIFICATION_TYPES),
    required: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 100,
  },
  body: {
    type: String,
    required: true,
    maxlength: 500,
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  // Flexible metadata per notification type
  // price_drop: { productId, productTitle, oldPrice, newPrice, dropPercent }
  // order_update: { orderId, status }
  // new_message: { roomId, senderId, senderName }
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // Deep link for frontend navigation
  actionUrl: {
    type: String,
    maxlength: 200,
  },
}, {
  timestamps: true,
});

// ── Indexes ───────────────────────────────────────────────────────────────────

// Primary query: user's notifications, unread first, newest first
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// Cursor pagination
notificationSchema.index({ userId: 1, createdAt: -1 });

// TTL: auto-delete notifications older than 90 days
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;