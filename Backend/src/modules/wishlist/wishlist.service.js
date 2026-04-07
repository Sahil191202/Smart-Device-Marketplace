// src/modules/wishlist/wishlist.service.js
const wishlistRepository = require('./wishlist.repository');
const productRepository = require('../products/product.repository');
const notificationService = require('../notifications/notification.service');
const AppError = require('../../shared/utils/AppError');
const logger = require('../../config/logger');

class WishlistService {

  async addToWishlist(userId, productId) {
    // Verify product exists and is active
    const product = await productRepository.findById(productId);
    if (!product) throw AppError.notFound('Product');
    if (product.status !== 'active') {
      throw AppError.badRequest('Only active products can be wishlisted');
    }

    // Upsert: adding an already-wishlisted product updates savedPrice
    // (useful if user removes + re-adds after price changes)
    const entry = await wishlistRepository.add(userId, productId, product.price);

    logger.info('Product wishlisted', { userId, productId, price: product.price });

    return {
      wishlisted: true,
      savedPrice: entry.savedPrice,
      productId,
    };
  }

  async removeFromWishlist(userId, productId) {
    const entry = await wishlistRepository.remove(userId, productId);
    if (!entry) throw AppError.notFound('Wishlist entry');

    logger.info('Product removed from wishlist', { userId, productId });
    return { wishlisted: false, productId };
  }

  async getWishlist(userId, { cursor, limit }) {
    const result = await wishlistRepository.findByUser(userId, { cursor, limit });

    // Filter out removed products (product.status may have changed)
    // and annotate each entry with price change info
    const enriched = result.items
      .filter(item => item.productId && item.productId.status !== 'removed')
      .map(item => {
        const product = item.productId;
        const priceDrop = item.savedPrice - (product?.price || item.savedPrice);
        const dropPct = item.savedPrice > 0
          ? ((priceDrop / item.savedPrice) * 100).toFixed(1)
          : 0;

        return {
          _id: item._id,
          product,
          savedPrice: item.savedPrice,
          currentPrice: product?.price,
          priceDrop: priceDrop > 0 ? Math.round(priceDrop) : 0,
          dropPercent: priceDrop > 0 ? parseFloat(dropPct) : 0,
          addedAt: item.createdAt,
        };
      });

    return {
      items: enriched,
      nextCursor: result.nextCursor,
      hasNext: result.hasNext,
    };
  }

  async checkWishlisted(userId, productId) {
    return wishlistRepository.isWishlisted(userId, productId);
  }

  async getBulkWishlistStatus(userId, productIds) {
    return wishlistRepository.getBulkWishlistStatus(userId, productIds);
  }

  async getWishlistCount(userId) {
    return wishlistRepository.countByUser(userId);
  }

  /**
   * Called by price drop scheduler when a product's price changes.
   * Finds all users who wishlisted this product at a higher price
   * and sends them alerts.
   *
   * @param {string} productId
   * @param {number} currentPrice - the new (lower) price
   * @param {string} productTitle
   * @param {string} productSlug
   */
  async processPriceDrop(productId, currentPrice, productTitle, productSlug) {
    const DROP_THRESHOLD_PCT = 5; // only alert on 5%+ drops

    const affectedEntries = await wishlistRepository.findEntriesWithPriceDrop(
      productId,
      currentPrice,
      DROP_THRESHOLD_PCT
    );

    if (affectedEntries.length === 0) return;

    logger.info('Price drop detected', {
      productId,
      productTitle,
      currentPrice,
      affectedUsers: affectedEntries.length,
    });

    // Send notifications to all affected users
    await Promise.allSettled(
      affectedEntries.map(async (entry) => {
        const user = entry.userId;
        const oldPrice = entry.savedPrice;
        const dropAmt = Math.round(oldPrice - currentPrice);
        const dropPct = ((dropAmt / oldPrice) * 100).toFixed(1);

        // Create in-app notification
        await notificationService.createPriceDropNotification({
          userId: user._id,
          productId,
          productTitle,
          productSlug,
          oldPrice,
          newPrice: currentPrice,
          dropAmount: dropAmt,
          dropPercent: parseFloat(dropPct),
        });

        // Update savedPrice snapshot to new price
        // (prevents duplicate alerts on the same price point)
        await wishlistRepository.updateSavedPrice(user._id, productId, currentPrice);
        await wishlistRepository.updateLastAlertAt(entry._id);
      })
    );
  }
}

module.exports = new WishlistService();