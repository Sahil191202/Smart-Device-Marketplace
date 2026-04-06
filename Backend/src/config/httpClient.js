// src/config/httpClient.js
const axios = require('axios');
const logger = require('./logger');
const env = require('./env');

/**
 * Axios instance for internal service-to-service calls.
 * Configured with:
 * - Timeout: prevents Node event loop from hanging on slow AI responses
 * - Retry: handles FastAPI cold starts + transient errors (3 attempts)
 * - Internal key header: shared secret for service auth
 */
const aiServiceClient = axios.create({
  baseURL: env.AI_SERVICE_URL,
  timeout: env.AI_SERVICE_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-Key': process.env.AI_INTERNAL_KEY || '',
  },
});

// ── Response interceptor: log all AI service calls ────────────────────────────
aiServiceClient.interceptors.response.use(
  (response) => {
    logger.debug('AI service response', {
      url: response.config.url,
      status: response.status,
      processingMs: response.headers['x-process-time-ms'],
    });
    return response;
  },
  (error) => {
    logger.error('AI service error', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
    });
    return Promise.reject(error);
  }
);

/**
 * Retry wrapper with exponential backoff.
 * Used for prediction requests — transient failures shouldn't lose jobs.
 *
 * @param {Function} fn - async function to retry
 * @param {number} maxRetries
 * @param {number} baseDelayMs
 */
const withRetry = async (fn, maxRetries = 3, baseDelayMs = 500) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Don't retry on 4xx (client errors — bad request won't succeed on retry)
      const status = err.response?.status;
      if (status && status >= 400 && status < 500) throw err;

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1); // 500ms, 1s, 2s
        logger.warn(`AI service retry ${attempt}/${maxRetries} in ${delay}ms`, {
          error: err.message,
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
};

module.exports = { aiServiceClient, withRetry };