// src/modules/orders/order.repository.js
const mongoose = require('mongoose');
const Order = require('./order.model');

class OrderRepository {

  async create(data) {
    return Order.create(data);
  }

  async findById(orderId, options = {}) {
    const query = Order.findById(orderId);
    if (options.withBuyer) query.populate('buyerId', 'name email avatar');
    if (options.withSeller) query.populate('sellerId', 'name email avatar');
    if (options.withProduct) query.populate('productId', 'title slug images');
    return query.lean();
  }

  async findByRazorpayOrderId(razorpayOrderId) {
    return Order.findOne({ razorpayOrderId }).lean();
  }

  async findByBuyer(buyerId, { cursor, limit = 20, status } = {}) {
    return this._findPaginated({ buyerId }, { cursor, limit, status });
  }

  async findBySeller(sellerId, { cursor, limit = 20, status } = {}) {
    return this._findPaginated({ sellerId }, { cursor, limit, status });
  }

  async findAllAdmin({ cursor, limit = 20, status } = {}) {
    return this._findPaginated({}, { cursor, limit, status });
  }

  /**
   * Optimistic lock update.
   * Matches BOTH _id AND current version — if another process already
   * updated this order (version mismatch), this update returns null.
   * Caller treats null as a concurrency conflict → 409 response.
   */
  async updateWithVersion(orderId, currentVersion, updates) {
    return Order.findOneAndUpdate(
      { _id: orderId, version: currentVersion },
      {
        $set: updates,
        $inc: { version: 1 },        // increment version on every update
      },
      { new: true, runValidators: true }
    ).lean();
  }

  /**
   * Confirm order + mark product as sold atomically.
   * Uses session for multi-document atomicity (requires replica set).
   */
  async confirmOrderAndMarkProductSold(orderId, productId, paymentData, currentVersion) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const Product = require('../products/product.model');

      // 1. Confirm order (with version check)
      const order = await Order.findOneAndUpdate(
        { _id: orderId, version: currentVersion, status: 'pending' },
        {
          $set: {
            status: 'confirmed',
            razorpayPaymentId: paymentData.razorpayPaymentId,
            razorpaySignature: paymentData.razorpaySignature,
            ...paymentData.updates,
          },
          $inc: { version: 1 },
          $push: {
            timeline: {
              status: 'confirmed',
              note: 'Payment received successfully',
              actor: 'system',
              metadata: { razorpayPaymentId: paymentData.razorpayPaymentId },
            },
          },
        },
        { new: true, session }
      );

      if (!order) {
        await session.abortTransaction();
        return null; // version mismatch or already confirmed
      }

      // 2. Mark product as sold
      await Product.updateOne(
        { _id: productId, status: 'active' },
        { $set: { status: 'sold' } },
        { session }
      );

      await session.commitTransaction();
      return order;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async addTimelineEvent(orderId, event) {
    return Order.findByIdAndUpdate(
      orderId,
      { $push: { timeline: event }, $inc: { version: 1 } },
      { new: true }
    ).lean();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  async _findPaginated(baseFilter, { cursor, limit = 20, status } = {}) {
    const query = { ...baseFilter };
    if (status) query.status = status;

    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
        query._id = { $lt: new mongoose.Types.ObjectId(decoded.id) };
      } catch { /* ignore */ }
    }

    const items = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate('productId', 'title slug images')
      .populate('buyerId', 'name avatar')
      .populate('sellerId', 'name avatar')
      .lean();

    const hasNext = items.length > limit;
    const results = hasNext ? items.slice(0, limit) : items;

    let nextCursor = null;
    if (hasNext && results.length > 0) {
      const last = results[results.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ id: last._id.toString() })).toString('base64');
    }

    return { items: results, nextCursor, hasNext };
  }
}

module.exports = new OrderRepository();