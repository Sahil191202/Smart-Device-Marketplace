// src/jobs/priceDropScheduler.js
const { getQueue } = require('./queue');
const wishlistRepository = require('../modules/wishlist/wishlist.repository');
const wishlistService = require('../modules/wishlist/wishlist.service');
const Product = require('../modules/products/product.model');
const logger = require('../config/logger');

const SCHEDULER_QUEUE = 'price-drop-scheduler';
const SCHEDULER_JOB_NAME = 'scheduler:checkPriceDrops';
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // every 1 hour

/**
 * Price drop detection flow:
 * 1. Get all distinct productIds that appear in any wishlist
 * 2. Fetch current prices for those products in one $in query
 * 3. For each product, find wishlist entries where savedPrice > currentPrice by threshold
 * 4. Send notifications + update savedPrice snapshots
 *
 * This runs as a repeatable Bull job — survives restarts, won't double-run
 * if the previous run is still in progress (Bull handles concurrency).
 */
const runPriceDropCheck = async () => {
  logger.info('Price drop scheduler: starting check');

  // 1. Get all wishlisted product IDs (distinct — no duplicates)
  const productIds = await wishlistRepository.getDistinctWishlistedProductIds();

  if (productIds.length === 0) {
    logger.info('Price drop scheduler: no wishlisted products, skipping');
    return;
  }

  // 2. Fetch current prices for all wishlisted products in ONE query
  const products = await Product.find({
    _id: { $in: productIds },
    status: 'active',
  })
    .select('_id title slug price')
    .lean();

  logger.info('Price drop scheduler: checking products', {
    wishlisted: productIds.length,
    active: products.length,
  });

  // 3. Check each active product for price drops
  let alertsSent = 0;
  await Promise.allSettled(
    products.map(async (product) => {
      try {
        await wishlistService.processPriceDrop(
          product._id.toString(),
          product.price,
          product.title,
          product.slug
        );
        alertsSent++;
      } catch (err) {
        logger.error('Price drop check failed for product', {
          productId: product._id,
          error: err.message,
        });
      }
    })
  );

  logger.info('Price drop scheduler: check complete', {
    productsChecked: products.length,
    alertsQueued: alertsSent,
  });
};

/**
 * Register the repeatable job with Bull.
 * Bull stores the repeat schedule in Redis — survives process restarts.
 * Only one instance runs at a time even with multiple Node.js workers.
 */
const startPriceDropScheduler = async () => {
  const schedulerQueue = getQueue(SCHEDULER_QUEUE);

  // Process the job when it fires
  schedulerQueue.process(SCHEDULER_JOB_NAME, 1, async (job) => {
    await runPriceDropCheck();
  });

  // Register the repeatable schedule
  // removeOnComplete: keeps only last 5 runs for monitoring
  await schedulerQueue.add(
    SCHEDULER_JOB_NAME,
    {},
    {
      repeat: { every: CHECK_INTERVAL_MS },
      removeOnComplete: 5,
      removeOnFail: 10,
      jobId: 'price-drop-singleton', // prevent duplicate schedules on restart
    }
  );

  logger.info('Price drop scheduler registered', {
    intervalMs: CHECK_INTERVAL_MS,
    intervalHuman: '1 hour',
  });
};

module.exports = { startPriceDropScheduler, runPriceDropCheck };