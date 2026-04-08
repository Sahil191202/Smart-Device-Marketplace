// src/jobs/cacheWarmer.js
const { getQueue } = require('./queue');
const cacheManager = require('../shared/cache/cache.manager');
const productService = require('../modules/products/product.service');
const logger = require('../config/logger');
const TTL = require('../shared/cache/cache.ttl');

const WARMER_QUEUE = 'cache-warmer';

/**
 * Start cache maintenance jobs:
 * 1. View count flusher: Redis → MongoDB every 5 minutes
 * 2. Cache warmer: refresh top products every 30 minutes
 */
const startCacheJobs = async () => {
  const queue = getQueue(WARMER_QUEUE);

  // ── Job processors ────────────────────────────────────────────────────────

  queue.process('cache:flushViews', 1, async (job) => {
    logger.debug('Running view count flush');
    await productService.flushViewCounts();
  });

  queue.process('cache:warmProducts', 1, async (job) => {
    logger.debug('Running cache warm');
    await cacheManager.warmProductCache();
  });

  // ── Register repeatable jobs ──────────────────────────────────────────────

  // Flush view counts every 5 minutes
  await queue.add(
    'cache:flushViews',
    {},
    {
      repeat: { every: TTL.BASE.VIEW_FLUSH_INTERVAL * 1000 },
      removeOnComplete: 3,
      removeOnFail: 5,
      jobId: 'view-flush-singleton',
    }
  );

  // Warm cache every 30 minutes
  await queue.add(
    'cache:warmProducts',
    {},
    {
      repeat: { every: 30 * 60 * 1000 },
      removeOnComplete: 3,
      removeOnFail: 5,
      jobId: 'cache-warm-singleton',
    }
  );

  logger.info('Cache jobs registered', {
    viewFlushInterval: '5 minutes',
    cacheWarmInterval: '30 minutes',
  });
};

module.exports = { startCacheJobs };