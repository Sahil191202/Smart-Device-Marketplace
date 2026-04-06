// src/shared/middleware/requestId.js
const { v4: uuidv4 } = require('uuid');

/**
 * Attaches a unique requestId to every request.
 * Propagated in response headers + error envelopes for tracing.
 */
const requestId = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || `req_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

module.exports = requestId;