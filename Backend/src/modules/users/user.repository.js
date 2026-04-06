// src/modules/users/user.repository.js
const User = require('./user.model');

class UserRepository {

  // ── Profile ───────────────────────────────────────────────────────────────

  async findById(id) {
    // Public-safe fields only — no tokens, no password
    return User.findById(id)
      .select('-refreshTokens -passwordHash -emailVerificationToken -passwordResetToken')
      .lean();
  }

  async updateProfile(userId, updates) {
    return User.findByIdAndUpdate(
      userId,
      { $set: updates },
      {
        new: true,         // return updated document
        runValidators: true, // run schema validators on update
        select: '-refreshTokens -passwordHash -emailVerificationToken -passwordResetToken',
      }
    ).lean();
  }

  async updateAvatar(userId, avatarData) {
    // avatarData = { url: string, publicId: string }
    return User.findByIdAndUpdate(
      userId,
      { $set: { avatar: avatarData } },
      { new: true, select: 'avatar name email' }
    ).lean();
  }

  async getOldAvatarPublicId(userId) {
    const user = await User.findById(userId).select('avatar').lean();
    return user?.avatar?.publicId || null;
  }

  // ── Addresses ─────────────────────────────────────────────────────────────

  async getAddresses(userId) {
    const user = await User.findById(userId).select('addresses').lean();
    return user?.addresses || [];
  }

  async addAddress(userId, addressData) {
    // If new address is default, unset all others first — then push new one
    // Using two separate ops in a session would be cleaner with transactions
    // but for this sub-document array, we do it with conditional update
    if (addressData.isDefault) {
      await User.updateOne(
        { _id: userId },
        { $set: { 'addresses.$[].isDefault': false } }
      );
    }

    return User.findByIdAndUpdate(
      userId,
      { $push: { addresses: addressData } },
      { new: true, runValidators: true, select: 'addresses' }
    ).lean();
  }

  async updateAddress(userId, addressId, updates) {
    // If setting this address as default, unset all others
    if (updates.isDefault === true) {
      await User.updateOne(
        { _id: userId },
        { $set: { 'addresses.$[].isDefault': false } }
      );
    }

    // Build dot-notation update for sub-document fields
    const setFields = {};
    for (const [key, value] of Object.entries(updates)) {
      setFields[`addresses.$.${key}`] = value;
    }

    return User.findOneAndUpdate(
      { _id: userId, 'addresses._id': addressId },
      { $set: setFields },
      { new: true, runValidators: true, select: 'addresses' }
    ).lean();
  }

  async removeAddress(userId, addressId) {
    return User.findByIdAndUpdate(
      userId,
      { $pull: { addresses: { _id: addressId } } },
      { new: true, select: 'addresses' }
    ).lean();
  }

  async setDefaultAddress(userId, addressId) {
    // Unset all → set target as default (two atomic ops, no race condition risk
    // since only this user modifies their own addresses)
    await User.updateOne(
      { _id: userId },
      { $set: { 'addresses.$[].isDefault': false } }
    );

    return User.findOneAndUpdate(
      { _id: userId, 'addresses._id': addressId },
      { $set: { 'addresses.$.isDefault': true } },
      { new: true, select: 'addresses' }
    ).lean();
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  async findAllPaginated({ page = 1, limit = 20, role, search }) {
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('name email role avatar emailVerified createdAt lastLoginAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return {
      users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async softDelete(userId) {
    return User.updateOne(
      { _id: userId },
      {
        $set: {
          isDeleted: true,
          email: `deleted_${Date.now()}_${userId}@deleted.com`, // free up email for reuse
          refreshTokens: [],
        },
      }
    );
  }
}

module.exports = new UserRepository();