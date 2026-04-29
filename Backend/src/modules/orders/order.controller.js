// src/modules/orders/order.controller.js
const orderService = require("./order.service");
const { verifyWebhookSignature } = require("../../config/razorpay");
const apiResponse = require("../../shared/utils/apiResponse");
const asyncWrapper = require("../../shared/utils/asyncWrapper");
const AppError = require("../../shared/utils/AppError");
const logger = require("../../config/logger");

const initiateCheckout = asyncWrapper(async (req, res) => {
  const result = await orderService.initiateCheckout({
    buyerId: req.user.id,
    ...req.body,
  });
  apiResponse.created(res, { message: "Checkout initiated", data: result });
});

const verifyPayment = asyncWrapper(async (req, res) => {
  const result = await orderService.verifyPayment({
    ...req.body,
    buyerId: req.user.id,
  });
  apiResponse.success(res, {
    message: result.alreadyConfirmed
      ? "Order already confirmed"
      : "Payment verified successfully",
    data: { order: result.order },
  });
});

/**
 * Razorpay Webhook handler.
 * IMPORTANT: This route uses raw body (not parsed JSON) for signature verification.
 * The route is registered BEFORE express.json() middleware in app.js.
 */
const razorpayWebhook = async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  if (!signature) {
    return res
      .status(400)
      .json({ success: false, message: "Missing signature" });
  }

  // Verify signature using raw body string
  const isValid = verifyWebhookSignature(req.rawBody, signature);
  if (!isValid) {
    logger.warn("Razorpay webhook signature verification failed", {
      ip: req.ip,
    });
    return res
      .status(400)
      .json({ success: false, message: "Invalid signature" });
  }

  // Acknowledge immediately (Razorpay retries if no 200 within 5s)
  res.status(200).json({ success: true });

  // Process asynchronously after acknowledging
  const { event, payload } = req.body;
  orderService.handleWebhook({ event, payload }).catch((err) => {
    logger.error("Webhook processing error", { event, error: err.message });
  });
};

const getMyOrdersAsBuyer = asyncWrapper(async (req, res) => {
  const result = await orderService.getMyOrdersAsBuyer(req.user.id, req.query);
  apiResponse.success(res, {
    message: "Orders fetched",
    data: { orders: result.items },
    meta: { nextCursor: result.nextCursor, hasNext: result.hasNext },
  });
});

const getMyOrdersAsSeller = asyncWrapper(async (req, res) => {
  const result = await orderService.getMyOrdersAsSeller(req.user.id, req.query);
  apiResponse.success(res, {
    message: "Seller orders fetched",
    data: { orders: result.items },
    meta: { nextCursor: result.nextCursor, hasNext: result.hasNext },
  });
});

const getOrderById = asyncWrapper(async (req, res) => {
  const order = await orderService.getOrderById(
    req.params.id,
    req.user.id,
    req.user.role,
  );
  apiResponse.success(res, { message: "Order fetched", data: { order } });
});

const markShipped = asyncWrapper(async (req, res) => {
  const order = await orderService.markShipped({
    orderId: req.params.id,
    sellerId: req.user.id,
    role: req.user.role,
    trackingData: req.body,
  });
  apiResponse.success(res, {
    message: "Order marked as shipped",
    data: { order },
  });
});

const markDelivered = asyncWrapper(async (req, res) => {
  const order = await orderService.markDelivered({
    orderId: req.params.id,
    buyerId: req.user.id,
    role: req.user.role,
  });
  apiResponse.success(res, {
    message: "Order marked as delivered",
    data: { order },
  });
});

const cancelOrder = asyncWrapper(async (req, res) => {
  const result = await orderService.cancelOrder({
    orderId: req.params.id,
    userId: req.user.id,
    role: req.user.role,
    reason: req.body.reason,
  });

  apiResponse.success(res, {
    message: result.refundInitiated
      ? "Order cancelled. Refund has been initiated and will reflect in 5-7 business days."
      : "Order cancelled successfully",
    data: {
      order: result,
      refundInitiated: result.refundInitiated,
      refundId: result.refundId,
    },
  });
});

module.exports = {
  initiateCheckout,
  verifyPayment,
  razorpayWebhook,
  getMyOrdersAsBuyer,
  getMyOrdersAsSeller,
  getOrderById,
  markShipped,
  markDelivered,
  cancelOrder,
};
