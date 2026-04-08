// src/shared/cache/cache.keys.js

/**
 * Centralized cache key registry.
 *
 * Rules:
 * 1. All keys are functions (not strings) — forces explicit parameterization
 * 2. Hierarchical structure: namespace:entity:id:variant
 * 3. List keys include all filter params (different filters = different cache)
 * 4. Never hardcode a key string outside this file
 *
 * Key structure:
 *   sm:products:detail:{id}
 *   sm:products:slug:{slug}
 *   sm:products:list:{hash}      ← hash of query params
 *   sm:products:search:{hash}
 *   sm:users:profile:{id}
 *   sm:price:analysis:{productId}
 *   sm:categories:all
 *   sm:lock:{operation}          ← mutex locks
 *   sm:tags:{tag}                ← tag → [keys] registry
 */

const crypto = require('crypto');

const PREFIX = 'sm';

// Deterministic hash of query params for list/search cache keys
const hashParams = (params) => {
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, k) => {
      if (params[k] !== undefined && params[k] !== '' && params[k] !== null) {
        acc[k] = params[k];
      }
      return acc;
    }, {});
  return crypto
    .createHash('md5')
    .update(JSON.stringify(sorted))
    .digest('hex')
    .slice(0, 16); // 16 chars is enough for uniqueness
};

const CacheKeys = {
  // ── Products ──────────────────────────────────────────────────────────────
  productDetail: (id) => `${PREFIX}:products:detail:${id}`,
  productBySlug: (slug) => `${PREFIX}:products:slug:${slug}`,
  productList: (params) => `${PREFIX}:products:list:${hashParams(params)}`,
  productSearch: (params) => `${PREFIX}:products:search:${hashParams(params)}`,
  sellerProducts: (sellerId, params) => `${PREFIX}:products:seller:${sellerId}:${hashParams(params)}`,

  // ── Users ─────────────────────────────────────────────────────────────────
  userProfile: (userId) => `${PREFIX}:users:profile:${userId}`,

  // ── Price analysis ────────────────────────────────────────────────────────
  priceAnalysis: (productId) => `${PREFIX}:price:analysis:${productId}`,

  // ── Static / rarely changing ──────────────────────────────────────────────
  categoriesAll: () => `${PREFIX}:categories:all`,
  sellerStats: (sellerId) => `${PREFIX}:seller:stats:${sellerId}`,

  // ── Locks (mutex) ─────────────────────────────────────────────────────────
  lock: (operation) => `${PREFIX}:lock:${operation}`,

  // ── Tag registry (maps tag → set of cache keys) ───────────────────────────
  tag: (tagName) => `${PREFIX}:tags:${tagName}`,

  // ── View counters (managed by view tracking, not cache manager) ───────────
  viewCount: (productId) => `view:count:${productId}`,
  viewDedup: (productId, userId) => `view:dedup:${productId}:${userId}`,
};

module.exports = { CacheKeys, hashParams };