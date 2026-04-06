// src/shared/middleware/validate.js
const AppError = require('../utils/AppError');

/**
 * Validates req.body against a Joi schema.
 * Strips unknown fields (security — prevents mass assignment).
 * 
 * Usage:
 *   router.post('/register', validate(registerDto), controller)
 */
const validate = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,   // collect ALL errors, not just first
    stripUnknown: true,  // remove fields not in schema (mass assignment protection)
    convert: true,
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message.replace(/['"]/g, ''), // remove Joi's quotes
    }));
    return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors));
  }

  req[source] = value; // replace with sanitized + converted value
  next();
};

module.exports = validate;