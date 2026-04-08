// src/shared/cache/cache.tags.js

/**
 * Tag-based cache invalidation.
 *
 * Problem: When product #123 is updated, which list/search caches contain it?
 * We don't know — list keys are hashed from query params.
 *
 * Solution: Tag registry
 * - When we cache a list page, we register its key under each product's tag
 * - When product #123 is updated, we look up its tag → get all list keys → delete them
 *
 * Redis structure:
 *   sm:tags:product:{id} → SET of cache keys that contain this product
 *
 * Why Redis SET (not list)?
 * - Automatic deduplication (same key won't appear twice)
 * - SCARD for count, SMEMBERS for all keys, SREM for removal
 *
 * Limitations:
 * - Tag sets grow over time → prune with TTL (same as cached items)
 * - Best-effort: if Redis restarts, tags are lost (cache is cold anyway)
 */

const { getRedisClient } = require('../../config/redis');
const { CacheKeys } = require('./cache.keys');
const logger = require('../../config/logger');

const TAG_TTL = 60 * 60; // 1 hour — matches longest list cache TTL

class CacheTagRegistry {

  /**
   * Register a cache key under one or more tags.
   * Called when a list/search result is cached.
   *
   * @param {string} cacheKey - the cache key to register
   * @param {string[]} tags - e.g. ['product:abc123', 'category:smartphones']
   */
  async register(cacheKey, tags) {
    if (!tags || tags.length === 0) return;

    try {
      const redis = getRedisClient();
      const pipeline = redis.multi();

      for (const tag of tags) {
        const tagKey = CacheKeys.tag(tag);
        pipeline.sAdd(tagKey, cacheKey);
        pipeline.expire(tagKey, TAG_TTL);
      }

      await pipeline.exec();
    } catch (err) {
      logger.warn('Cache tag registration failed', { cacheKey, error: err.message });
      // Non-critical: cache will still work, just invalidation may miss some keys
    }
  }

  /**
   * Get all cache keys registered under a tag.
   * Used during invalidation to know what to delete.
   */
  async getKeysForTag(tag) {
    try {
      const redis = getRedisClient();
      return redis.sMembers(CacheKeys.tag(tag));
    } catch {
      return [];
    }
  }

  /**
   * Remove a cache key from all tags (cleanup after invalidation).
   */
  async deregister(cacheKey, tags) {
    if (!tags || tags.length === 0) return;

    try {
      const redis = getRedisClient();
      const pipeline = redis.multi();
      for (const tag of tags) {
        pipeline.sRem(CacheKeys.tag(tag), cacheKey);
      }
      await pipeline.exec();
    } catch (err) {
      logger.warn('Cache tag deregistration failed', { error: err.message });
    }
  }

  /**
   * Invalidate ALL cache keys associated with a tag.
   * Returns the number of keys deleted.
   */
  async invalidateTag(tag) {
    try {
      const redis = getRedisClient();
      const tagKey = CacheKeys.tag(tag);
      const keys = await redis.sMembers(tagKey);

      if (keys.length === 0) return 0;

      // Delete all tagged cache keys + the tag set itself
      const pipeline = redis.multi();
      for (const key of keys) {
        pipeline.del(key);
      }
      pipeline.del(tagKey);
      await pipeline.exec();

      logger.debug('Cache tag invalidated', { tag, keysDeleted: keys.length });
      return keys.length;
    } catch (err) {
      logger.warn('Cache tag invalidation failed', { tag, error: err.message });
      return 0;
    }
  }

  /**
   * Invalidate multiple tags at once.
   */
  async invalidateTags(tags) {
    await Promise.all(tags.map(tag => this.invalidateTag(tag)));
  }
}

module.exports = new CacheTagRegistry();