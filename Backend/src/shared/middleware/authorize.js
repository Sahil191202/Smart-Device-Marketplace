// src/shared/middleware/authorize.js
const AppError = require('../utils/AppError');
const { ROLE_HIERARCHY } = require('../constants/roles');

/**
 * Role-based authorization guard.
 * Must be used AFTER authenticate middleware.
 * 
 * Usage:
 *   router.delete('/products/:id', authenticate, authorize('admin'), controller)
 *   router.post('/products', authenticate, authorize('seller', 'admin'), controller)
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(AppError.unauthorized());
  }

  // Check if user's role (or any role it inherits) is in the allowed list
  const userRoleHierarchy = ROLE_HIERARCHY[req.user.role] || [req.user.role];
  const hasPermission = allowedRoles.some(role => userRoleHierarchy.includes(role));

  if (!hasPermission) {
    return next(AppError.forbidden(
      `Role '${req.user.role}' is not authorized for this action`
    ));
  }

  next();
};

/**
 * Ownership guard — ensures user can only access their own resources.
 * 
 * Usage:
 *   router.patch('/users/:id', authenticate, requireOwnership('id'), controller)
 * 
 * @param {string} paramKey - The req.params key to compare with req.user.id
 */
const requireOwnership = (paramKey = 'id') => (req, res, next) => {
  if (!req.user) {
    return next(AppError.unauthorized());
  }

  const resourceOwnerId = req.params[paramKey];
  const isOwner = resourceOwnerId === req.user.id;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return next(AppError.forbidden('You can only modify your own resources'));
  }

  next();
};

module.exports = { authorize, requireOwnership };