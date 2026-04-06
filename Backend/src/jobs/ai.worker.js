// src/jobs/ai.worker.js
const { getQueue, QUEUE_NAMES } = require('./queue');
const { aiServiceClient, withRetry } = require('../config/httpClient');
const productRepository = require('../modules/products/product.repository');
const { getRedisClient } = require('../config/redis');
const logger = require('../config/logger');

const PREDICTION_CACHE_TTL = 60 * 60 * 24; // 24 hours

/**
 * Generate a cache key based on product features.
 * Identical specs → same prediction → cache hit (skip FastAPI call).
 */
const buildCacheKey = ({ category, brand, condition, specs }) => {
  const normalized = JSON.stringify({
    category,
    brand: brand.toLowerCase(),
    condition,
    specs: Object.keys(specs || {})
      .sort()
      .reduce((acc, k) => ({ ...acc, [k]: specs[k] }), {}),
  });
  // Simple hash using Buffer (no crypto overhead for cache keys)
  return `ai:prediction:${Buffer.from(normalized).toString('base64').slice(0, 32)}`;
};

/**
 * Process a single price prediction job.
 * Flow: check cache → call FastAPI → save to DB → update cache
 */
const processPredictionJob = async (job) => {
  const { productId, title, category, brand, condition, price, specs } = job.data;

  logger.debug('Processing AI prediction job', { jobId: job.id, productId });

  // 1. Check Redis cache first — same device specs seen recently?
  const redis = getRedisClient();
  const cacheKey = buildCacheKey({ category, brand, condition, specs });
  const cached = await redis.get(cacheKey);

  if (cached) {
    const prediction = JSON.parse(cached);
    logger.debug('AI prediction cache hit', { productId, cacheKey });

    // Recalculate deal score with THIS product's listed price
    // (even if category/condition match, listed price differs per product)
    const ratio = price / prediction.predicted_price;
    const dealScore = Math.round(Math.max(0, Math.min(100, (2 - ratio) * 50)) * 10) / 10;

    await productRepository.updatePredictedPrice(productId, {
      price: prediction.predicted_price,
      confidence: prediction.confidence,
      deal_score: dealScore,
    });

    return { productId, source: 'cache', prediction };
  }

  // 2. Call FastAPI prediction endpoint
  const predictionResult = await withRetry(async () => {
    const response = await aiServiceClient.post('/predict', {
      product_id: productId,
      title,
      category,
      brand,
      condition,
      listed_price: price,
      specs: specs || {},
    });
    return response.data;
  });

  // 3. Persist prediction to MongoDB product document
  await productRepository.updatePredictedPrice(productId, {
    price: predictionResult.predicted_price,
    confidence: predictionResult.confidence,
    deal_score: predictionResult.deal_score,
  });

  // 4. Cache the prediction features result (not deal_score — that's price-specific)
  const cachePayload = {
    predicted_price: predictionResult.predicted_price,
    confidence: predictionResult.confidence,
    price_range: predictionResult.price_range,
  };
  await redis.setEx(cacheKey, PREDICTION_CACHE_TTL, JSON.stringify(cachePayload));

  logger.info('AI prediction saved', {
    productId,
    predictedPrice: predictionResult.predicted_price,
    dealScore: predictionResult.deal_score,
    confidence: predictionResult.confidence,
  });

  return { productId, source: 'model', prediction: predictionResult };
};

/**
 * Start the AI prediction Bull worker.
 * Concurrency: 3 — balance between throughput and FastAPI load.
 * Workers run as part of the main Node.js process for simplicity.
 * In production with high volume: extract to separate worker.js process.
 */
const startAIWorker = () => {
  const aiQueue = getQueue(QUEUE_NAMES.AI_QUEUE);

  aiQueue.process('ai:predictPrice', 3, async (job) => {
    return processPredictionJob(job);
  });

  // Handle completed jobs
  aiQueue.on('completed', (job, result) => {
    logger.debug('AI job completed', {
      jobId: job.id,
      productId: result.productId,
      source: result.source,
    });
  });

  logger.info('AI prediction worker started', { concurrency: 3 });
};

module.exports = { startAIWorker };