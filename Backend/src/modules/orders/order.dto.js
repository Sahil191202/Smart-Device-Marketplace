// src/modules/orders/order.dto.js
const Joi = require('joi');

const checkoutDto = Joi.object({
  productId: Joi.string().hex().length(24).required(),
  addressId: Joi.string().hex().length(24).required(),
});

const verifyPaymentDto = Joi.object({
  orderId: Joi.string().hex().length(24).required(),         // our DB order ID
  razorpayOrderId: Joi.string().required(),
  razorpayPaymentId: Joi.string().required(),
  razorpaySignature: Joi.string().required(),
});

const updateShippingDto = Joi.object({
  courier: Joi.string().trim().max(50).required(),
  trackingNumber: Joi.string().trim().max(100).required(),
  trackingUrl: Joi.string().uri().allow('').optional(),
  estimatedDelivery: Joi.date().greater('now').optional(),
});

const cancelOrderDto = Joi.object({
  reason: Joi.string().trim().min(5).max(300).required(),
});

const listOrdersDto = Joi.object({
  cursor: Joi.string().allow(''),
  limit: Joi.number().min(1).max(50).default(20),
  status: Joi.string().valid(
    'pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'
  ),
});

module.exports = {
  checkoutDto,
  verifyPaymentDto,
  updateShippingDto,
  cancelOrderDto,
  listOrdersDto,
};