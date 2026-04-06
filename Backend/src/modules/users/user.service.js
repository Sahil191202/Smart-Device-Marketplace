// src/modules/users/user.service.js
const userRepository = require('./user.repository');
const { uploadBuffer, deleteAsset } = require('../../config/cloudinary');
const AppError = require('../../shared/utils/AppError');
const logger = require('../../config/logger');

class UserService {

  // ── Profile ───────────────────────────────────────────────────────────────

  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.notFound('User');
    return user;
  }

  async updateProfile(userId, updates) {
    // Whitelist fields that can be updated via this endpoint
    // (email change is a separate flow requiring re-verification)
    const allowedFields = ['name'];
    const sanitized = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) sanitized[field] = updates[field];
    }

    if (Object.keys(sanitized).length === 0) {
      throw AppError.badRequest('No valid fields to update');
    }

    const updated = await userRepository.updateProfile(userId, sanitized);
    if (!updated) throw AppError.notFound('User');

    logger.info('Profile updated', { userId });
    return updated;
  }

  async updateAvatar(userId, fileBuffer, mimeType) {
    if (!fileBuffer) throw AppError.badRequest('No file provided');

    // Retrieve old avatar publicId BEFORE uploading new one
    const oldPublicId = await userRepository.getOldAvatarPublicId(userId);

    // Upload new avatar to Cloudinary
    // Transformation: square crop + face detection + WebP auto format
    const result = await uploadBuffer(fileBuffer, {
      folder: `smart-marketplace/avatars/${userId}`,
      public_id: 'avatar', // fixed name → auto-overwrites, no accumulation
      overwrite: true,
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto', fetch_format: 'auto' }, // WebP where supported
      ],
    });

    // Update DB with new avatar
    const updated = await userRepository.updateAvatar(userId, {
      url: result.secure_url,
      publicId: result.public_id,
    });

    // Delete old avatar from Cloudinary AFTER DB update succeeds
    // (if we delete before DB update and DB fails, user loses their avatar)
    if (oldPublicId && oldPublicId !== result.public_id) {
      await deleteAsset(oldPublicId);
    }

    logger.info('Avatar updated', { userId, url: result.secure_url });
    return updated;
  }

  async deleteAvatar(userId) {
    const publicId = await userRepository.getOldAvatarPublicId(userId);

    await userRepository.updateProfile(userId, { avatar: null });

    if (publicId) await deleteAsset(publicId);

    logger.info('Avatar deleted', { userId });
    return { message: 'Avatar removed' };
  }

  // ── Addresses ─────────────────────────────────────────────────────────────

  async getAddresses(userId) {
    return userRepository.getAddresses(userId);
  }

  async addAddress(userId, addressData) {
    // Enforce max 5 addresses
    const existing = await userRepository.getAddresses(userId);
    if (existing.length >= 5) {
      throw AppError.badRequest('Maximum of 5 addresses allowed. Remove one first.');
    }

    // If this is the first address, auto-set as default
    if (existing.length === 0) {
      addressData.isDefault = true;
    }

    const updated = await userRepository.addAddress(userId, addressData);
    logger.info('Address added', { userId });
    return updated.addresses;
  }

  async updateAddress(userId, addressId, updates) {
    const addresses = await userRepository.getAddresses(userId);
    const exists = addresses.some(a => a._id.toString() === addressId);
    if (!exists) throw AppError.notFound('Address');

    const updated = await userRepository.updateAddress(userId, addressId, updates);
    if (!updated) throw AppError.notFound('Address');

    return updated.addresses;
  }

  async removeAddress(userId, addressId) {
    const addresses = await userRepository.getAddresses(userId);
    const target = addresses.find(a => a._id.toString() === addressId);
    if (!target) throw AppError.notFound('Address');

    const updated = await userRepository.removeAddress(userId, addressId);

    // If removed address was default and others remain, auto-promote the first one
    if (target.isDefault && updated.addresses.length > 0) {
      await userRepository.setDefaultAddress(
        userId,
        updated.addresses[0]._id.toString()
      );
    }

    logger.info('Address removed', { userId, addressId });
    return (await userRepository.getAddresses(userId));
  }

  async setDefaultAddress(userId, addressId) {
    const addresses = await userRepository.getAddresses(userId);
    const exists = addresses.some(a => a._id.toString() === addressId);
    if (!exists) throw AppError.notFound('Address');

    const updated = await userRepository.setDefaultAddress(userId, addressId);
    return updated.addresses;
  }
}

module.exports = new UserService();