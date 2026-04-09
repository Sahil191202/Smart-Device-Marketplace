// src/modules/admin/orderMgmt.controller.js
const Order = require('../orders/order.model');
const { ORDER_STATUS, ALLOWED_TRANSITIONS } = require('../orders/order.model');
const orderRepository = require('../orders/order.repository');
const apiResponse = require('../../shared/utils/apiResponse');
const asyncWrapper = require('../../shared/utils/asyncWrapper');
const AppError = require('../../shared/utils/AppError');
const logger = require('../../config/logger');

// GET /admin/orders — all orders with full details
const listOrders = asyncWrapper(async (req, res) => {
  const result = await orderRepository.findAllAdmin(req.query);
  apiResponse.success(res, {
    message: 'Orders fetched',
    data: { orders: result.items },
    meta: { nextCursor: result.nextCursor, hasNext: result.hasNext },
  });
});

// PATCH /admin/orders/:id/transition — force any valid state transition
const forceTransition = asyncWrapper(async (req, res) => {
  const { status, note } = req.body;

  if (!Object.values(ORDER_STATUS).includes(status)) {
    throw AppError.badRequest(`Invalid status: ${status}`);
  }

  const order = await Order.findById(req.params.id);
  if (!order) throw AppError.notFound('Order');

  if (!order.canTransitionTo(status)) {
    throw AppError.badRequest(
      `Cannot transition from '${order.status}' to '${status}'. ` +
      `Allowed: ${(ALLOWED_TRANSITIONS[order.status] || []).join(', ') || 'none'}`
    );
  }

  req.audit.before = { status: order.status };

  const updated = await orderRepository.updateWithVersion(
    order._id,
    order.version,
    { status }
  );

  if (!updated) throw AppError.conflict('Order modified concurrently. Please retry.');

  await orderRepository.addTimelineEvent(order._id, {
    status,
    note: note || `Admin forced transition to ${status}`,
    actor: 'admin',
    actorId: req.user.id,
  });

  req.audit.after = { status, note };

  logger.info('Admin forced order transition', {
    orderId: order._id,
    from: order.status,
    to: status,
    adminId: req.user.id,
  });

  apiResponse.success(res, {
    message: `Order status updated to ${status}`,
    data: { orderId: order._id, status },
  });
});

module.exports = { listOrders, forceTransition };