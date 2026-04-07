// src/app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const xssClean = require("xss-clean");
const hpp = require("hpp");
const rateLimit = require("express-rate-limit");

const env = require("./config/env");
const logger = require("./config/logger");
const { isDBConnected } = require("./config/db");
const { getRedisClient } = require("./config/redis");

const requestId = require("./shared/middleware/requestId");
const notFound = require("./shared/middleware/notFound");
const errorHandler = require("./shared/middleware/errorHandler");
const apiResponse = require("./shared/utils/apiResponse");

const createApp = () => {
  const app = express();

  // ── Trust proxy (needed when behind Nginx) ──────────────────────────
  // Required for accurate req.ip and rate limiting by real client IP
  app.set("trust proxy", 1);

  // ── Security headers (Helmet) ───────────────────────────────────────
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false, // needed for Cloudinary embeds
      contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
    }),
  );

  // ── CORS ────────────────────────────────────────────────────────────
  const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, curl)
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        callback(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true, // required for httpOnly cookie auth
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
      exposedHeaders: ["X-Request-ID"], // let frontend read request ID
    }),
  );

  // ── Body parsing ─────────────────────────────────────────────────────
  app.use(express.json({ limit: "10kb" })); // prevent large payload attacks
  app.use(express.urlencoded({ extended: true, limit: "10kb" }));
  app.use(cookieParser());

  // ── Security middleware ──────────────────────────────────────────────
  app.use(mongoSanitize()); // strip $ and . from request body/params/query
  app.use(xssClean()); // sanitize HTML tags in input
  app.use(
    hpp({
      // prevent HTTP parameter pollution
      whitelist: ["sort", "fields", "category", "brand"], // allow arrays for these
    }),
  );

  // ── Compression ──────────────────────────────────────────────────────
  app.use(
    compression({
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        return compression.filter(req, res);
      },
      level: 6, // balance between CPU and compression ratio
    }),
  );

  // ── Request ID (before logging so ID appears in logs) ───────────────
  app.use(requestId);

  // ── HTTP Request logging ─────────────────────────────────────────────
  if (env.NODE_ENV !== "test") {
    const morganFormat =
      env.NODE_ENV === "production"
        ? ":remote-addr :method :url :status :res[content-length] - :response-time ms"
        : "dev";

    app.use(
      morgan(morganFormat, {
        stream: { write: (message) => logger.http(message.trim()) },
        skip: (req) => req.url === "/health", // don't log health checks
      }),
    );
  }

  // ── Global rate limiter ──────────────────────────────────────────────
  // Per-route limiters (e.g., stricter on /auth) applied in route files
  const globalLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true, // Return X-RateLimit-* headers
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests",
      code: "RATE_LIMIT_EXCEEDED",
    },
    skip: (req) => req.url === "/health",
  });
  app.use("/api", globalLimiter);

  // ── Health check (before auth, always accessible) ────────────────────
  app.get("/health", async (req, res) => {
    const dbStatus = isDBConnected() ? "connected" : "disconnected";
    let redisStatus = "disconnected";

    try {
      const redis = getRedisClient();
      await redis.ping();
      redisStatus = "connected";
    } catch {
      redisStatus = "error";
    }

    const isHealthy = dbStatus === "connected" && redisStatus === "connected";

    return apiResponse.success(res, {
      statusCode: isHealthy ? 200 : 503,
      message: isHealthy ? "All systems operational" : "Degraded",
      data: {
        status: isHealthy ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        services: {
          database: dbStatus,
          cache: redisStatus,
        },
        version: process.env.npm_package_version || "1.0.0",
      },
    });
  });

  // ── API Routes (modules registered here as they're built) ───────────
  app.use("/api/v1/auth", require("./modules/auth/auth.routes"));
  app.use("/api/v1/users", require("./modules/users/users.routes"));
  app.use("/api/v1/products", require("./modules/products/products.routes"));
  app.use("/api/v1/wishlist", require("./modules/wishlist/wishlist.routes"));
  app.use(
    "/api/v1/notifications",
    require("./modules/notifications/notification.routes"),
  );

  // ── 404 handler ──────────────────────────────────────────────────────
  app.use(notFound);

  // ── Global error handler (MUST be last) ──────────────────────────────
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
