// src/shared/middleware/authenticate.js
const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const asyncWrapper = require("../utils/asyncWrapper");
const env = require("../../config/env");
const { getRedisClient } = require("../../config/redis");


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