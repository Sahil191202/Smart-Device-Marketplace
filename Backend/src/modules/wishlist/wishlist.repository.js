// src/modules/wishlist/wishlist.repository.js
const Wishlist = require('./wishlist.model');
const mongoose = require('mongoose');

class WishlistRepository {

  async add(userId, productId, savedPrice) {
    // upsert: if already exists, just update savedPrice
    return Wishlist.findOneAndUpdate(
      { userId, productId },
      { $set: { savedPrice }, $setOnInsert: { alertCount: 0 } },
      { upsert: true, new: true }
    );
  }

  async remove(userId, productId) {
    return Wishlist.findOneAndDelete({ userId, productId });
  }

  async findByUser(userId, { cursor, limit = 20 } = {}) {
    const query = { userId: new mongoose.Types.ObjectId(userId) };

    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
        query._id = { $lt: new mongoose.Types.ObjectId(decoded.id) };
      } catch { /* ignore bad cursor */ }
    }

    const items = await Wishlist.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate({
        path: 'productId',
        select: 'title slug price images category brand condition status predictedPrice sellerId',
        populate: { path: 'sellerId', select: 'name avatar' },
      })
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

  async isWishlisted(userId, productId) {
    const entry = await Wishlist.findOne({ userId, productId }).select('_id').lean();
    return !!entry;
  }

  /**
   * Bulk membership check — for a list of productIds, return which ones
   * the user has wishlisted. Used to inject isWishlisted flag on product list.
   * ONE query for the entire page of products (no N+1).
   */
  async getBulkWishlistStatus(userId, productIds) {
    const entries = await Wishlist.find({
      userId: new mongoose.Types.ObjectId(userId),
      productId: { $in: productIds.map(id => new mongoose.Types.ObjectId(id)) },
    }).select('productId').lean();

    // Return a Set for O(1) lookup
    return new Set(entries.map(e => e.productId.toString()));
  }

  async countByUser(userId) {
    return Wishlist.countDocuments({ userId });
  }

  /**
   * Find all wishlist entries for a product where the current price
   * has dropped below savedPrice by at least the given threshold.
   * Called by the price drop scheduler.
   */
  async findEntriesWithPriceDrop(productId, currentPrice, dropThresholdPct = 5) {
    const maxSavedPrice = currentPrice / (1 - dropThresholdPct / 100);

    return Wishlist.find({
      productId: new mongoose.Types.ObjectId(productId),
      savedPrice: { $gt: maxSavedPrice }, // savedPrice was higher → price dropped
    })
      .populate('userId', 'name email')
      .lean();
  }

  /**
   * Fetch all unique productIds across all wishlists.
   * Used by scheduler to check current prices.
   */
  async getDistinctWishlistedProductIds() {
    return Wishlist.distinct('productId');
  }

  async updateLastAlertAt(wishlistId) {
    return Wishlist.updateOne(
      { _id: wishlistId },
      {
        $set: { lastAlertAt: new Date() },
        $inc: { alertCount: 1 },
      }
    );
  }

  /**
   * After a price drop alert, update the savedPrice snapshot
   * so the next alert compares against the new lower price
   * (prevents repeated alerts on the same price drop).
   */
  async updateSavedPrice(userId, productId, newPrice) {
    return Wishlist.updateOne(
      { userId, productId },
      { $set: { savedPrice: newPrice } }
    );
  }
}

module.exports = new WishlistRepository();