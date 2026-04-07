// src/modules/wishlist/wishlist.routes.js
const router = require('express').Router();
const controller = require('./wishlist.controller');
const { authenticate } = require('../../shared/middleware/authenticate');

router.use(authenticate); // all wishlist routes require auth

// GET  /api/v1/wishlist
router.get('/', controller.getWishlist);

// GET  /api/v1/wishlist/count
router.get('/count', controller.getWishlistCount);

// GET  /api/v1/wishlist/check/:productId
router.get('/check/:productId', controller.checkWishlisted);

// POST /api/v1/wishlist/:productId
router.post('/:productId', controller.addToWishlist);

// DELETE /api/v1/wishlist/:productId
router.delete('/:productId', controller.removeFromWishlist);

module.exports = router;