// src/modules/wishlist/wishlist.controller.js
const wishlistService = require('./wishlist.service');
const apiResponse = require('../../shared/utils/apiResponse');
const asyncWrapper = require('../../shared/utils/asyncWrapper');

const addToWishlist = asyncWrapper(async (req, res) => {
  const result = await wishlistService.addToWishlist(
    req.user.id,
    req.params.productId
  );
  apiResponse.created(res, { message: 'Added to wishlist', data: result });
});

const removeFromWishlist = asyncWrapper(async (req, res) => {
  const result = await wishlistService.removeFromWishlist(
    req.user.id,
    req.params.productId
  );
  apiResponse.success(res, { message: 'Removed from wishlist', data: result });
});

const getWishlist = asyncWrapper(async (req, res) => {
  const { cursor, limit = 20 } = req.query;
  const result = await wishlistService.getWishlist(req.user.id, {
    cursor,
    limit: parseInt(limit),
  });
  apiResponse.success(res, {
    message: 'Wishlist fetched',
    data: { wishlist: result.items },
    meta: { nextCursor: result.nextCursor, hasNext: result.hasNext },
  });
});

const checkWishlisted = asyncWrapper(async (req, res) => {
  const isWishlisted = await wishlistService.checkWishlisted(
    req.user.id,
    req.params.productId
  );
  apiResponse.success(res, {
    message: 'Wishlist status fetched',
    data: { isWishlisted, productId: req.params.productId },
  });
});

const getWishlistCount = asyncWrapper(async (req, res) => {
  const count = await wishlistService.getWishlistCount(req.user.id);
  apiResponse.success(res, { message: 'Wishlist count', data: { count } });
});

module.exports = {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  checkWishlisted,
  getWishlistCount,
};