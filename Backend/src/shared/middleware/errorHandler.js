// src/shared/middleware/errorHandler.js
const logger = require('../../config/logger');
const apiResponse = require('../utils/apiResponse');
const AppError = require('../utils/AppError');
const env = require('../../config/env');

/**
 * Global error handler — catches ALL errors forwarded via next(err).
 * 
 * Error categories:
 * 1. AppError (operational) → safe to expose to client
 * 2. Mongoose errors → transform + expose safe message
 * 3. JWT errors → transform to 401
 * 4. Unknown errors → log full details, send generic 500
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // ── Mongoose: Duplicate Key ─────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = AppError.conflict(`${field} already exists`);
  }

  // ── Mongoose: Validation Error ──────────────────────────────────────
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
    }));
    error = new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors);
  }

  // ── Mongoose: Cast Error (invalid ObjectId) ─────────────────────────
  if (err.name === 'CastError') {
    error = AppError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }

  // ── JWT: Expired ────────────────────────────────────────────────────
  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401, 'TOKEN_EXPIRED');
  }

  // ── JWT: Invalid ────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401, 'TOKEN_INVALID');
  }

  // ── Determine if operational (safe to expose) ───────────────────────
  const isOperational = error.isOperational === true;
  const statusCode = error.statusCode || 500;

  // ── Log everything ──────────────────────────────────────────────────
  const logPayload = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    statusCode,
    errorCode: error.errorCode,
    message: error.message,
    ...(statusCode >= 500 && { stack: error.stack }), // stack only for 5xx
    userId: req.user?.id,
    ip: req.ip,
  };

  if (statusCode >= 500) {
    logger.error('Unhandled error', logPayload);
  } else {
    logger.warn('Client error', logPayload);
  }

  // ── Send response ───────────────────────────────────────────────────
  apiResponse.error(res, {
    message: isOperational ? error.message : 'Something went wrong',
    errors: error.errors || [],
    code: error.errorCode,
    statusCode,
    requestId: req.requestId,
    // Only expose stack in development
    ...(env.NODE_ENV === 'development' && !isOperational && { debug: error.stack }),
  });
};

module.exports = errorHandler;