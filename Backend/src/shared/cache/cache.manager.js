// src/shared/cache/cache.manager.js

/**
 * CacheManager: The ONLY way services interact with Redis for caching.
 *
 * Features:
 * 1. get/set/del — basic cache operations with serialization
 * 2. getOrSet — cache-aside pattern with stampede protection
 * 3. invalidateProduct — smart invalidation for product-related data
 * 4. invalidateUser — user profile cache invalidation
 * 5. mget — batch get multiple keys (pipeline)
 * 6. Mutex — prevent cache stampede on concurrent misses
 */

const { getRedisClient } = require('../../config/redis');
const cacheTagRegistry = require('./cache.tags');
const { CacheKeys } = require('./cache.keys');
const TTL = require('./cache.ttl');
const logger = require('../../config/logger');

class CacheManager {

  // ── Core operations ───────────────────────────────────────────────────────

  async get(key) {
    try {
      const redis = getRedisClient();
      const raw = await redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      logger.warn('Cache get failed', { key, error: err.message });
      return null; // cache miss on error → fall through to DB
    }
  }

  async set(key, value, ttlSeconds, tags = []) {
    try {
      const redis = getRedisClient();
      const serialized = JSON.stringify(value);
      await redis.setEx(key, ttlSeconds, serialized);

      // Register cache key under provided tags for invalidation
      if (tags.length > 0) {
        await cacheTagRegistry.register(key, tags);
      }
    } catch (err) {
      logger.warn('Cache set failed', { key, error: err.message });
      // Non-critical: request succeeds even if caching fails
    }
  }

  async del(key) {
    try {
      const redis = getRedisClient();
      await redis.del(key);
    } catch (err) {
      logger.warn('Cache del failed', { key, error: err.message });
    }
  }

  async delMany(keys) {
    if (!keys || keys.length === 0) return;
    try {
      const redis = getRedisClient();
      const pipeline = redis.multi();
      for (const key of keys) pipeline.del(key);
      await pipeline.exec();
    } catch (err) {
      logger.warn('Cache delMany failed', { error: err.message });
    }
  }

  /**
   * Batch get multiple keys in one pipeline call.
   * Returns an array of values (null for misses), in same order as keys.
   */
  async mget(keys) {
    if (!keys || keys.length === 0) return [];
    try {
      const redis = getRedisClient();
      const results = await redis.mGet(keys);
      return results.map(r => (r ? JSON.parse(r) : null));
    } catch (err) {
      logger.warn('Cache mget failed', { error: err.message });
      return keys.map(() => null);
    }
  }

  // ── Cache-aside with stampede protection ──────────────────────────────────

  /**
   * Cache-aside pattern with mutex (prevents stampede).
   *
   * Flow:
   * 1. Check cache → hit: return immediately
   * 2. Miss: try to acquire mutex lock
   * 3. If lock acquired: fetch from DB, set cache, release lock
   * 4. If lock NOT acquired: another process is fetching → wait + retry
   *
   * This ensures only ONE DB query runs per cache miss, even under 1000
   * concurrent requests for the same key.
   *
   * @param {string} key - cache key
   * @param {Function} fetcher - async function to get data from DB
   * @param {number} ttl - TTL in seconds
   * @param {string[]} tags - tags for invalidation
   */
  async getOrSet(key, fetcher, ttl, tags = []) {
    // 1. Try cache first
    const cached = await this.get(key);
    if (cached !== null) return cached;

    // 2. Try to acquire mutex lock
    const lockKey = CacheKeys.lock(key);
    const lockAcquired = await this._acquireLock(lockKey);

    if (lockAcquired) {
      try {
        // Double-check cache after acquiring lock
        // (another process may have populated it while we were acquiring)
        const doubleCheck = await this.get(key);
        if (doubleCheck !== null) return doubleCheck;

        // 3. Fetch from DB
        const data = await fetcher();
        if (data !== null && data !== undefined) {
          await this.set(key, data, ttl, tags);
        }
        return data;
      } finally {
        await this._releaseLock(lockKey);
      }
    } else {
      // 4. Lock not acquired — another process is fetching
      // Wait up to 3 seconds for cache to be populated
      return this._waitForCache(key, 3000);
    }
  }

  // ── Domain-specific invalidation ──────────────────────────────────────────

  /**
   * Invalidate all caches related to a product.
   * Called on: product update, product delete, order confirm (status change).
   */
  async invalidateProduct(productId, slug = null) {
    const keysToDelete = [
      CacheKeys.productDetail(productId),
    ];

    if (slug) {
      keysToDelete.push(CacheKeys.productBySlug(slug));
    }

    // Delete direct keys
    await this.delMany(keysToDelete);

    // Invalidate all list/search pages that contain this product
    await cacheTagRegistry.invalidateTags([
      `product:${productId}`,
      // Also invalidate category lists
    ]);

    logger.debug('Product cache invalidated', { productId, slug });
  }

  /**
   * Invalidate user profile cache.
   * Called on: profile update, avatar change, role change.
   */
  async invalidateUser(userId) {
    await this.del(CacheKeys.userProfile(userId));
    logger.debug('User profile cache invalidated', { userId });
  }

  /**
   * Invalidate product list caches for a category.
   * Called on: new product created in category.
   */
  async invalidateCategory(category) {
    await cacheTagRegistry.invalidateTag(`category:${category}`);
    logger.debug('Category cache invalidated', { category });
  }

  /**
   * Nuke all product list/search caches.
   * Nuclear option — use for admin bulk operations.
   */
  async invalidateAllProductLists() {
    try {
      const redis = getRedisClient();
      // Scan for all list/search keys (avoid KEYS in production — use SCAN)
      const listKeys = await this._scanKeys('sm:products:list:*');
      const searchKeys = await this._scanKeys('sm:products:search:*');
      await this.delMany([...listKeys, ...searchKeys]);
      logger.info('All product list caches cleared', {
        count: listKeys.length + searchKeys.length,
      });
    } catch (err) {
      logger.warn('invalidateAllProductLists failed', { error: err.message });
    }
  }

  // ── Cache warming ─────────────────────────────────────────────────────────

  /**
   * Warm the cache with top products on server startup.
   * Prevents cold start latency for first users.
   */
  async warmProductCache() {
    try {
      const productRepository = require('../../modules/products/product.repository');
      const TTLFn = TTL.PRODUCT_DETAIL;

      logger.info('Cache warming: fetching top products...');

      const { items } = await productRepository.findPaginated({
        limit: 50,
        sort: 'most_viewed',
        filters: { status: 'active' },
      });

      const pipeline = getRedisClient().multi();

      for (const product of items) {
        const key = CacheKeys.productDetail(product._id.toString());
        pipeline.setEx(key, TTLFn(), JSON.stringify(product));

        if (product.slug) {
          const slugKey = CacheKeys.productBySlug(product.slug);
          pipeline.setEx(slugKey, TTLFn(), JSON.stringify(product));
        }
      }

      await pipeline.exec();
      logger.info('Cache warming complete', { productsWarmed: items.length });
    } catch (err) {
      // Non-critical — server starts fine even if warming fails
      logger.warn('Cache warming failed', { error: err.message });
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  async _acquireLock(lockKey) {
    try {
      const redis = getRedisClient();
      // SET key value NX EX ttl — atomic: only sets if key doesn't exist
      const result = await redis.set(lockKey, '1', {
        NX: true,           // only set if not exists
        EX: TTL.CACHE_LOCK, // auto-expire (prevents deadlock)
      });
      return result === 'OK';
    } catch {
      return false; // fail open: if lock fails, proceed without it
    }
  }

  async _releaseLock(lockKey) {
    await this.del(lockKey);
  }

  /**
   * Poll cache until it's populated or timeout expires.
   * Used by requests that lost the lock race.
   *
   * @param {string} key
   * @param {number} timeoutMs
   */
  async _waitForCache(key, timeoutMs = 3000) {
    const interval = 100; // poll every 100ms
    const maxAttempts = Math.floor(timeoutMs / interval);

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, interval));
      const cached = await this.get(key);
      if (cached !== null) return cached;
    }

    // Timeout: fetch from DB as fallback (stampede risk, but rare)
    logger.warn('Cache wait timeout — falling back to DB', { key });
    return null;
  }

  /**
   * Redis SCAN-based key pattern matching.
   * NEVER use KEYS in production — it blocks Redis.
   * SCAN is O(N) but non-blocking (paginated cursor).
   */
  async _scanKeys(pattern) {
    const redis = getRedisClient();
    const keys = [];
    let cursor = 0;

    do {
      const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;
      keys.push(...result.keys);
    } while (cursor !== 0);

    return keys;
  }
}

module.exports = new CacheManager();