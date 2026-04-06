// src/shared/middleware/notFound.js
const AppError = require('../utils/AppError');

const notFound = (req, res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl}`));
};

module.exports = notFound;