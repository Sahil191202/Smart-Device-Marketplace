// src/modules/products/product.controller.js
const productService = require('./product.service');
const apiResponse = require('../../shared/utils/apiResponse');
const asyncWrapper = require('../../shared/utils/asyncWrapper');

const create = asyncWrapper(async (req, res) => {
  const product = await productService.create({
    data: req.body,
    files: req.files || [],
    sellerId: req.user.id,
  });
  apiResponse.created(res, { message: 'Product created', data: { product } });
});

const list = asyncWrapper(async (req, res) => {
  const { items, nextCursor, hasNext } = await productService.list(
    req.query,
    req.user?.id || null  // req.user set by optionalAuthenticate
  );
  apiResponse.success(res, {
    message: 'Products fetched',
    data: { products: items },
    meta: { nextCursor, hasNext, count: items.length },
  });
});

const getBySlug = asyncWrapper(async (req, res) => {
  const product = await productService.getBySlug(
    req.params.slug,
    req.user?.id // optional — from optionalAuthenticate
  );
  apiResponse.success(res, { message: 'Product fetched', data: { product } });
});

const getById = asyncWrapper(async (req, res) => {
  const product = await productService.getById(req.params.id);
  apiResponse.success(res, { message: 'Product fetched', data: { product } });
});

const update = asyncWrapper(async (req, res) => {
  const product = await productService.update({
    productId: req.params.id,
    sellerId: req.user.id,
    role: req.user.role,
    updates: req.body,
  });
  apiResponse.success(res, { message: 'Product updated', data: { product } });
});

const addImages = asyncWrapper(async (req, res) => {
  const product = await productService.addImages({
    productId: req.params.id,
    sellerId: req.user.id,
    role: req.user.role,
    files: req.files || [],
  });
  apiResponse.success(res, { message: 'Images added', data: { product } });
});

const removeImage = asyncWrapper(async (req, res) => {
  const product = await productService.removeImage({
    productId: req.params.id,
    imageId: req.params.imageId,
    sellerId: req.user.id,
    role: req.user.role,
  });
  apiResponse.success(res, { message: 'Image removed', data: { product } });
});

const setPrimaryImage = asyncWrapper(async (req, res) => {
  const product = await productService.setPrimaryImage({
    productId: req.params.id,
    imageId: req.params.imageId,
    sellerId: req.user.id,
    role: req.user.role,
  });
  apiResponse.success(res, { message: 'Primary image updated', data: { product } });
});

const remove = asyncWrapper(async (req, res) => {
  const result = await productService.remove({
    productId: req.params.id,
    sellerId: req.user.id,
    role: req.user.role,
  });
  apiResponse.success(res, { message: result.message, data: null });
});

const getMyProducts = asyncWrapper(async (req, res) => {
  const { items, nextCursor, hasNext } = await productService.getMyProducts({
    sellerId: req.user.id,
    ...req.query,
  });
  apiResponse.success(res, {
    message: 'Your products fetched',
    data: { products: items },
    meta: { nextCursor, hasNext, count: items.length },
  });
});

module.exports = {
  create,
  list,
  getBySlug,
  getById,
  update,
  addImages,
  removeImage,
  setPrimaryImage,
  remove,
  getMyProducts,
};