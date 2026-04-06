// src/shared/utils/AppError.js
class AppError extends Error {
  constructor(message, statusCode, errorCode = null, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;  // Machine-readable code e.g. "PRODUCT_NOT_FOUND"
    this.errors = errors;        // Field-level errors for validation
    this.isOperational = true;   // Distinguish from programmer bugs

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, errors = []) {
    return new AppError(message, 400, 'BAD_REQUEST', errors);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(resource = 'Resource') {
    return new AppError(`${resource} not found`, 404, 'NOT_FOUND');
  }

  static conflict(message) {
    return new AppError(message, 409, 'CONFLICT');
  }

  static tooManyRequests(message = 'Too many requests') {
    return new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
  }

  static internal(message = 'Internal server error') {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }
}

module.exports = AppError;