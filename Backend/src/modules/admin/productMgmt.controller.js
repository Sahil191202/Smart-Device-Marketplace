// src/modules/admin/productMgmt.controller.js
const Product = require('../products/product.model');
const productRepository = require('../products/product.repository');
const cacheManager = require('../../shared/cache/cache.manager');
const { deleteAsset } = require('../../config/cloudinary');
const apiResponse = require('../../shared/utils/apiResponse');
const asyncWrapper = require('../../shared/utils/asyncWrapper');
const AppError = require('../../shared/utils/AppError');
const logger = require('../../config/logger');

// GET /admin/products — all products including removed
const listProducts = asyncWrapper(async (req, res) => {
  const { cursor, limit = 20, status, category, sellerId } = req.query;
  const mongoose = require('mongoose');

  const query = {};
  if (status) query.status = status;
  if (category) query.category = category;
  if (sellerId) query.sellerId = new mongoose.Types.ObjectId(sellerId);

  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
      query._id = { $lt: new mongoose.Types.ObjectId(decoded.id) };
    } catch { /* ignore */ }
  }

  const products = await Product.find(query)
    .setOptions({ includeRemoved: true })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) + 1)
    .populate('sellerId', 'name email avatar')
    .lean();

  const hasNext = products.length > parseInt(limit);
  const results = hasNext ? products.slice(0, parseInt(limit)) : products;

  let nextCursor = null;
  if (hasNext && results.length > 0) {
    nextCursor = Buffer.from(
      JSON.stringify({ id: results[results.length - 1]._id.toString() })
    ).toString('base64');
  }

  apiResponse.success(res, {
    message: 'Products fetched',
    data: { products: results },
    meta: { nextCursor, hasNext },
  });
});

// PATCH /admin/products/:id/remove — force remove any product
const forceRemoveProduct = asyncWrapper(async (req, res) => {
  const { reason } = req.body;
  if (!reason) throw AppError.badRequest('Removal reason is required');

  const product = await Product.findById(req.params.id)
    .setOptions({ includeRemoved: true });
  if (!product) throw AppError.notFound('Product');

  req.audit.before = { status: product.status };

  await Product.updateOne(
    { _id: product._id },
    { $set: { status: 'removed' } }
  );

  await cacheManager.invalidateProduct(
    product._id.toString(),
    product.slug
  );

  req.audit.after = { status: 'removed', reason };

  logger.info('Product force removed by admin', {
    productId: product._id,
    adminId: req.user.id,
    reason,
  });

  apiResponse.success(res, {
    message: 'Product removed',
    data: { productId: product._id },
  });
});

// PATCH /admin/products/:id/restore — restore a removed product
const restoreProduct = asyncWrapper(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .setOptions({ includeRemoved: true });
  if (!product) throw AppError.notFound('Product');
  if (product.status !== 'removed') {
    throw AppError.conflict('Only removed products can be restored');
  }

  req.audit.before = { status: 'removed' };

  await Product.updateOne(
    { _id: product._id },
    { $set: { status: 'active' } }
  );

  await cacheManager.invalidateProduct(product._id.toString(), product.slug);

  req.audit.after = { status: 'active' };

  apiResponse.success(res, {
    message: 'Product restored',
    data: { productId: product._id },
  });
});

module.exports = { listProducts, forceRemoveProduct, restoreProduct };