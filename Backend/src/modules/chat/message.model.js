// src/modules/chat/message.model.js
const mongoose = require('mongoose');

const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',    // URL to Cloudinary-hosted image
  SYSTEM: 'system',  // automated messages (e.g. "Order placed")
};

const messageSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
  },
  type: {
    type: String,
    enum: Object.values(MESSAGE_TYPES),
    default: MESSAGE_TYPES.TEXT,
  },
  // Array of userIds who have read this message
  readBy: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now },
  }],
  // For image messages: Cloudinary metadata
  media: {
    url: String,
    publicId: String,
    width: Number,
    height: Number,
  },
  // Soft delete (user can delete for themselves)
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  isDeleted: {
    type: Boolean,
    default: false,  // admin/system hard delete
  },
}, {
  timestamps: true,
});

// ── Indexes ───────────────────────────────────────────────────────────────────

// Primary: fetch messages for a room (newest first, cursor-based)
messageSchema.index({ roomId: 1, createdAt: -1 });

// Unread: find unread messages per user in a room
messageSchema.index({ roomId: 1, 'readBy.userId': 1 });

// TTL: auto-delete messages older than 1 year
messageSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 }
);

module.exports = mongoose.model('Message', messageSchema);
module.exports.MESSAGE_TYPES = MESSAGE_TYPES;