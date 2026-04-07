// src/modules/orders/order.model.js
const mongoose = require('mongoose');

const ORDER_STATUS = {
  PENDING: 'pending',         // order created, payment not yet received
  CONFIRMED: 'confirmed',     // payment captured, seller notified
  SHIPPED: 'shipped',         // seller marked as shipped
  DELIVERED: 'delivered',     // buyer confirmed delivery
  CANCELLED: 'cancelled',     // cancelled before shipping
  REFUNDED: 'refunded',       // payment refunded
};

// Valid status transitions — prevents invalid state changes
const ALLOWED_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],   // terminal state
  [ORDER_STATUS.CANCELLED]: [ORDER_STATUS.REFUNDED],
  [ORDER_STATUS.REFUNDED]: [],    // terminal state
};

// Immutable event entry in order timeline
const timelineEventSchema = new mongoose.Schema({
  status: { type: String, required: true },
  note: { type: String, maxlength: 300 },
  actor: { type: String, enum: ['system', 'buyer', 'seller', 'admin'], default: 'system' },
  actorId: { type: mongoose.Schema.Types.ObjectId },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

// Snapshot of delivery address at time of order
const addressSnapshotSchema = new mongoose.Schema({
  label: String,
  line1: { type: String, required: true },
  line2: String,
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, default: 'India' },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  // ── Parties ───────────────────────────────────────────────────────────────
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },

  // ── Price snapshot (immutable after order creation) ───────────────────────
  // Product price can change — we must store what was actually paid
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  currency: {
    type: String,
    default: 'INR',
  },

  // Snapshot of product details at time of order (product can be deleted later)
  productSnapshot: {
    title: String,
    brand: String,
    category: String,
    condition: String,
    primaryImageUrl: String,
  },

  // ── Delivery ──────────────────────────────────────────────────────────────
  deliveryAddress: {
    type: addressSnapshotSchema,
    required: true,
  },

  // ── Payment ───────────────────────────────────────────────────────────────
  razorpayOrderId: {
    type: String,
    index: true,
    sparse: true,
  },
  razorpayPaymentId: {
    type: String,
    sparse: true,
  },
  razorpaySignature: {
    type: String,
    select: false,  // never expose raw signature
  },

  // ── Shipping ──────────────────────────────────────────────────────────────
  tracking: {
    courier: String,
    trackingNumber: String,
    trackingUrl: String,
    estimatedDelivery: Date,
  },

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.PENDING,
    index: true,
  },
  timeline: {
    type: [timelineEventSchema],
    default: [],
  },
  cancelReason: String,
  cancelledBy: { type: String, enum: ['buyer', 'seller', 'admin', 'system'] },

  // ── Optimistic lock ───────────────────────────────────────────────────────
  // Prevents double-update race conditions without DB-level locking
  version: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      delete ret.__v;
      return ret;
    },
  },
});

// ── Compound indexes ──────────────────────────────────────────────────────────
orderSchema.index({ buyerId: 1, status: 1, createdAt: -1 });
orderSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
orderSchema.index({ razorpayOrderId: 1 }, { sparse: true });
orderSchema.index({ status: 1, createdAt: -1 }); // admin dashboard

// ── Instance methods ──────────────────────────────────────────────────────────

orderSchema.methods.canTransitionTo = function (newStatus) {
  return ALLOWED_TRANSITIONS[this.status]?.includes(newStatus) ?? false;
};

orderSchema.methods.addTimelineEvent = function ({ status, note, actor, actorId, metadata }) {
  this.timeline.push({ status, note, actor, actorId, metadata });
};

module.exports = mongoose.model('Order', orderSchema);
module.exports.ORDER_STATUS = ORDER_STATUS;
module.exports.ALLOWED_TRANSITIONS = ALLOWED_TRANSITIONS;