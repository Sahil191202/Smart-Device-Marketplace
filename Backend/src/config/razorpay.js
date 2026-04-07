// src/config/razorpay.js
const Razorpay = require('razorpay');
const crypto = require('crypto');
const env = require('./env');
const logger = require('./logger');

const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

/**
 * Create a Razorpay order.
 * Returns orderId that frontend uses to open the payment modal.
 *
 * @param {number} amountInPaise - amount * 100 (Razorpay uses smallest currency unit)
 * @param {string} receipt - our internal orderId for tracking
 */
const createRazorpayOrder = async (amountInPaise, receipt, notes = {}) => {
  try {
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: receipt.slice(0, 40), // Razorpay receipt max 40 chars
      notes,
    });
    return order;
  } catch (err) {
    logger.error('Razorpay order creation failed', { error: err.message });
    throw new Error(`Payment gateway error: ${err.message}`);
  }
};

/**
 * Verify Razorpay webhook signature.
 * Razorpay signs webhooks with HMAC-SHA256.
 * MUST verify before processing — prevents fake webhook attacks.
 *
 * @param {string} rawBody - raw request body string (not parsed JSON)
 * @param {string} signature - X-Razorpay-Signature header
 */
const verifyWebhookSignature = (rawBody, signature) => {
  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  const expected = Buffer.from(expectedSignature, 'hex');
  const received = Buffer.from(signature, 'hex');

  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
};

/**
 * Verify payment signature from frontend after payment success.
 * Frontend sends: razorpay_order_id + razorpay_payment_id + razorpay_signature
 */
const verifyPaymentSignature = (orderId, paymentId, signature) => {
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
};

module.exports = { razorpay, createRazorpayOrder, verifyWebhookSignature, verifyPaymentSignature };