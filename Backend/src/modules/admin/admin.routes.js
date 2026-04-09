// src/modules/admin/admin.routes.js
const router = require('express').Router();
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const { authenticate } = require('../../shared/middleware/authenticate');
const { authorize } = require('../../shared/middleware/authorize');
const { auditLog } = require('./admin.middleware');
const { getQueue, QUEUE_NAMES } = require('../../jobs/queue');

const analyticsController = require('./analytics.controller');
const userMgmtController = require('./userMgmt.controller');
const productMgmtController = require('./productMgmt.controller');
const orderMgmtController = require('./orderMgmt.controller');

// ── All admin routes require authentication + admin role ──────────────────────
router.use(authenticate);
router.use(authorize('admin'));

// ── Bull Board (queue monitoring UI) ─────────────────────────────────────────
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/api/v1/admin/queues');

createBullBoard({
  queues: Object.values(QUEUE_NAMES).map(name => new BullAdapter(getQueue(name))),
  serverAdapter,
});

router.use('/queues', serverAdapter.getRouter());

// ── Analytics ─────────────────────────────────────────────────────────────────

// GET /api/v1/admin/dashboard
router.get('/dashboard', analyticsController.getDashboard);

// GET /api/v1/admin/analytics/revenue?period=30d
router.get('/analytics/revenue', analyticsController.getRevenue);

// GET /api/v1/admin/analytics/orders?period=30d
router.get('/analytics/orders', analyticsController.getOrders);

// GET /api/v1/admin/analytics/users?period=30d
router.get('/analytics/users', analyticsController.getUsers);

// GET /api/v1/admin/analytics/products
router.get('/analytics/products', analyticsController.getProducts);

// GET /api/v1/admin/analytics/ai-predictions
router.get('/analytics/ai-predictions', analyticsController.getAIPredictions);

// GET /api/v1/admin/metrics  (system health + queue depths)
router.get('/metrics', analyticsController.getMetrics);

// GET /api/v1/admin/audit-logs
router.get('/audit-logs', analyticsController.getAuditLogs);

// ── User Management ───────────────────────────────────────────────────────────

// GET /api/v1/admin/users
router.get('/users', userMgmtController.listUsers);

// GET /api/v1/admin/users/:id
router.get('/users/:id', userMgmtController.getUser);

// PATCH /api/v1/admin/users/:id/ban
router.patch(
  '/users/:id/ban',
  auditLog('user.ban', 'user'),
  userMgmtController.banUser
);

// PATCH /api/v1/admin/users/:id/unban
router.patch(
  '/users/:id/unban',
  auditLog('user.unban', 'user'),
  userMgmtController.unbanUser
);

// PATCH /api/v1/admin/users/:id/role
router.patch(
  '/users/:id/role',
  auditLog('user.roleChange', 'user'),
  userMgmtController.changeRole
);

// POST /api/v1/admin/users/:id/force-logout
router.post(
  '/users/:id/force-logout',
  auditLog('user.forceLogout', 'user'),
  userMgmtController.forceLogout
);

// DELETE /api/v1/admin/users/:id
router.delete(
  '/users/:id',
  auditLog('user.delete', 'user'),
  userMgmtController.deleteUser
);

// ── Product Moderation ────────────────────────────────────────────────────────

// GET /api/v1/admin/products
router.get('/products', productMgmtController.listProducts);

// PATCH /api/v1/admin/products/:id/remove
router.patch(
  '/products/:id/remove',
  auditLog('product.forceRemove', 'product'),
  productMgmtController.forceRemoveProduct
);

// PATCH /api/v1/admin/products/:id/restore
router.patch(
  '/products/:id/restore',
  auditLog('product.restore', 'product'),
  productMgmtController.restoreProduct
);

// ── Order Oversight ───────────────────────────────────────────────────────────

// GET /api/v1/admin/orders
router.get('/orders', orderMgmtController.listOrders);

// PATCH /api/v1/admin/orders/:id/transition
router.patch(
  '/orders/:id/transition',
  auditLog('order.forceTransition', 'order'),
  orderMgmtController.forceTransition
);

module.exports = router;