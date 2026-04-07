// src/modules/cart/cart.service.js
const { getRedisClient } = require('../../config/redis');
const productRepository = require('../products/product.repository');
const AppError = require('../../shared/utils/AppError');
const logger = require('../../config/logger');

const CART_TTL = 60 * 60 * 24 * 7; // 7 days — abandoned carts auto-expire

const cartKey = (userId) => `cart:${userId}`;

class CartService {

  /**
   * Cart structure in Redis (Hash):
   * Key:   cart:{userId}
   * Field: {productId}
   * Value: JSON { productId, title, price, primaryImageUrl, addedAt, sellerId }
   *
   * Why Hash instead of List or String?
   * - O(1) add/remove by productId
   * - Each item independently accessible
   * - HGETALL for full cart in one call
   */

  async addItem(userId, productId) {
    const redis = getRedisClient();

    // Validate product is active and get current details
    const product = await productRepository.findById(productId, { withSeller: false });
    if (!product) throw AppError.notFound('Product');
    if (product.status !== 'active') {
      throw AppError.badRequest('This product is no longer available');
    }
    if (product.sellerId.toString() === userId) {
      throw AppError.badRequest('You cannot buy your own product');
    }

    const cartItem = JSON.stringify({
      productId: product._id.toString(),
      title: product.title,
      price: product.price,
      primaryImageUrl: product.images?.find(i => i.isPrimary)?.url || product.images?.[0]?.url || null,
      sellerId: product.sellerId.toString(),
      category: product.category,
      condition: product.condition,
      addedAt: new Date().toISOString(),
    });

    const key = cartKey(userId);
    await redis.hSet(key, productId, cartItem);
    await redis.expire(key, CART_TTL); // refresh TTL on every interaction

    const count = await redis.hLen(key);
    logger.debug('Item added to cart', { userId, productId, cartSize: count });

    return { productId, added: true, cartSize: count };
  }

  async removeItem(userId, productId) {
    const redis = getRedisClient();
    const removed = await redis.hDel(cartKey(userId), productId);
    if (!removed) throw AppError.notFound('Cart item');
    return { productId, removed: true };
  }

  async getCart(userId) {
    const redis = getRedisClient();
    const key = cartKey(userId);
    const raw = await redis.hGetAll(key);

    if (!raw || Object.keys(raw).length === 0) {
      return { items: [], total: 0, itemCount: 0 };
    }

    const items = Object.values(raw).map(v => JSON.parse(v));

    // Refresh prices + availability in real-time
    // Only fetch from DB if cart is non-empty
    const productIds = items.map(i => i.productId);
    const freshProducts = await productRepository.findManyByIds(productIds);
    const freshMap = new Map(freshProducts.map(p => [p._id.toString(), p]));

    const enriched = items.map(item => {
      const fresh = freshMap.get(item.productId);
      return {
        ...item,
        currentPrice: fresh?.price || item.price,
        priceChanged: fresh ? fresh.price !== item.price : false,
        isAvailable: fresh?.status === 'active',
        status: fresh?.status || 'unknown',
      };
    });

    const total = enriched
      .filter(i => i.isAvailable)
      .reduce((sum, i) => sum + i.currentPrice, 0);

    return {
      items: enriched,
      total: Math.round(total),
      itemCount: enriched.length,
      hasUnavailableItems: enriched.some(i => !i.isAvailable),
    };
  }

  async clearCart(userId) {
    const redis = getRedisClient();
    await redis.del(cartKey(userId));
  }

  async getCartItem(userId, productId) {
    const redis = getRedisClient();
    const raw = await redis.hGet(cartKey(userId), productId);
    if (!raw) return null;
    return JSON.parse(raw);
  }

  async getCartItemCount(userId) {
    const redis = getRedisClient();
    return redis.hLen(cartKey(userId));
  }
}

module.exports = new CartService();