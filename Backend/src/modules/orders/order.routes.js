// src/modules/orders/order.routes.js
const router = require('express').Router();
const controller = require('./order.controller');
const { authenticate } = require('../../shared/middleware/authenticate');
const { authorize } = require('../../shared/middleware/authorize');
const validate = require('../../shared/middleware/validate');
const {
  checkoutDto,
  verifyPaymentDto,
  updateShippingDto,
  cancelOrderDto,
  listOrdersDto,
} = require('./order.dto');

// ── Razorpay webhook (no auth — Razorpay calls this directly) ─────────────────
// Registered separately in app.js with raw body parsing
// router.post('/webhook/razorpay', controller.razorpayWebhook);

// ── Buyer routes ──────────────────────────────────────────────────────────────

// POST /api/v1/orders/checkout
router.post('/checkout', authenticate, validate(checkoutDto), controller.initiateCheckout);

// POST /api/v1/orders/verify-payment
router.post('/verify-payment', authenticate, validate(verifyPaymentDto), controller.verifyPayment);

// GET  /api/v1/orders/my/buying
router.get('/my/buying', authenticate, validate(listOrdersDto, 'query'), controller.getMyOrdersAsBuyer);

// PATCH /api/v1/orders/:id/delivered
router.patch('/:id/delivered', authenticate, controller.markDelivered);

// ── Seller routes ──────────────────────────────────────────────────────────────

// GET  /api/v1/orders/my/selling
router.get('/my/selling', authenticate, authorize('seller', 'admin'), validate(listOrdersDto, 'query'), controller.getMyOrdersAsSeller);

// PATCH /api/v1/orders/:id/ship
router.patch('/:id/ship', authenticate, authorize('seller', 'admin'), validate(updateShippingDto), controller.markShipped);

// ── Shared ────────────────────────────────────────────────────────────────────

// GET  /api/v1/orders/:id
router.get('/:id', authenticate, controller.getOrderById);

// PATCH /api/v1/orders/:id/cancel
router.patch('/:id/cancel', authenticate, validate(cancelOrderDto), controller.cancelOrder);

module.exports = router;