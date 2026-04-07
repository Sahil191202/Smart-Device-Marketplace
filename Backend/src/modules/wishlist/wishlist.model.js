// src/modules/wishlist/wishlist.model.js
const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  // Price at time of wishlisting — used to detect drops
  savedPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  // Last alert sent at — prevents duplicate alerts
  lastAlertAt: {
    type: Date,
    default: null,
  },
  // Track how many times alerts have been sent for this entry
  alertCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// ── Indexes ───────────────────────────────────────────────────────────────────

// Primary: one entry per user+product (enforced unique)
wishlistSchema.index({ userId: 1, productId: 1 }, { unique: true });

// Scheduler query: find all wishlists for a product when its price changes
wishlistSchema.index({ productId: 1, savedPrice: 1 });

// User's wishlist listing (sorted by recency)
wishlistSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Wishlist', wishlistSchema);