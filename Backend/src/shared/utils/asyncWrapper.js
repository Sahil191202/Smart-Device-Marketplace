// src/shared/utils/asyncWrapper.js

/**
 * Wraps async route handlers to eliminate try/catch boilerplate.
 * Errors automatically forwarded to Express error handler via next().
 * 
 * Usage:
 *   router.get('/products', asyncWrapper(productController.list));
 */
const asyncWrapper = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncWrapper;