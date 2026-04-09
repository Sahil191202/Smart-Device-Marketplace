// src/modules/admin/admin.middleware.js
const AuditLog = require('./auditLog.model');
const logger = require('../../config/logger');

/**
 * Audit logging middleware factory.
 * Wraps admin action controllers to automatically log every action.
 *
 * Usage in routes:
 *   router.patch('/:id/ban', auditLog('user.ban', 'user'), controller.banUser);
 *
 * @param {string} action - dot-notation action name e.g. 'user.ban'
 * @param {string} targetType - 'user' | 'product' | 'order' | 'system'
 * @param {Function} [getTargetId] - extract targetId from req (default: req.params.id)
 */
const auditLog = (action, targetType, getTargetId = null) => {
  return async (req, res, next) => {
    // Attach audit metadata to req so controller can enrich it
    req.audit = {
      action,
      targetType,
      targetId: getTargetId ? getTargetId(req) : req.params.id,
      before: null,
      after: null,
      reason: req.body?.reason || req.body?.note || null,
    };

    // Monkey-patch res.json to capture the response and log after success
    const originalJson = res.json.bind(res);
    res.json = async function (body) {
      // Only log successful admin actions (2xx responses)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          await AuditLog.create({
            adminId: req.user.id,
            adminEmail: req.user.email,
            action,
            targetType,
            targetId: req.audit.targetId,
            before: req.audit.before,
            after: req.audit.after,
            reason: req.audit.reason,
            ip: req.ip,
            userAgent: req.get('User-Agent')?.slice(0, 200),
          });
        } catch (err) {
          // Never block the response — audit log failure is non-critical
          logger.error('Audit log write failed', {
            action,
            adminId: req.user.id,
            error: err.message,
          });
        }
      }
      return originalJson(body);
    };

    next();
  };
};

module.exports = { auditLog };