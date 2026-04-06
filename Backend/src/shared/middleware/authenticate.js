// src/shared/middleware/authenticate.js
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const asyncWrapper = require('../utils/asyncWrapper');
const env = require('../../config/env');
const { getRedisClient } = require('../../config/redis');

/**
 * Verifies JWT access token from Authorization: Bearer <token> header.
 * Attaches decoded payload to req.user.
 * 
 * Also checks a Redis token blacklist — tokens can be invalidated
 * before their natural expiry (e.g., password change, security event).
 */
const authenticate = asyncWrapper(async (req, res, next) => {
  // 1. Extract token from header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw AppError.unauthorized('No access token provided');
  }

  const token = authHeader.slice(7);

  // 2. Verify signature + expiry
  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'smart-marketplace',
      audience: 'smart-marketplace-client',
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Access token expired', 401, 'TOKEN_EXPIRED');
    }
    throw new AppError('Invalid access token', 401, 'TOKEN_INVALID');
  }

  // 3. Check token blacklist in Redis
  // (tokens are blacklisted on password change, account ban, etc.)
  const redis = getRedisClient();
  const blacklisted = await redis.get(`blacklist:token:${decoded.jti || token.slice(-16)}`);
  if (blacklisted) {
    throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');
  }

  // 4. Attach user payload to request
  req.user = {
    id: decoded.sub,
    email: decoded.email,
    role: decoded.role,
    tokenIat: decoded.iat,
  };

  next();
});

/**
 * Optional auth — doesn't throw if no token, just doesn't set req.user.
 * Used for endpoints that work for both guests and authenticated users.
 * e.g., GET /products (guests see prices, users see wishlist status)
 */
const optionalAuthenticate = asyncWrapper(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'smart-marketplace',
      audience: 'smart-marketplace-client',
    });
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };
  } catch {
    // Silently ignore invalid/expired tokens in optional mode
  }

  next();
});

module.exports = { authenticate, optionalAuthenticate };