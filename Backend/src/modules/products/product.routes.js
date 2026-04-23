// src/modules/products/product.routes.js
const router = require('express').Router();
const controller = require('./product.controller');
const { getPriceAnalysis, refreshPrediction } = require('./priceAnalysis.controller');
const { authenticate, optionalAuthenticate } = require('../../shared/middleware/authenticate');
const { authorize } = require('../../shared/middleware/authorize');
const validate = require('../../shared/middleware/validate');
const { uploadProductImages } = require('../../shared/middleware/upload');
const { createProductDto, updateProductDto, listProductsDto } = require('./product.dto');

// ── Public routes (guests can browse) ────────────────────────────────────────

// GET /api/v1/products?cursor=&limit=&category=&sort=&q=
router.get(
  '/',
  validate(listProductsDto, 'query'),
  optionalAuthenticate,   // attaches req.user if token present (for wishlist status later)
  controller.list
);

// GET /api/v1/products/slug/:slug  — SEO-friendly URL
router.get('/slug/:slug', optionalAuthenticate, controller.getBySlug);

// GET /api/v1/products/:id  — direct ID lookup (admin/internal use)
router.get('/:id', optionalAuthenticate, controller.getById);

// ── Protected: seller/admin only ──────────────────────────────────────────────

// GET /api/v1/products/me/listings — seller's own products
router.get(
  '/me/listings',
  authenticate,
  authorize('seller', 'admin'),
  validate(listProductsDto, 'query'),
  controller.getMyProducts
);

// POST /api/v1/products  — create product with optional images
router.post(
  '/create',
  authenticate,
  authorize('seller', 'admin'),
  uploadProductImages,             // multer: req.files populated
  validate(createProductDto),      // validate body fields (not files)
  controller.create
);

// PATCH /api/v1/products/:id  — update product metadata
router.patch(
  '/:id',
  authenticate,
  authorize('seller', 'admin'),
  validate(updateProductDto),
  controller.update
);

// POST /api/v1/products/:id/images  — add more images
router.post(
  '/:id/images',
  authenticate,
  authorize('seller', 'admin'),
  uploadProductImages,
  controller.addImages
);

// DELETE /api/v1/products/:id/images/:imageId  — remove one image
router.delete(
  '/:id/images/:imageId',
  authenticate,
  authorize('seller', 'admin'),
  controller.removeImage
);

// PATCH /api/v1/products/:id/images/:imageId/primary  — set primary image
router.patch(
  '/:id/images/:imageId/primary',
  authenticate,
  authorize('seller', 'admin'),
  controller.setPrimaryImage
);

// DELETE /api/v1/products/:id  — soft delete
router.delete(
  '/:id',
  authenticate,
  authorize('seller', 'admin'),
  controller.remove
);

// ── Price Analysis ─────────────────────────────────────────────────────────────

// GET /api/v1/products/:id/price-analysis  — public
router.get('/:id/price-analysis', getPriceAnalysis);

// POST /api/v1/products/:id/price-analysis/refresh  — seller/admin only
router.post(
  '/:id/price-analysis/refresh',
  authenticate,
  authorize('seller', 'admin'),
  refreshPrediction
);


module.exports = router;