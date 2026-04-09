// src/modules/admin/auditLog.model.js
const mongoose = require('mongoose');

/**
 * Immutable audit log for all admin actions.
 *
 * Every admin action (ban user, remove product, force order transition)
 * is recorded here. Records are NEVER updated or deleted.
 * TTL: 2 years (legal/compliance requirement).
 */
const auditLogSchema = new mongoose.Schema({
  // Who performed the action
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  adminEmail: {
    type: String,
    required: true,
  },

  // What was done
  action: {
    type: String,
    required: true,
    index: true,
    // e.g. 'user.ban', 'user.roleChange', 'product.remove',
    // 'order.forceTransition', 'user.forceLogout'
  },

  // What was affected
  targetType: {
    type: String,
    enum: ['user', 'product', 'order', 'system'],
    required: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },

  // Full context snapshot (what changed)
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },
  reason: { type: String, maxlength: 500 },

  // Request metadata
  ip: String,
  userAgent: String,
}, {
  timestamps: true,
  // Prevent any updates — audit logs are append-only
  strict: true,
});

// Indexes for audit queries
auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

// TTL: auto-delete after 2 years
auditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);