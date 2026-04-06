// src/modules/products/product.dto.js
const Joi = require('joi');
const { CATEGORIES, CONDITIONS, SORT_OPTIONS } = require('./product.constants');

const specsSchema = Joi.object()
  .pattern(
    Joi.string().max(50),
    Joi.alternatives().try(Joi.string().max(100), Joi.number())
  )
  .max(20) // max 20 spec fields
  .default({});

const createProductDto = Joi.object({
  title: Joi.string().min(10).max(150).trim().required(),
  description: Joi.string().min(30).max(3000).trim().required(),
  category: Joi.string().valid(...CATEGORIES).required(),
  brand: Joi.string().trim().max(50).required(),
  model: Joi.string().trim().max(100).allow(''),
  condition: Joi.string().valid(...CONDITIONS).required(),
  price: Joi.number().min(1).max(10000000).required(),
  specs: specsSchema,
  location: Joi.object({
    city: Joi.string().trim().max(50),
    state: Joi.string().trim().max(50),
  }).default({}),
  status: Joi.string().valid('active', 'draft').default('active'),
});

const updateProductDto = Joi.object({
  title: Joi.string().min(10).max(150).trim(),
  description: Joi.string().min(30).max(3000).trim(),
  category: Joi.string().valid(...CATEGORIES),
  brand: Joi.string().trim().max(50),
  model: Joi.string().trim().max(100).allow(''),
  condition: Joi.string().valid(...CONDITIONS),
  price: Joi.number().min(1).max(10000000),
  specs: specsSchema,
  location: Joi.object({
    city: Joi.string().trim().max(50),
    state: Joi.string().trim().max(50),
  }),
  status: Joi.string().valid('active', 'draft', 'sold'),
}).min(1);

const listProductsDto = Joi.object({
  // Cursor-based pagination
  cursor: Joi.string().allow(''),         // base64-encoded _id of last seen doc
  limit: Joi.number().min(1).max(50).default(20),

  // Filters
  category: Joi.string().valid(...CATEGORIES),
  brand: Joi.string().trim().max(50),
  condition: Joi.string().valid(...CONDITIONS),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  city: Joi.string().trim().max(50),
  sellerId: Joi.string().hex().length(24),  // ObjectId as hex string
  status: Joi.string().valid('active', 'draft', 'sold'),

  // Search
  q: Joi.string().trim().max(100).allow(''), // full-text search query

  // Sort
  sort: Joi.string().valid(...Object.values(SORT_OPTIONS)).default(SORT_OPTIONS.NEWEST),
});

module.exports = { createProductDto, updateProductDto, listProductsDto };