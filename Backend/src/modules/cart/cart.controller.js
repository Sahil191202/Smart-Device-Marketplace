// src/modules/cart/cart.controller.js
const cartService = require('./cart.service');
const apiResponse = require('../../shared/utils/apiResponse');
const asyncWrapper = require('../../shared/utils/asyncWrapper');

const getCart = asyncWrapper(async (req, res) => {
  const cart = await cartService.getCart(req.user.id);
  apiResponse.success(res, { message: 'Cart fetched', data: { cart } });
});

const addItem = asyncWrapper(async (req, res) => {
  const result = await cartService.addItem(req.user.id, req.params.productId);
  apiResponse.created(res, { message: 'Item added to cart', data: result });
});

const removeItem = asyncWrapper(async (req, res) => {
  const result = await cartService.removeItem(req.user.id, req.params.productId);
  apiResponse.success(res, { message: 'Item removed from cart', data: result });
});

const clearCart = asyncWrapper(async (req, res) => {
  await cartService.clearCart(req.user.id);
  apiResponse.success(res, { message: 'Cart cleared', data: null });
});

const getCartCount = asyncWrapper(async (req, res) => {
  const count = await cartService.getCartItemCount(req.user.id);
  apiResponse.success(res, { message: 'Cart count', data: { count } });
});

module.exports = { getCart, addItem, removeItem, clearCart, getCartCount };