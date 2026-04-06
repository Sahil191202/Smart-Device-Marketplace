// src/modules/users/user.controller.js
const userService = require('./user.service');
const apiResponse = require('../../shared/utils/apiResponse');
const asyncWrapper = require('../../shared/utils/asyncWrapper');

// ── Profile ───────────────────────────────────────────────────────────────────

const getProfile = asyncWrapper(async (req, res) => {
  const user = await userService.getProfile(req.user.id);
  apiResponse.success(res, { message: 'Profile fetched', data: { user } });
});

const updateProfile = asyncWrapper(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  apiResponse.success(res, { message: 'Profile updated', data: { user } });
});

const updateAvatar = asyncWrapper(async (req, res) => {
  // req.file set by multer uploadAvatar middleware
  const updated = await userService.updateAvatar(
    req.user.id,
    req.file.buffer,
    req.file.mimetype
  );
  apiResponse.success(res, { message: 'Avatar updated', data: updated });
});

const deleteAvatar = asyncWrapper(async (req, res) => {
  const result = await userService.deleteAvatar(req.user.id);
  apiResponse.success(res, { message: result.message, data: null });
});

// ── Addresses ─────────────────────────────────────────────────────────────────

const getAddresses = asyncWrapper(async (req, res) => {
  const addresses = await userService.getAddresses(req.user.id);
  apiResponse.success(res, { message: 'Addresses fetched', data: { addresses } });
});

const addAddress = asyncWrapper(async (req, res) => {
  const addresses = await userService.addAddress(req.user.id, req.body);
  apiResponse.created(res, { message: 'Address added', data: { addresses } });
});

const updateAddress = asyncWrapper(async (req, res) => {
  const addresses = await userService.updateAddress(
    req.user.id,
    req.params.addressId,
    req.body
  );
  apiResponse.success(res, { message: 'Address updated', data: { addresses } });
});

const removeAddress = asyncWrapper(async (req, res) => {
  const addresses = await userService.removeAddress(req.user.id, req.params.addressId);
  apiResponse.success(res, { message: 'Address removed', data: { addresses } });
});

const setDefaultAddress = asyncWrapper(async (req, res) => {
  const addresses = await userService.setDefaultAddress(req.user.id, req.params.addressId);
  apiResponse.success(res, { message: 'Default address updated', data: { addresses } });
});

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
  deleteAvatar,
  getAddresses,
  addAddress,
  updateAddress,
  removeAddress,
  setDefaultAddress,
};