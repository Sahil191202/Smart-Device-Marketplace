// src/modules/orders/order.service.js
const orderRepository = require("./order.repository");
const cartService = require("../cart/cart.service");
const productRepository = require("../products/product.repository");
const userRepository = require("../users/user.repository");
const notificationService = require("../notifications/notification.service");
const {
  createRazorpayOrder,
  verifyPaymentSignature,
} = require("../../config/razorpay");
const { NOTIFICATION_TYPES } = require("../notifications/notification.model");
const AppError = require("../../shared/utils/AppError");
const logger = require("../../config/logger");
const { ORDER_STATUS } = require("./order.model");
const cacheManager = require("../../shared/cache/cache.manager");
const { razorpay } = require("../../config/razorpay");

// Cancellation window: 24 hours after order confirmation
const CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000;

class OrderService {
  // ── Checkout ──────────────────────────────────────────────────────────────

  async initiateCheckout({ buyerId, productId, addressId }) {
    // 1. Validate product
    const product = await productRepository.findById(productId, {
      withSeller: false,
    });
    if (!product) throw AppError.notFound("Product");
    if (product.status !== "active") {
      throw AppError.conflict("This product is no longer available");
    }
    if (product.sellerId.toString() === buyerId) {
      throw AppError.badRequest("You cannot purchase your own product");
    }

    // 2. Validate buyer's delivery address
    const buyer = await userRepository.findById(buyerId);
    if (!buyer) throw AppError.notFound("User");

    const address = buyer.addresses?.find(
      (a) => a._id.toString() === addressId,
    );
    if (!address) throw AppError.notFound("Address");

    // 3. Create Razorpay order
    const amountInPaise = Math.round(product.price * 100);
    const rzpOrder = await createRazorpayOrder(
      amountInPaise,
      `ord_${Date.now()}`,
      {
        productId: productId,
        buyerId: buyerId,
        productTitle: product.title.slice(0, 50),
      },
    );

    // 4. Create pending order in DB
    const primaryImage =
      product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url;

    const order = await orderRepository.create({
      buyerId,
      sellerId: product.sellerId,
      productId,
      amount: product.price,
      currency: "INR",
      productSnapshot: {
        title: product.title,
        brand: product.brand,
        category: product.category,
        condition: product.condition,
        primaryImageUrl: primaryImage,
      },
      deliveryAddress: {
        label: address.label,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country,
      },
      razorpayOrderId: rzpOrder.id,
      timeline: [
        {
          status: ORDER_STATUS.PENDING,
          note: "Order initiated",
          actor: "system",
        },
      ],
    });

    logger.info("Checkout initiated", {
      orderId: order._id,
      productId,
      buyerId,
      amount: product.price,
    });

    return {
      orderId: order._id,
      razorpayOrderId: rzpOrder.id,
      amount: product.price,
      amountInPaise,
      currency: "INR",
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      productSnapshot: order.productSnapshot,
    };
  }

  // ── Payment verification (called by frontend after Razorpay success) ───────

  async verifyPayment({
    orderId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    buyerId,
  }) {
    // 1. Find the pending order
    const order = await orderRepository.findById(orderId);
    if (!order) throw AppError.notFound("Order");

    // Security checks
    if (order.buyerId.toString() !== buyerId) throw AppError.forbidden();
    if (order.razorpayOrderId !== razorpayOrderId) {
      throw AppError.badRequest("Order ID mismatch");
    }
    if (order.status !== ORDER_STATUS.PENDING) {
      throw AppError.conflict(`Order is already ${order.status}`);
    }

    // 2. Verify Razorpay signature (HMAC-SHA256)
    const isValid = verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );
    if (!isValid) {
      logger.warn("Payment signature verification failed", {
        orderId,
        razorpayPaymentId,
      });
      throw AppError.badRequest(
        "Payment verification failed — invalid signature",
      );
    }

    // 3. Atomic: confirm order + mark product sold (with optimistic lock)
    const confirmed = await orderRepository.confirmOrderAndMarkProductSold(
      orderId,
      order.productId,
      {
        razorpayPaymentId,
        razorpaySignature,
        updates: {},
      },
      order.version,
    );

    if (!confirmed) {
      // Version mismatch — another request already processed this order
      // Check current state to give useful error
      const current = await orderRepository.findById(orderId);
      if (current?.status === ORDER_STATUS.CONFIRMED) {
        // Idempotent — already confirmed, return success
        return { order: current, alreadyConfirmed: true };
      }
      throw AppError.conflict(
        "Order was modified concurrently. Please try again.",
      );
    }

    // 4. Clear buyer's cart item
    await cartService
      .removeItem(buyerId, order.productId.toString())
      .catch(() => {});

    // 5. Notify seller
    await this._notifySellerNewOrder(confirmed).catch((err) => {
      logger.warn("Seller notification failed", { error: err.message });
    });

    await cacheManager.invalidateProduct(
      order.productId.toString(),
      order.productSnapshot?.slug,
    );

    logger.info("Payment verified, order confirmed", {
      orderId,
      razorpayPaymentId,
      amount: order.amount,
    });

    return { order: confirmed, alreadyConfirmed: false };
  }

  // ── Razorpay Webhook (payment.captured / payment.failed) ─────────────────

  async handleWebhook({ event, payload }) {
    const paymentEntity = payload?.payment?.entity;
    if (!paymentEntity) return;

    const razorpayOrderId = paymentEntity.order_id;
    if (!razorpayOrderId) return;

    const order = await orderRepository.findByRazorpayOrderId(razorpayOrderId);
    if (!order) {
      logger.warn("Webhook received for unknown order", {
        razorpayOrderId,
        event,
      });
      return;
    }

    logger.info("Razorpay webhook received", {
      event,
      orderId: order._id,
      razorpayOrderId,
    });

    if (event === "payment.captured") {
      if (order.status !== ORDER_STATUS.PENDING) {
        logger.info("Webhook: order already processed", {
          orderId: order._id,
          status: order.status,
        });
        return; // idempotent — webhook received twice
      }

      const confirmed = await orderRepository.confirmOrderAndMarkProductSold(
        order._id,
        order.productId,
        {
          razorpayPaymentId: paymentEntity.id,
          razorpaySignature: "",
          updates: {},
        },
        order.version,
      );

      if (confirmed) {
        await this._notifySellerNewOrder(confirmed).catch(() => {});
        logger.info("Webhook: order confirmed", { orderId: order._id });
      }
    }

    if (event === "payment.failed") {
      if (order.status !== ORDER_STATUS.PENDING) return;

      await orderRepository.updateWithVersion(order._id, order.version, {
        status: ORDER_STATUS.CANCELLED,
        cancelReason: `Payment failed: ${paymentEntity.error_description || "Unknown error"}`,
        cancelledBy: "system",
      });

      await orderRepository.addTimelineEvent(order._id, {
        status: ORDER_STATUS.CANCELLED,
        note: `Payment failed: ${paymentEntity.error_description}`,
        actor: "system",
      });

      logger.info("Webhook: order cancelled due to payment failure", {
        orderId: order._id,
      });
    }
  }

  // ── Order lifecycle ───────────────────────────────────────────────────────

  async markShipped({ orderId, sellerId, role, trackingData }) {
    const order = await this._getOrderWithOwnerCheck(
      orderId,
      sellerId,
      role,
      "seller",
    );

    if (!order.canTransitionTo(ORDER_STATUS.SHIPPED)) {
      throw AppError.badRequest(
        `Cannot mark as shipped from status: ${order.status}`,
      );
    }

    const updated = await orderRepository.updateWithVersion(
      order._id,
      order.version,
      {
        status: ORDER_STATUS.SHIPPED,
        tracking: trackingData,
      },
    );

    if (!updated) throw AppError.conflict("Order was modified concurrently");

    await orderRepository.addTimelineEvent(orderId, {
      status: ORDER_STATUS.SHIPPED,
      note: `Shipped via ${trackingData.courier}. Tracking: ${trackingData.trackingNumber}`,
      actor: "seller",
      actorId: sellerId,
      metadata: trackingData,
    });

    // Get buyer details for email
    const User = require("../users/user.model");
    const buyer = await User.findById(order.buyerId)
      .select("name email")
      .lean();

    // Notify buyer (in-app + email)
    await notificationService.create({
      userId: order.buyerId,
      type: NOTIFICATION_TYPES.ORDER_UPDATE,
      title: "📦 Your order has been shipped!",
      body: `${order.productSnapshot.title} is on its way. Tracking: ${trackingData.trackingNumber}`,
      metadata: {
        orderId: order._id.toString(),
        status: "shipped",
        ...trackingData,
      },
      actionUrl: `/orders/${order._id}`,
      sendEmail: true, // ← trigger email
      emailData: {
        to: buyer?.email, // ← buyer email
        name: buyer?.name,
        productTitle: order.productSnapshot.title,
        courier: trackingData.courier,
        trackingNumber: trackingData.trackingNumber,
        trackingUrl: trackingData.trackingUrl,
        estimatedDelivery: trackingData.estimatedDelivery,
        orderId: order._id.toString(),
      },
    });

    return updated;
  }

  async markDelivered({ orderId, buyerId, role }) {
    const order = await this._getOrderWithOwnerCheck(
      orderId,
      buyerId,
      role,
      "buyer",
    );

    if (!order.canTransitionTo(ORDER_STATUS.DELIVERED)) {
      throw AppError.badRequest(
        `Cannot mark as delivered from status: ${order.status}`,
      );
    }

    const updated = await orderRepository.updateWithVersion(
      order._id,
      order.version,
      {
        status: ORDER_STATUS.DELIVERED,
      },
    );

    if (!updated) throw AppError.conflict("Order was modified concurrently");

    await orderRepository.addTimelineEvent(orderId, {
      status: ORDER_STATUS.DELIVERED,
      note: "Delivery confirmed by buyer",
      actor: "buyer",
      actorId: buyerId,
    });

    logger.info("Order delivered", { orderId });
    return updated;
  }

  async cancelOrder({ orderId, userId, role, reason }) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw AppError.notFound("Order");

    // Ownership check
    const isBuyer = order.buyerId.toString() === userId;
    const isSeller = order.sellerId.toString() === userId;

    if (!isBuyer && !isSeller && role !== "admin") {
      throw AppError.forbidden();
    }

    if (!order.canTransitionTo("cancelled")) {
      throw AppError.badRequest(
        `Cannot cancel an order with status: ${order.status}`,
      );
    }

    // Buyers: only within 24h of confirmation
    if (isBuyer && order.status === "confirmed") {
      const confirmedAt = order.timeline.find(
        (e) => e.status === "confirmed",
      )?.createdAt;
      if (
        confirmedAt &&
        Date.now() - new Date(confirmedAt).getTime() > CANCELLATION_WINDOW_MS
      ) {
        throw AppError.badRequest(
          "Cancellation window has passed (24 hours after confirmation)",
        );
      }
    }

    const actor = role === "admin" ? "admin" : isBuyer ? "buyer" : "seller";

    // ── Attempt Razorpay refund if payment was captured ───────────────────────
    let refundInitiated = false;
    let refundId = null;

    if (order.razorpayPaymentId && order.status === "confirmed") {
      try {
        const refund = await razorpay.payments.refund(order.razorpayPaymentId, {
          amount: order.amount * 100, // paise
          notes: {
            orderId: order._id.toString(),
            reason: reason,
            initiatedBy: actor,
          },
        });
        refundInitiated = true;
        refundId = refund.id;
        logger.info("Razorpay refund initiated", {
          orderId: order._id,
          refundId: refund.id,
          amount: order.amount,
        });
      } catch (refundErr) {
        // Log but don't fail the cancellation
        logger.error("Razorpay refund failed", {
          orderId: order._id,
          paymentId: order.razorpayPaymentId,
          error: refundErr.message,
        });
      }
    }

    const updated = await orderRepository.updateWithVersion(
      order._id,
      order.version,
      {
        status: "cancelled",
        cancelReason: reason,
        cancelledBy: actor,
        // If refund initiated, move to refunded status
        ...(refundInitiated && { status: "refunded" }),
      },
    );

    if (!updated) throw AppError.conflict("Order was modified concurrently");

    await orderRepository.addTimelineEvent(orderId, {
      status: refundInitiated ? "refunded" : "cancelled",
      note: refundInitiated
        ? `Cancelled by ${actor}. Refund initiated (ID: ${refundId}). Reason: ${reason}`
        : `Cancelled by ${actor}. Reason: ${reason}`,
      actor,
      actorId: userId,
      metadata: { refundId, refundInitiated },
    });

    // Re-activate product
    const Product = require("../products/product.model");
    await Product.updateOne(
      { _id: order.productId, status: "sold" },
      { $set: { status: "active" } },
    );

    // Notify the other party
    const notifyUserId = isBuyer ? order.sellerId : order.buyerId;
    const notificationBody = refundInitiated
      ? `Order for ${order.productSnapshot.title} was cancelled. Refund of ₹${order.amount.toLocaleString("en-IN")} has been initiated.`
      : `Order for ${order.productSnapshot.title} was cancelled. Reason: ${reason}`;

    await notificationService
      .create({
        userId: notifyUserId,
        type: NOTIFICATION_TYPES.ORDER_UPDATE,
        title: refundInitiated
          ? "Order Cancelled — Refund Initiated"
          : "Order Cancelled",
        body: notificationBody,
        metadata: {
          orderId: order._id.toString(),
          status: "cancelled",
          refundInitiated,
          refundId,
        },
        actionUrl: `/orders/${order._id}`,
      })
      .catch(() => {});

    // Also notify buyer if seller cancelled
    if (isSeller && order.razorpayPaymentId) {
      await notificationService
        .create({
          userId: order.buyerId,
          type: NOTIFICATION_TYPES.ORDER_UPDATE,
          title: "Order Cancelled by Seller",
          body: refundInitiated
            ? `The seller cancelled your order for ${order.productSnapshot.title}. Refund of ₹${order.amount.toLocaleString("en-IN")} initiated.`
            : `The seller cancelled your order for ${order.productSnapshot.title}.`,
          metadata: {
            orderId: order._id.toString(),
            refundInitiated,
            refundId,
          },
          actionUrl: `/orders/${order._id}`,
        })
        .catch(() => {});
    }

    logger.info("Order cancelled", { orderId, actor, reason, refundInitiated });
    return { ...updated, refundInitiated, refundId };
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async getMyOrdersAsBuyer(buyerId, query) {
    return orderRepository.findByBuyer(buyerId, query);
  }

  async getMyOrdersAsSeller(sellerId, query) {
    return orderRepository.findBySeller(sellerId, query);
  }

  async getOrderById(orderId, userId, role) {
    const order = await orderRepository.findById(orderId, {
      withBuyer: true,
      withSeller: true,
      withProduct: true,
    });
    if (!order) throw AppError.notFound("Order");

    const isBuyer = order.buyerId._id?.toString() === userId;
    const isSeller = order.sellerId._id?.toString() === userId;
    if (!isBuyer && !isSeller && role !== "admin") {
      throw AppError.forbidden();
    }

    return order;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  async _getOrderWithOwnerCheck(orderId, userId, role, expectedRole) {
    const Order = require("./order.model");
    const order = await Order.findById(orderId);
    if (!order) throw AppError.notFound("Order");

    if (role !== "admin") {
      const field = expectedRole === "seller" ? "sellerId" : "buyerId";
      if (order[field].toString() !== userId) throw AppError.forbidden();
    }

    return order; // return Mongoose doc (not lean) for instance methods
  }

  async _notifySellerNewOrder(order) {
    const User = require("../users/user.model");

    // Get seller + buyer details
    const [seller, buyer] = await Promise.all([
      User.findById(order.sellerId).select("name email").lean(),
      User.findById(order.buyerId).select("name").lean(),
    ]);

    if (!seller) return;

    await notificationService.create({
      userId: order.sellerId,
      type: NOTIFICATION_TYPES.PRODUCT_SOLD,
      title: "🎉 Your product sold!",
      body: `${order.productSnapshot.title} sold for ₹${order.amount.toLocaleString("en-IN")}`,
      metadata: {
        orderId: order._id.toString(),
        productTitle: order.productSnapshot.title,
        amount: order.amount,
      },
      actionUrl: `/seller/orders/${order._id}`,
      sendEmail: true,
      emailData: {
        to: seller.email, // ← was missing
        name: seller.name, // ← was missing
        productTitle: order.productSnapshot.title,
        amount: order.amount,
        buyerName: buyer?.name || "Verified Buyer",
        orderId: order._id.toString(),
      },
    });
  }
}

module.exports = new OrderService();
