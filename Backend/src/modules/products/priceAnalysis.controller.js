// src/modules/products/priceAnalysis.controller.js
const productRepository = require('./product.repository');
const { aiServiceClient, withRetry } = require('../../config/httpClient');
const { addAIJob } = require('../../jobs/queue');
const { getRedisClient } = require('../../config/redis');
const apiResponse = require('../../shared/utils/apiResponse');
const asyncWrapper = require('../../shared/utils/asyncWrapper');
const AppError = require('../../shared/utils/AppError');
const logger = require('../../config/logger');

const ANALYSIS_CACHE_TTL = 60 * 60; // 1 hour cache for price analysis endpoint

/**
 * GET /api/v1/products/:id/price-analysis
 *
 * Returns:
 * - listed_price: what the seller is asking
 * - predicted_price: AI's fair market estimate
 * - price_range: confidence interval
 * - deal_score: 0-100 (100 = amazing deal, 0 = overpriced)
 * - verdict: human-readable assessment
 * - confidence: model confidence 0-1
 * - last_updated: when prediction was generated
 */
const getPriceAnalysis = asyncWrapper(async (req, res) => {
  const { id } = req.params;

  // 1. Check endpoint-level Redis cache
  const redis = getRedisClient();
  const cacheKey = `price:analysis:${id}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return apiResponse.success(res, {
      message: 'Price analysis fetched',
      data: JSON.parse(cached),
    });
  }

  // 2. Fetch product
  const product = await productRepository.findById(id);
  if (!product) throw AppError.notFound('Product');

  let analysis;

  // 3a. If we already have a stored prediction — use it
  if (product.predictedPrice?.value && product.predictedPrice?.generatedAt) {
    const ageMs = Date.now() - new Date(product.predictedPrice.generatedAt).getTime();
    const isStale = ageMs > 24 * 60 * 60 * 1000; // 24 hours

    if (!isStale) {
      const ratio = product.price / product.predictedPrice.value;
      const dealScore = Math.round(Math.max(0, Math.min(100, (2 - ratio) * 50)) * 10) / 10;

      analysis = buildAnalysisResponse(product, {
        predicted_price: product.predictedPrice.value,
        confidence: product.predictedPrice.confidence,
        deal_score: dealScore,
        price_range: {
          min: product.predictedPrice.value * 0.85,
          max: product.predictedPrice.value * 1.15,
        },
      });
    }
  }

  // 3b. No stored prediction (or stale) — call FastAPI synchronously for this request
  // Also re-queue for async update so future requests are fast
  if (!analysis) {
    try {
      const result = await withRetry(async () => {
        const response = await aiServiceClient.post('/predict', {
          product_id: id,
          title: product.title,
          category: product.category,
          brand: product.brand,
          condition: product.condition,
          listed_price: product.price,
          specs: product.specs || {},
        });
        return response.data;
      });

      // Persist fresh prediction
      await productRepository.updatePredictedPrice(id, {
        price: result.predicted_price,
        confidence: result.confidence,
        deal_score: result.deal_score,
      });

      analysis = buildAnalysisResponse(product, result);
    } catch (err) {
      // AI service unavailable — return partial response without prediction
      logger.warn('AI service unavailable for price analysis', {
        productId: id,
        error: err.message,
      });

      return apiResponse.success(res, {
        message: 'Price analysis partial — AI service temporarily unavailable',
        data: {
          product_id: id,
          listed_price: product.price,
          predicted_price: null,
          ai_available: false,
        },
      });
    }
  }

  // 4. Cache the analysis response
  await redis.setEx(cacheKey, ANALYSIS_CACHE_TTL, JSON.stringify(analysis));

  // 5. Queue background refresh for next time
  await addAIJob('ai:predictPrice', {
    productId: id,
    title: product.title,
    category: product.category,
    brand: product.brand,
    condition: product.condition,
    price: product.price,
    specs: product.specs || {},
  }).catch(() => {}); // non-critical

  return apiResponse.success(res, {
    message: 'Price analysis fetched',
    data: analysis,
  });
});

/**
 * POST /api/v1/products/:id/price-analysis/refresh
 * Force re-run prediction (admin/seller only)
 */
const refreshPrediction = asyncWrapper(async (req, res) => {
  const { id } = req.params;

  const product = await productRepository.findById(id);
  if (!product) throw AppError.notFound('Product');

  // Clear cache
  const redis = getRedisClient();
  await redis.del(`price:analysis:${id}`);

  // Queue fresh prediction
  await addAIJob('ai:predictPrice', {
    productId: id,
    title: product.title,
    category: product.category,
    brand: product.brand,
    condition: product.condition,
    price: product.price,
    specs: product.specs || {},
  });

  apiResponse.success(res, {
    message: 'Price prediction refresh queued',
    data: null,
  });
});

// ── Helper ────────────────────────────────────────────────────────────────────

const buildAnalysisResponse = (product, prediction) => {
  const priceDelta = product.price - prediction.predicted_price;
  const priceDeltaPct = ((priceDelta / prediction.predicted_price) * 100).toFixed(1);

  let verdict;
  if (prediction.deal_score >= 75) verdict = 'Great Deal';
  else if (prediction.deal_score >= 55) verdict = 'Fair Price';
  else if (prediction.deal_score >= 35) verdict = 'Slightly Overpriced';
  else verdict = 'Overpriced';

  return {
    product_id: product._id.toString(),
    listed_price: product.price,
    predicted_price: prediction.predicted_price,
    price_delta: Math.round(priceDelta),
    price_delta_pct: parseFloat(priceDeltaPct),
    price_range: prediction.price_range,
    deal_score: prediction.deal_score,
    verdict,
    confidence: prediction.confidence,
    ai_available: true,
    last_updated: new Date().toISOString(),
  };
};

module.exports = { getPriceAnalysis, refreshPrediction };