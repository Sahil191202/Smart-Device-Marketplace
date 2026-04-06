// src/modules/products/product.model.js
const mongoose = require('mongoose');
const slugify = require('slugify');
const { customAlphabet } = require('nanoid');
const { CATEGORIES, CONDITIONS, PRODUCT_STATUS } = require('./product.constants');

// 6-char alphanumeric suffix for unique slugs — 56 billion combinations
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true }, // Cloudinary public_id for deletion
  width: Number,
  height: Number,
  format: String,  // 'jpg', 'webp', etc.
  isPrimary: { type: Boolean, default: false }, // first image shown in cards
}, { _id: true });

const specsSchema = new mongoose.Schema({
  // Flexible key-value for device specs (RAM, storage, processor, etc.)
  // Stored as Mixed for flexibility — validated at service layer
}, { strict: false, _id: false });

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    minlength: [10, 'Title must be at least 10 characters'],
    maxlength: [150, 'Title cannot exceed 150 characters'],
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    minlength: [30, 'Description must be at least 30 characters'],
    maxlength: [3000, 'Description cannot exceed 3000 characters'],
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true,
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: CATEGORIES,
    index: true,
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true,
    maxlength: 50,
    index: true,
  },
  model: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  condition: {
    type: String,
    required: [true, 'Condition is required'],
    enum: CONDITIONS,
    index: true,
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [1, 'Price must be at least ₹1'],
    max: [10000000, 'Price cannot exceed ₹1,00,00,000'],
    index: true,
  },
  // Populated by Phase 5 AI service (null until prediction runs)
  predictedPrice: {
    value: Number,
    confidence: Number,    // 0-1 confidence score from ML model
    generatedAt: Date,
  },
  images: {
    type: [imageSchema],
    validate: [
      arr => arr.length <= 5,
      'Maximum 5 images allowed',
    ],
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  specs: {
    type: specsSchema,
    default: {},
  },
  status: {
    type: String,
    enum: Object.values(PRODUCT_STATUS),
    default: PRODUCT_STATUS.ACTIVE,
    index: true,
  },
  location: {
    city: { type: String, trim: true },
    state: { type: String, trim: true },
  },
  views: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Wishlist count — denormalized for sort/filter performance
  wishlistCount: {
    type: Number,
    default: 0,
    min: 0,
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      delete ret.__v;
      return ret;
    },
  },
});

// ── Text index for full-text search ──────────────────────────────────────────
// Weights control relevance scoring: title match ranks higher than description
productSchema.index(
  { title: 'text', description: 'text', brand: 'text' },
  { weights: { title: 10, brand: 5, description: 1 }, name: 'product_text_index' }
);

// ── Compound indexes mirroring every query pattern ────────────────────────────
// Rule: index field order = (equality filters first) → (range) → (sort)

// Primary listing query: active products by category, sorted by newest
productSchema.index({ status: 1, category: 1, createdAt: -1 });

// Price range filter + sort
productSchema.index({ status: 1, price: 1, createdAt: -1 });

// Seller's own product list (dashboard)
productSchema.index({ sellerId: 1, status: 1, createdAt: -1 });

// Brand + condition filter
productSchema.index({ status: 1, brand: 1, condition: 1 });

// Most viewed (trending)
productSchema.index({ status: 1, views: -1 });

// ── Virtual: primary image URL ────────────────────────────────────────────────
productSchema.virtual('primaryImage').get(function () {
  const primary = this.images?.find(img => img.isPrimary);
  return primary?.url || this.images?.[0]?.url || null;
});

// ── Pre-save: generate slug ───────────────────────────────────────────────────
productSchema.pre('save', async function (next) {
  // Only generate slug on first save (new document)
  if (!this.isNew) return next();

  const base = slugify(this.title, {
    lower: true,
    strict: true,    // remove non-alphanumeric except hyphens
    trim: true,
  });

  // Append nanoid suffix — guaranteed unique without DB lookup
  this.slug = `${base}-${nanoid()}`;
  next();
});

// ── Query middleware: exclude removed products by default ─────────────────────
productSchema.pre(/^find/, function (next) {
  // Admin can bypass with .setOptions({ includeRemoved: true })
  if (!this.getOptions().includeRemoved) {
    this.where({ status: { $ne: 'removed' } });
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);