// src/config/env.js
const Joi = require("joi");

const envSchema = Joi.object({
  // App
  NODE_ENV: Joi.string().valid("development", "production", "test").required(),
  PORT: Joi.number().default(5000),
  APP_NAME: Joi.string().default("SmartMarketplace"),

  // MongoDB
  MONGODB_URI: Joi.string().required(),
  MONGODB_DB_NAME: Joi.string().required(),

  // Redis
  REDIS_HOST: Joi.string().default("localhost"),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow("").default(""),

  // JWT (RS256 — we use base64-encoded PEM keys in env for Docker compatibility)
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default("7d"),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),

  // AWS S3
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),
  AWS_REGION: Joi.string().default("us-east-1"),
  AWS_S3_BUCKET: Joi.string().required(),

  // Email (SMTP)
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().required(),
  SMTP_PASS: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().required(),

  // AI Service
  AI_SERVICE_URL: Joi.string().uri().required(),
  AI_SERVICE_TIMEOUT_MS: Joi.number().default(5000),
  AI_INTERNAL_KEY: Joi.string().allow("").default(""),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000), // 15 min
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),

  // CORS
  ALLOWED_ORIGINS: Joi.string().required(), // comma-separated

  // Sentry
  SENTRY_DSN: Joi.string().uri().allow("").default(""),
  
  // Razorpay
  RAZORPAY_KEY_ID: Joi.string().required(),
  RAZORPAY_KEY_SECRET: Joi.string().required(),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().required(),
  
}).unknown(true); // ← reject unknown env vars to catch typos

const { error, value: env } = envSchema.validate(process.env, {
  abortEarly: false, // show ALL errors at once
  convert: true, // coerce strings to numbers/booleans
});

if (error) {
  const missing = error.details.map((d) => `  ❌ ${d.message}`).join("\n");
  throw new Error(
    `\n\n[ENV VALIDATION FAILED]\n${missing}\n\nCheck your .env file.\n`,
  );
}

module.exports = env;
