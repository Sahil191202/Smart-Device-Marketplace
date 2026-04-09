// src/shared/middleware/authenticate.js
const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const asyncWrapper = require("../utils/asyncWrapper");
const env = require("../../config/env");
const { getRedisClient } = require("../../config/redis");

/**
 * Verifies JWT access token from Authorization: Bearer <token> header.
 * Attaches decoded payload to req.user.
 *
 * Security checks (in order):
 * 1. Token signature + expiry (JWT verify)
 * 2. Token blacklist (Redis) — for revoked tokens (password change, logout)
 * 3. Account ban (Redis) — set by banUser controller, TTL = 15min
 *
 * Why Redis for ban check instead of MongoDB?
 * - authenticate() runs on EVERY authenticated request
 * - MongoDB query per request = massive unnecessary load at scale
 * - Redis GET is O(1) ~0.1ms vs MongoDB findById ~5-50ms
 * - Ban key is set with 15min TTL (matches access token max lifetime)
 *   so after token expires naturally, the ban key is irrelevant anyway
 * - For permanent bans: isBanned=true in MongoDB ensures ban persists
 *   across new login attempts (auth service checks isBanned before issuing tokens)
 */
const authenticate = asyncWrapper(async (req, res, next) => {
  // 1. Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw AppError.unauthorized("No access token provided");
  }

  const token = authHeader.slice(7);

  // 2. Verify JWT signature + expiry
  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: "smart-marketplace",
      audience: "smart-marketplace-client",
    });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new AppError("Access token expired", 401, "TOKEN_EXPIRED");
    }
    throw new AppError("Invalid access token", 401, "TOKEN_INVALID");
  }

  // 3. Batch both Redis checks in one pipeline (single round-trip)
  //    Instead of two sequential redis.get() calls (~0.2ms each),
  //    pipeline executes both atomically in one TCP packet (~0.1ms total)
  const redis = getRedisClient();
  const pipeline = redis.multi();
  pipeline.get(`blacklist:token:${decoded.jti || token.slice(-16)}`);
  pipeline.get(`banned:user:${decoded.sub}`);
  const [blacklisted, isBanned] = await pipeline.exec();

  // 3a. Token blacklist check (revoked on password change / force logout)
  if (blacklisted) {
    throw new AppError("Token has been revoked", 401, "TOKEN_REVOKED");
  }

  // 3b. Account ban check (set by admin banUser action — Redis key, not DB query)
  if (isBanned) {
    throw new AppError(
      "Your account has been suspended",
      403,
      "ACCOUNT_BANNED"
    );
  }

  // 4. Attach decoded payload to request
  //    Controllers/services access user via req.user.id, req.user.role etc.
  //    Full profile loaded on demand via userService.getProfile() (cached)
  req.user = {
    id: decoded.sub,
    email: decoded.email,
    role: decoded.role,
    tokenIat: decoded.iat,
  };

  next();
});

/**
 * Optional authentication middleware.
 * Does NOT throw if token is missing or invalid — silently skips.
 *
 * Used for endpoints accessible by both guests and authenticated users:
 *   GET /products     → guests browse, auth users get isWishlisted flag
 *   GET /products/:id → guests see price, auth users see deal score
 *
 * Note: intentionally does NOT check ban status here.
 * Banned users can still browse public content as guests.
 * They are blocked from any action requiring full authenticate().
 */
const optionalAuthenticate = asyncWrapper(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return next();

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: "smart-marketplace",
      audience: "smart-marketplace-client",
    });

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };
  } catch {
    // Silently ignore — expired/invalid token = treat as guest
  }

  next();
});

module.exports = { authenticate, optionalAuthenticate };