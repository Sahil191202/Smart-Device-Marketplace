// src/modules/products/product.repository.js
const mongoose = require("mongoose");
const Product = require("./product.model");
const { SORT_MAP, PRODUCT_STATUS } = require("./product.constants");

class ProductRepository {
  // ── Create ────────────────────────────────────────────────────────────────

  async create(data) {
    const product = new Product(data);
    return product.save();
  }

  // ── Read: single ──────────────────────────────────────────────────────────

  async findById(id, options = {}) {
    const query = Product.findById(id);
    if (options.withSeller) {
      query.populate("sellerId", "name avatar email createdAt");
    }
    if (options.includeRemoved) {
      query.setOptions({ includeRemoved: true });
    }
    return query.lean();
  }

  async findManyByIds(ids) {
    return Product.find({
      _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .select("_id title price status images sellerId category condition")
      .lean();
  }

  async findBySlug(slug, options = {}) {
    const query = Product.findOne({ slug });
    if (options.withSeller) {
      query.populate("sellerId", "name avatar email createdAt");
    }
    return query.lean();
  }

  async findByIdAndSeller(productId, sellerId) {
    // Used for ownership check before update/delete
    return Product.findOne({ _id: productId, sellerId })
      .setOptions({ includeRemoved: true })
      .lean();
  }

  // ── Read: cursor-based paginated list ─────────────────────────────────────

  async findPaginated({ cursor, limit = 20, filters = {}, sort = "newest" }) {
    const query = this._buildFilterQuery(filters);
    const sortSpec = SORT_MAP[sort] || SORT_MAP.newest;

    // Cursor logic:
    // The cursor encodes the last document seen.
    // For time-based sorts (_id or createdAt), we use _id comparison.
    // For price/views sorts, we use a composite cursor (value + _id).
    if (cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(cursor, "base64").toString("utf8"),
        );
        query._id = { $lt: new mongoose.Types.ObjectId(decoded.id) };

        // For non-default sorts, add secondary cursor condition
        if (sort === "price_low") {
          query.$or = [
            { price: { $gt: decoded.value } },
            {
              price: decoded.value,
              _id: { $lt: new mongoose.Types.ObjectId(decoded.id) },
            },
          ];
          delete query._id;
        } else if (sort === "price_high") {
          query.$or = [
            { price: { $lt: decoded.value } },
            {
              price: decoded.value,
              _id: { $lt: new mongoose.Types.ObjectId(decoded.id) },
            },
          ];
          delete query._id;
        } else if (sort === "most_viewed") {
          query.$or = [
            { views: { $lt: decoded.value } },
            {
              views: decoded.value,
              _id: { $lt: new mongoose.Types.ObjectId(decoded.id) },
            },
          ];
          delete query._id;
        }
      } catch {
        // Invalid cursor — ignore it, return from start
      }
    }

    // Fetch limit+1 to determine if there's a next page
    const products = await Product.find(query)
      .sort({ ...sortSpec, _id: -1 }) // always secondary sort on _id for stability
      .limit(limit + 1)
      .populate("sellerId", "name avatar")
      .lean();

    const hasNext = products.length > limit;
    const items = hasNext ? products.slice(0, limit) : products;

    // Build next cursor from last item
    let nextCursor = null;
    if (hasNext && items.length > 0) {
      const last = items[items.length - 1];
      const cursorData = { id: last._id.toString() };

      if (sort === "price_low" || sort === "price_high")
        cursorData.value = last.price;
      if (sort === "most_viewed") cursorData.value = last.views;

      nextCursor = Buffer.from(JSON.stringify(cursorData)).toString("base64");
    }

    return { items, nextCursor, hasNext };
  }

  // ── Read: full-text search ────────────────────────────────────────────────

  async search({ q, limit = 20, cursor, filters = {} }) {
    const query = {
      ...this._buildFilterQuery(filters),
      $text: { $search: q },
    };

    if (cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(cursor, "base64").toString("utf8"),
        );
        query._id = { $lt: new mongoose.Types.ObjectId(decoded.id) };
      } catch {
        /* ignore */
      }
    }

    const products = await Product.find(query, {
      score: { $meta: "textScore" }, // include relevance score
    })
      .sort({ score: { $meta: "textScore" }, _id: -1 })
      .limit(limit + 1)
      .populate("sellerId", "name avatar")
      .lean();

    const hasNext = products.length > limit;
    const items = hasNext ? products.slice(0, limit) : products;

    let nextCursor = null;
    if (hasNext && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ id: last._id.toString() }),
      ).toString("base64");
    }

    return { items, nextCursor, hasNext };
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(productId, updates) {
    return Product.findByIdAndUpdate(
      productId,
      { $set: updates },
      { new: true, runValidators: true },
    )
      .setOptions({ includeRemoved: true })
      .lean();
  }

  async addImages(productId, images) {
    return Product.findByIdAndUpdate(
      productId,
      { $push: { images: { $each: images } } },
      { new: true, runValidators: true },
    ).lean();
  }

  async removeImage(productId, imageId) {
    return Product.findByIdAndUpdate(
      productId,
      { $pull: { images: { _id: imageId } } },
      { new: true },
    ).lean();
  }

  async setPrimaryImage(productId, imageId) {
    // Unset all, then set target as primary
    await Product.updateOne(
      { _id: productId },
      { $set: { "images.$[].isPrimary": false } },
    );
    return Product.findOneAndUpdate(
      { _id: productId, "images._id": imageId },
      { $set: { "images.$.isPrimary": true } },
      { new: true },
    ).lean();
  }

  // ── Soft delete ───────────────────────────────────────────────────────────

  async softDelete(productId) {
    return Product.findByIdAndUpdate(
      productId,
      { $set: { status: PRODUCT_STATUS.REMOVED } },
      { new: true },
    )
      .setOptions({ includeRemoved: true })
      .lean();
  }

  // ── View count (batch flush from Redis) ───────────────────────────────────

  async incrementViews(productId, count = 1) {
    return Product.updateOne({ _id: productId }, { $inc: { views: count } });
  }

  // ── AI prediction update (called by Phase 5 Bull worker) ─────────────────

  async updatePredictedPrice(productId, prediction) {
    return Product.updateOne(
      { _id: productId },
      {
        $set: {
          predictedPrice: {
            value: prediction.price,
            confidence: prediction.confidence,
            generatedAt: new Date(),
          },
        },
      },
    );
  }

  // ── Stats (admin dashboard) ───────────────────────────────────────────────

  async getStats() {
    return Product.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalValue: { $sum: "$price" },
        },
      },
    ]);
  }

  // ── Private: build filter query ───────────────────────────────────────────

  _buildFilterQuery(filters) {
    const query = {};

    // Default: only active products
    query.status = filters.status || PRODUCT_STATUS.ACTIVE;

    if (filters.category) query.category = filters.category;
    if (filters.brand) query.brand = new RegExp(filters.brand, "i"); // partial match
    if (filters.condition) query.condition = filters.condition;
    if (filters.sellerId)
      query.sellerId = new mongoose.Types.ObjectId(filters.sellerId);

    if (filters.city) query["location.city"] = new RegExp(filters.city, "i");

    // Price range
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.price = {};
      if (filters.minPrice !== undefined) query.price.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) query.price.$lte = filters.maxPrice;
    }

    return query;
  }
}

module.exports = new ProductRepository();
