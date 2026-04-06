// src/shared/utils/apiResponse.js

/**
 * Standardized API response factory.
 * All responses follow the same envelope structure.
 */
const apiResponse = {
  success(res, { message = 'Success', data = null, meta = null, statusCode = 200 }) {
    const body = { success: true, message, data };
    if (meta) body.meta = meta;
    return res.status(statusCode).json(body);
  },

  created(res, { message = 'Created successfully', data = null }) {
    return this.success(res, { message, data, statusCode: 201 });
  },

  noContent(res) {
    return res.status(204).send();
  },

  error(res, { message = 'Error', errors = [], code = null, statusCode = 500, requestId = null }) {
    const body = { success: false, message };
    if (errors.length) body.errors = errors;
    if (code) body.code = code;
    if (requestId) body.requestId = requestId;
    return res.status(statusCode).json(body);
  },
};

module.exports = apiResponse;