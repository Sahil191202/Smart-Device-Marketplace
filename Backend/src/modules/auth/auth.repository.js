// src/modules/auth/auth.repository.js
const User = require('../users/user.model');

class AuthRepository {
  // ── Read ──────────────────────────────────────────────────────────────────

  async findByEmail(email, includePassword = false) {
    const query = User.findOne({ email });
    if (includePassword) query.select('+passwordHash');
    return query.lean(); // lean() = plain JS object, faster, no Mongoose overhead
  }

  async findById(id, options = {}) {
    const query = User.findById(id);
    if (options.includeRefreshTokens) query.select('+refreshTokens');
    if (options.includePassword) query.select('+passwordHash');
    return options.lean !== false ? query.lean() : query; // default lean
  }

  async findByEmailVerificationToken(token) {
    return User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() },
    }).select('+emailVerificationToken +emailVerificationExpires');
  }

  async findByPasswordResetToken(token) {
    return User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires +passwordHash');
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  async create(userData) {
    // Don't use lean() here — we need the Mongoose doc for pre-save hook (bcrypt)
    const user = new User(userData);
    return user.save();
  }

  async setEmailVerificationToken(userId, token, expiresAt) {
    return User.updateOne(
      { _id: userId },
      {
        $set: {
          emailVerificationToken: token,
          emailVerificationExpires: expiresAt,
        },
      }
    );
  }

  async verifyEmail(userId) {
    return User.updateOne(
      { _id: userId },
      {
        $set: { emailVerified: true },
        $unset: { emailVerificationToken: '', emailVerificationExpires: '' },
      }
    );
  }

  async setPasswordResetToken(userId, token, expiresAt) {
    return User.updateOne(
      { _id: userId },
      {
        $set: {
          passwordResetToken: token,
          passwordResetExpires: expiresAt,
        },
      }
    );
  }

  async resetPassword(userId, newPasswordHash) {
    return User.updateOne(
      { _id: userId },
      {
        $set: { passwordHash: newPasswordHash },
        $unset: { passwordResetToken: '', passwordResetExpires: '' },
        // Wipe ALL refresh tokens on password reset — force re-login everywhere
        $set: { refreshTokens: [] },
      }
    );
  }

  async updatePassword(userId, newPasswordHash) {
    return User.updateOne(
      { _id: userId },
      {
        $set: { passwordHash: newPasswordHash, refreshTokens: [] },
      }
    );
  }

  // ── Refresh token management ───────────────────────────────────────────────

  async addRefreshToken(userId, tokenData) {
    return User.updateOne(
      { _id: userId },
      {
        $push: {
          refreshTokens: {
            $each: [tokenData],
            $slice: -5, // keep only the 5 most recent (oldest device gets logged out)
          },
        },
        $set: { lastLoginAt: new Date() },
        $set: { loginAttempts: 0 },
        $unset: { lockUntil: '' },
      }
    );
  }

  async findUserByTokenFamily(userId, family) {
    return User.findOne(
      { _id: userId, 'refreshTokens.family': family },
    ).select('+refreshTokens');
  }

  async removeRefreshTokenFamily(userId, family) {
    // Remove a specific token family (logout single device)
    return User.updateOne(
      { _id: userId },
      { $pull: { refreshTokens: { family } } }
    );
  }

  async removeAllRefreshTokens(userId) {
    // Wipe all tokens (logout all devices / attack detected)
    return User.updateOne(
      { _id: userId },
      { $set: { refreshTokens: [] } }
    );
  }

  async replaceRefreshToken(userId, family, newTokenData) {
    // Atomic: remove old family, insert new token in one operation
    return User.updateOne(
      { _id: userId },
      {
        $pull: { refreshTokens: { family } },
      }
    ).then(() =>
      User.updateOne(
        { _id: userId },
        {
          $push: {
            refreshTokens: {
              $each: [newTokenData],
              $slice: -5,
            },
          },
        }
      )
    );
  }

  async updateLastLogin(userId, ip) {
    return User.updateOne(
      { _id: userId },
      {
        $set: { lastLoginAt: new Date() },
        $inc: { loginAttempts: 0 }, // reset
      }
    );
  }
}

module.exports = new AuthRepository(); // singleton