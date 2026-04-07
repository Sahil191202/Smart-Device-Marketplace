// src/modules/cart/cart.routes.js
const router = require('express').Router();
const controller = require('./cart.controller');
const { authenticate } = require('../../shared/middleware/authenticate');

router.use(authenticate);

// GET  /api/v1/cart
router.get('/', controller.getCart);

// GET  /api/v1/cart/count
router.get('/count', controller.getCartCount);

// POST /api/v1/cart/:productId
router.post('/:productId', controller.addItem);

// DELETE /api/v1/cart/:productId
router.delete('/:productId', controller.removeItem);

// DELETE /api/v1/cart
router.delete('/', controller.clearCart);

module.exports = router;