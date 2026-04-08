// src/shared/cache/cache.ttl.js

/**
 * TTL Strategy:
 *
 * Different data has different staleness tolerance:
 * - Product detail: 10 min (price/status can change)
 * - Product list/search: 5 min (new listings appear frequently)
 * - User profile: 1 hour (rarely changes)
 * - Price analysis: 1 hour (AI prediction cached separately)
 * - Categories/static: 24 hours
 * - Unread count: no cache (Redis counter IS the source of truth)
 *
 * Jitter: Add ±10% random variation to TTL.
 * Without jitter, all products cached at the same time expire together
 * → synchronized DB stampede. Jitter spreads expiry across time.
 */

const BASE_TTL = {
  PRODUCT_DETAIL: 10 * 60,          // 10 minutes
  PRODUCT_LIST: 5 * 60,             // 5 minutes
  PRODUCT_SEARCH: 3 * 60,           // 3 minutes (search results stale faster)
  USER_PROFILE: 60 * 60,            // 1 hour
  PRICE_ANALYSIS: 60 * 60,          // 1 hour
  CATEGORIES: 24 * 60 * 60,         // 24 hours
  SELLER_STATS: 15 * 60,            // 15 minutes
  WISHLIST_COUNT: 5 * 60,           // 5 minutes
  CACHE_LOCK: 10,                   // 10 seconds (mutex TTL)
  VIEW_FLUSH_INTERVAL: 5 * 60,      // 5 minutes (Bull job interval)
};

/**
 * Apply ±10% jitter to a TTL value.
 * Prevents synchronized cache expiry under high load.
 *
 * @param {number} baseTtl - base TTL in seconds
 * @param {number} jitterPct - jitter percentage (default 10%)
 */
const withJitter = (baseTtl, jitterPct = 0.10) => {
  const jitter = Math.floor(baseTtl * jitterPct * (Math.random() * 2 - 1));
  return Math.max(60, baseTtl + jitter); // floor at 60 seconds
};

// Export factory functions (always apply jitter at call time)
module.exports = {
  PRODUCT_DETAIL: () => withJitter(BASE_TTL.PRODUCT_DETAIL),
  PRODUCT_LIST: () => withJitter(BASE_TTL.PRODUCT_LIST),
  PRODUCT_SEARCH: () => withJitter(BASE_TTL.PRODUCT_SEARCH),
  USER_PROFILE: () => withJitter(BASE_TTL.USER_PROFILE),
  PRICE_ANALYSIS: () => withJitter(BASE_TTL.PRICE_ANALYSIS),
  CATEGORIES: () => withJitter(BASE_TTL.CATEGORIES),
  SELLER_STATS: () => withJitter(BASE_TTL.SELLER_STATS),
  WISHLIST_COUNT: () => withJitter(BASE_TTL.WISHLIST_COUNT),
  CACHE_LOCK: BASE_TTL.CACHE_LOCK,      // no jitter on mutex
  VIEW_FLUSH_INTERVAL: BASE_TTL.VIEW_FLUSH_INTERVAL,
  BASE: BASE_TTL,
};