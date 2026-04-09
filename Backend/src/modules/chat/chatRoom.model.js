// src/modules/chat/chatRoom.model.js
const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  // Deterministic room ID: sorted participant IDs + productId
  // Ensures buyer+seller always get the same room for a product
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],

  // Context: which product this chat is about
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },

  // Snapshot of last message for conversation list preview
  lastMessage: {
    content: String,
    senderId: mongoose.Schema.Types.ObjectId,
    type: { type: String, default: 'text' },
    sentAt: Date,
  },

  // Per-participant unread count (Map: userId → count)
  unreadCounts: {
    type: Map,
    of: Number,
    default: {},
  },

  // Soft: mark room as archived per participant
  archivedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  messageCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// ── Indexes ───────────────────────────────────────────────────────────────────

// User's conversation list
chatRoomSchema.index({ participants: 1, updatedAt: -1 });

// Product context
chatRoomSchema.index({ productId: 1 });

module.exports = mongoose.model('ChatRoom', chatRoomSchema);