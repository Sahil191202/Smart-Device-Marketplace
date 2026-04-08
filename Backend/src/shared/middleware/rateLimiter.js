// src/shared/middleware/rateLimiter.js

/**
 * Redis Sliding Window Rate Limiter.
 *
 * Why replace express-rate-limit's MemoryStore?
 * - MemoryStore is per-process: with 4 Node.js replicas, each has its own
 *   counter → effective limit becomes 4× the configured limit
 * - Redis store is shared across all instances → accurate limiting at scale
 *
 * Sliding Window Algorithm (vs Fixed Window):
 * - Fixed window: 100 req/min. 100 at 00:59, 100 at 01:00 → 200 in 2 seconds ✗
 * - Sliding window: counts requests in the last 60s from NOW → true rate limit ✓
 *
 * Implementation using Redis Sorted Set (ZADD):
 * - Key: ratelimit:{prefix}:{identifier}
 * - Members: requestId (uuid) with score = timestamp
 * - On each request:
 *   1. Remove entries older than window (ZREMRANGEBYSCORE)
 *   2. Count remaining (ZCARD)
 *   3. If count < limit: add new entry (ZADD), allow
 *   4. If count >= limit: reject with 429
 *   5. Set key TTL = window (auto-cleanup)
 */

const { getRedisClient } = require('../../config/redis');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../config/logger');

/**
 * Create a Redis sliding window rate limiter middleware.
 *
 * @param {Object} options
 * @param {number} options.windowMs - window size in milliseconds
 * @param {number} options.max - max requests per window
 * @param {string} options.prefix - key prefix (e.g. 'auth', 'api', 'global')
 * @param {string} [options.message] - error message
 * @param {Function} [options.keyGenerator] - custom key generator (default: req.ip)
 * @param {Function} [options.skip] - skip function (return true to bypass)
 */
const createRateLimiter = ({
  windowMs,
  max,
  prefix = 'global',
  message = 'Too many requests. Please try again later.',
  keyGenerator = (req) => req.ip,
  skip = null,
}) => {
  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req, res, next) => {
    // Skip health checks and whitelisted requests
    if (skip && skip(req)) return next();

    const identifier = keyGenerator(req);
    const key = `ratelimit:${prefix}:${identifier}`;

    try {
      const redis = getRedisClient();
      const now = Date.now();
      const windowStart = now - windowMs;

      // Atomic sliding window using Redis pipeline
      const pipeline = redis.multi();

      // 1. Remove expired entries (older than window)
      pipeline.zRemRangeByScore(key, 0, windowStart);

      // 2. Count current entries in window
      pipeline.zCard(key);

      // 3. Add current request with timestamp as score
      const requestId = uuidv4();
      pipeline.zAdd(key, { score: now, value: requestId });

      // 4. Set TTL so key auto-expires (cleanup)
      pipeline.expire(key, windowSeconds);

      const results = await pipeline.exec();
      const currentCount = results[1]; // zCard result (before adding current request)

      // Set rate limit headers (RFC 6585 standard)
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - currentCount - 1));
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));

      if (currentCount >= max) {
        logger.warn('Rate limit exceeded', { prefix, identifier, count: currentCount });

        // Remove the request we just added (we're rejecting it)
        await redis.zRem(key, requestId);

        res.setHeader('Retry-After', windowSeconds);
        return res.status(429).json({
          success: false,
          message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: windowSeconds,
        });
      }

      next();
    } catch (err) {
      // If Redis is down, fail open (don't block requests)
      logger.error('Rate limiter error — failing open', { error: err.message });
      next();
    }
  };
};

// ── Pre-configured rate limiters ──────────────────────────────────────────────

const globalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  prefix: 'global',
  skip: (req) => req.url === '/health',
});

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  prefix: 'auth',
  message: 'Too many auth attempts. Please try again in 15 minutes.',
});

const forgotPasswordLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  prefix: 'forgot-password',
  message: 'Too many reset requests. Please try again in 1 hour.',
});

const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  prefix: 'search',
  message: 'Too many search requests.',
});

const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  prefix: 'upload',
  message: 'Too many file uploads. Please try again in 1 hour.',
});

module.exports = {
  createRateLimiter,
  globalLimiter,
  authLimiter,
  forgotPasswordLimiter,
  searchLimiter,
  uploadLimiter,
};