// src/modules/products/product.constants.js

const CATEGORIES = [
  'smartphones',
  'laptops',
  'tablets',
  'smartwatches',
  'headphones',
  'cameras',
  'gaming',
  'accessories',
  'networking',
  'other',
];

const CONDITIONS = ['new', 'like-new', 'good', 'fair', 'poor'];

const PRODUCT_STATUS = {
  ACTIVE: 'active',
  SOLD: 'sold',
  REMOVED: 'removed',   // soft delete
  DRAFT: 'draft',       // created but not yet published
};

const SORT_OPTIONS = {
  NEWEST: 'newest',
  OLDEST: 'oldest',
  PRICE_LOW: 'price_low',
  PRICE_HIGH: 'price_high',
  MOST_VIEWED: 'most_viewed',
};

const SORT_MAP = {
  [SORT_OPTIONS.NEWEST]: { createdAt: -1 },
  [SORT_OPTIONS.OLDEST]: { createdAt: 1 },
  [SORT_OPTIONS.PRICE_LOW]: { price: 1 },
  [SORT_OPTIONS.PRICE_HIGH]: { price: -1 },
  [SORT_OPTIONS.MOST_VIEWED]: { views: -1 },
};

const MAX_IMAGES = 5;
const VIEW_COUNT_TTL = 60 * 60 * 24; // 1 day Redis TTL for view dedup per user

module.exports = {
  CATEGORIES,
  CONDITIONS,
  PRODUCT_STATUS,
  SORT_OPTIONS,
  SORT_MAP,
  MAX_IMAGES,
  VIEW_COUNT_TTL,
};