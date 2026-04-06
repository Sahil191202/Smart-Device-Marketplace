// src/modules/users/user.routes.js
const router = require('express').Router();
const controller = require('./user.controller');
const { authenticate } = require('../../shared/middleware/authenticate');
const { authorize } = require('../../shared/middleware/authorize');
const validate = require('../../shared/middleware/validate');
const { uploadAvatar } = require('../../shared/middleware/upload');
const { updateProfileDto, addAddressDto, updateAddressDto } = require('./user.dto');

// All user routes require authentication
router.use(authenticate);

// ── Profile ───────────────────────────────────────────────────────────────────

// GET  /api/v1/users/me
router.get('/me', controller.getProfile);

// PATCH /api/v1/users/me
router.patch('/me', validate(updateProfileDto), controller.updateProfile);

// POST /api/v1/users/me/avatar
// uploadAvatar middleware runs first: validates file type/size, puts buffer in req.file
router.post('/me/avatar', uploadAvatar, controller.updateAvatar);

// DELETE /api/v1/users/me/avatar
router.delete('/me/avatar', controller.deleteAvatar);

// ── Addresses ─────────────────────────────────────────────────────────────────

// GET  /api/v1/users/me/addresses
router.get('/me/addresses', controller.getAddresses);

// POST /api/v1/users/me/addresses
router.post('/me/addresses', validate(addAddressDto), controller.addAddress);

// PATCH /api/v1/users/me/addresses/:addressId
router.patch('/me/addresses/:addressId', validate(updateAddressDto), controller.updateAddress);

// DELETE /api/v1/users/me/addresses/:addressId
router.delete('/me/addresses/:addressId', controller.removeAddress);

// PATCH /api/v1/users/me/addresses/:addressId/default
router.patch('/me/addresses/:addressId/default', controller.setDefaultAddress);

module.exports = router;