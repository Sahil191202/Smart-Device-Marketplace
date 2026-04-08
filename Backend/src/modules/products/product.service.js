// src/modules/products/product.service.js
const productRepository = require("./product.repository");
const { uploadBuffer, deleteAsset } = require("../../config/cloudinary");
const { addAIJob } = require("../../jobs/queue");
const { getRedisClient } = require("../../config/redis");
const AppError = require("../../shared/utils/AppError");
const logger = require("../../config/logger");
const {
  MAX_IMAGES,
  VIEW_COUNT_TTL,
  PRODUCT_STATUS,
} = require("./product.constants");
const cacheManager = require("../../shared/cache/cache.manager");
const { CacheKeys } = require("../../shared/cache/cache.keys");
const TTL = require("../../shared/cache/cache.ttl");

class ProductService {
  // ── Create ────────────────────────────────────────────────────────────────

  async create({ data, files, sellerId }) {
    // 1. Upload images to Cloudinary in parallel
    let images = [];
    if (files && files.length > 0) {
      images = await this._uploadImages(files, sellerId);
    }

    // 2. Create product document
    const product = await productRepository.create({
      ...data,
      sellerId,
      images,
    });

    // 3. Queue AI price prediction (async — don't block response)
    // Phase 5 worker will call FastAPI and update predictedPrice
    await addAIJob("ai:predictPrice", {
      productId: product._id.toString(),
      title: product.title,
      category: product.category,
      brand: product.brand,
      condition: product.condition,
      price: product.price,
      specs: product.specs,
    }).catch((err) => {
      // Non-critical — log but don't fail product creation
      logger.warn("Failed to queue AI prediction job", {
        productId: product._id,
        error: err.message,
      });
    });

    logger.info("Product created", { productId: product._id, sellerId });
    return product;
  }

  // ── List (paginated + filtered) ───────────────────────────────────────────

  async list(queryParams, userId = null) {
    const { cursor, limit, sort, ...filters } = queryParams;

    // Search results: separate cache key, shorter TTL
    if (filters.q && filters.q.trim()) {
      const q = filters.q.trim();
      const searchParams = { q, limit, cursor, ...filters };
      const cacheKey = CacheKeys.productSearch(searchParams);

      const result = await cacheManager.getOrSet(
        cacheKey,
        () =>
          productRepository.search({
            q,
            limit,
            cursor,
            filters: { ...filters, q: undefined },
          }),
        TTL.PRODUCT_SEARCH(),
        [], // search results not tagged (invalidated via TTL)
      );

      return this._injectWishlistStatus(result, userId);
    }

    // Regular list: cache per query param combination
    const listParams = { cursor, limit, sort, ...filters };
    const cacheKey = CacheKeys.productList(listParams);

    // Build tags from filter values (for smart invalidation)
    const tags = [];
    if (filters.category) tags.push(`category:${filters.category}`);
    if (filters.sellerId) tags.push(`seller:${filters.sellerId}`);

    const result = await cacheManager.getOrSet(
      cacheKey,
      () => productRepository.findPaginated({ cursor, limit, sort, filters }),
      TTL.PRODUCT_LIST(),
      tags,
    );

    return this._injectWishlistStatus(result, userId);
  }

  // ── injectWishlistStatus helper ────────────────────────────────────────────────────

  async _injectWishlistStatus(result, userId) {
    if (!userId || !result?.items?.length) return result;

    const wishlistService = require("../wishlist/wishlist.service");
    const productIds = result.items.map((p) => p._id.toString());
    const wishlistedSet = await wishlistService.getBulkWishlistStatus(
      userId,
      productIds,
    );

    return {
      ...result,
      items: result.items.map((product) => ({
        ...product,
        isWishlisted: wishlistedSet.has(product._id.toString()),
      })),
    };
  }

  // ── Get single product ────────────────────────────────────────────────────

  async getBySlug(slug, userId = null) {
    const cacheKey = CacheKeys.productBySlug(slug);

    const product = await cacheManager.getOrSet(
      cacheKey,
      () => productRepository.findBySlug(slug, { withSeller: true }),
      TTL.PRODUCT_DETAIL(),
      [`product:${slug}`],
    );

    if (!product) throw AppError.notFound("Product");

    // Track view async
    this._trackView(product._id.toString(), userId).catch(() => {});

    return product;
  }

  async getById(productId) {
    const cacheKey = CacheKeys.productDetail(productId);

    const product = await cacheManager.getOrSet(
      cacheKey,
      () => productRepository.findById(productId, { withSeller: true }),
      TTL.PRODUCT_DETAIL(),
      [`product:${productId}`],
    );

    if (!product) throw AppError.notFound("Product");
    return product;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update({ productId, sellerId, role, updates }) {
    await this._assertOwnership(productId, sellerId, role);
    if (updates.status === PRODUCT_STATUS.REMOVED && role !== "admin") {
      throw AppError.forbidden(
        "Cannot set status to removed. Use the delete endpoint.",
      );
    }

    const updated = await productRepository.update(productId, updates);
    if (!updated) throw AppError.notFound("Product");

    // Invalidate caches for this product
    await cacheManager.invalidateProduct(productId, updated.slug);

    logger.info("Product updated", { productId, sellerId });
    return updated;
  }

  // ── Image management ──────────────────────────────────────────────────────

  async addImages({ productId, sellerId, role, files }) {
    await this._assertOwnership(productId, sellerId, role);

    const product = await productRepository.findById(productId);
    if (!product) throw AppError.notFound("Product");

    const currentCount = product.images?.length || 0;
    if (currentCount + files.length > MAX_IMAGES) {
      throw AppError.badRequest(
        `Cannot add ${files.length} image(s). Product already has ${currentCount}/${MAX_IMAGES} images.`,
      );
    }

    const newImages = await this._uploadImages(files, sellerId, productId);
    const updated = await productRepository.addImages(productId, newImages);

    logger.info("Product images added", { productId, count: newImages.length });
    return updated;
  }

  async removeImage({ productId, imageId, sellerId, role }) {
    await this._assertOwnership(productId, sellerId, role);

    const product = await productRepository.findById(productId);
    if (!product) throw AppError.notFound("Product");

    const image = product.images?.find((img) => img._id.toString() === imageId);
    if (!image) throw AppError.notFound("Image");

    if (product.images.length === 1) {
      throw AppError.badRequest(
        "Cannot remove the only image. Add another image first.",
      );
    }

    // Remove from DB first
    const updated = await productRepository.removeImage(productId, imageId);

    // Delete from Cloudinary after DB update
    await deleteAsset(image.publicId);

    logger.info("Product image removed", { productId, imageId });
    return updated;
  }

  async setPrimaryImage({ productId, imageId, sellerId, role }) {
    await this._assertOwnership(productId, sellerId, role);

    const product = await productRepository.findById(productId);
    if (!product) throw AppError.notFound("Product");

    const imageExists = product.images?.some(
      (img) => img._id.toString() === imageId,
    );
    if (!imageExists) throw AppError.notFound("Image");

    return productRepository.setPrimaryImage(productId, imageId);
  }

  // ── Soft delete ───────────────────────────────────────────────────────────

  async remove({ productId, sellerId, role }) {
    await this._assertOwnership(productId, sellerId, role);

    const product = await productRepository.softDelete(productId);
    if (!product) throw AppError.notFound("Product");

    await cacheManager.invalidateProduct(productId, product.slug);

    logger.info("Product removed", { productId, sellerId });
    return { message: "Product removed successfully" };
  }

  // ── Seller's own products ─────────────────────────────────────────────────

  async getMyProducts({ sellerId, cursor, limit, sort, status }) {
    return productRepository.findPaginated({
      cursor,
      limit,
      sort,
      filters: { sellerId, status },
    });
  }

  // ── View tracking (Redis-based, batched) ──────────────────────────────────

  async _trackView(productId, userId) {
    const redis = getRedisClient();

    // Dedup key: one view per user (or IP) per product per 24h
    const dedupKey = `view:dedup:${productId}:${userId || "guest"}`;
    const alreadyViewed = await redis.get(dedupKey);
    if (alreadyViewed) return;

    // Mark as viewed
    await redis.setEx(dedupKey, VIEW_COUNT_TTL, "1");

    // Increment view counter in Redis (batch flush to MongoDB periodically)
    await redis.incr(`view:count:${productId}`);
  }

  // ── Flush view counts from Redis to MongoDB ───────────────────────────────
  // Called by a scheduled Bull job (every 5 minutes in Phase 8)

  async flushViewCounts() {
    const redis = getRedisClient();
    const keys = await redis.keys("view:count:*");
    if (!keys.length) return;

    const pipeline = redis.multi();
    for (const key of keys) {
      pipeline.getDel(key); // atomic get + delete
    }
    const counts = await pipeline.exec();

    const updates = keys
      .map((key, i) => ({
        productId: key.replace("view:count:", ""),
        count: parseInt(counts[i]) || 0,
      }))
      .filter((u) => u.count > 0);

    await Promise.all(
      updates.map(({ productId, count }) =>
        productRepository.incrementViews(productId, count),
      ),
    );

    logger.info("View counts flushed", { productCount: updates.length });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  async _assertOwnership(productId, sellerId, role) {
    if (role === "admin") return; // admins bypass ownership check

    const product = await productRepository.findByIdAndSeller(
      productId,
      sellerId,
    );
    if (!product) {
      // Return 404 not 403 — don't reveal that the product exists
      throw AppError.notFound("Product");
    }
  }

  async _uploadImages(files, sellerId, productId = null) {
    const folder = `smart-marketplace/products/${sellerId}`;

    // Upload all images in parallel (Promise.all — not sequential)
    const uploadResults = await Promise.all(
      files.map((file, index) =>
        uploadBuffer(file.buffer, {
          folder,
          transformation: [
            { width: 1200, height: 900, crop: "limit" }, // max dimensions
            { quality: "auto", fetch_format: "auto" }, // auto WebP
          ],
        }).then((result) => ({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          isPrimary: index === 0 && !productId, // first image is primary for new products
        })),
      ),
    );

    return uploadResults;
  }
}

module.exports = new ProductService();
