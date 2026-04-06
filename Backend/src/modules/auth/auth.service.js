// src/modules/auth/auth.service.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const authRepository = require('./auth.repository');
const AppError = require('../../shared/utils/AppError');
const logger = require('../../config/logger');
const env = require('../../config/env');
const { addEmailJob } = require('../../jobs/queue');
const {
  REFRESH_TOKEN_EXPIRY_DAYS,
  REFRESH_TOKEN_EXPIRY_MS,
  EMAIL_VERIFY_EXPIRY_MS,
  PASSWORD_RESET_EXPIRY_MS,
  BCRYPT_HASH_ROUNDS,
  MAX_REFRESH_TOKENS_PER_USER,
} = require('./auth.constants');

class AuthService {

  // ── Token generation ──────────────────────────────────────────────────────

  generateAccessToken(payload) {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      issuer: 'smart-marketplace',
      audience: 'smart-marketplace-client',
    });
  }

  generateRefreshToken() {
    // Cryptographically random, URL-safe token (not JWT — refresh tokens don't need claims)
    return crypto.randomBytes(64).toString('hex');
  }

  async hashToken(token) {
    // Use bcrypt with lower rounds (10) for token hashing — speed matters here
    // Passwords use 12 rounds (in model pre-save hook)
    return bcrypt.hash(token, BCRYPT_HASH_ROUNDS);
  }

  async compareTokenHash(token, hash) {
    return bcrypt.compare(token, hash);
  }

  buildRefreshTokenData(plainToken, family, ip, userAgent) {
    return {
      tokenHash: null, // will be set after hashing — done in caller
      family,
      ip,
      userAgent: userAgent?.slice(0, 200) || 'unknown', // cap UA string length
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    };
  }

  // ── Register ──────────────────────────────────────────────────────────────

  async register({ name, email, password, role }) {
    // 1. Check duplicate email
    const existing = await authRepository.findByEmail(email);
    if (existing) {
      throw AppError.conflict('Email already registered');
    }

    // 2. Create user (passwordHash stored — pre-save hook bcrypts it)
    const user = await authRepository.create({
      name,
      email,
      passwordHash: password, // raw password — model hooks will hash it
      role,
    });

    // 3. Generate email verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS);

    // Hash before storing — same principle as refresh tokens
    const verifyTokenHash = crypto
      .createHash('sha256')
      .update(verifyToken)
      .digest('hex');

    await authRepository.setEmailVerificationToken(user._id, verifyTokenHash, verifyExpires);

    // 4. Queue verification email (async — don't block response)
    await addEmailJob('email:verify', {
      to: user.email,
      name: user.name,
      verifyUrl: `${env.ALLOWED_ORIGINS.split(',')[0]}/verify-email?token=${verifyToken}`,
    });

    logger.info('User registered', { userId: user._id, email: user.email, role });

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: false,
    };
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async login({ email, password, ip, userAgent }) {
    // 1. Find user with password (select: false by default)
    const user = await authRepository.findByEmail(email, true);

    if (!user) {
      // Generic message — never reveal whether email exists
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // 2. Check account lock
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      throw new AppError(
        `Account locked. Try again in ${minutesLeft} minutes`,
        423,
        'ACCOUNT_LOCKED'
      );
    }

    // 3. Verify password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      // Get the Mongoose document (not lean) to call instance method
      const userDoc = await authRepository.findById(user._id, { lean: false });
      await userDoc.incrementLoginAttempts();
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // 4. Check email verification
    if (!user.emailVerified) {
      throw new AppError('Please verify your email before logging in', 403, 'EMAIL_NOT_VERIFIED');
    }

    // 5. Generate tokens
    const accessToken = this.generateAccessToken({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const plainRefreshToken = this.generateRefreshToken();
    const family = uuidv4(); // new family for new login session
    const tokenHash = await this.hashToken(plainRefreshToken);

    const tokenData = {
      tokenHash,
      family,
      ip,
      userAgent: userAgent?.slice(0, 200),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    };

    // 6. Persist refresh token + reset login attempts
    await authRepository.addRefreshToken(user._id, tokenData);

    logger.info('User logged in', { userId: user._id, ip });

    return {
      accessToken,
      refreshToken: plainRefreshToken,
      family,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    };
  }

  // ── Refresh Token ─────────────────────────────────────────────────────────

  async refreshTokens({ refreshToken, family, userId, ip, userAgent }) {
    if (!refreshToken || !family || !userId) {
      throw AppError.unauthorized('Invalid refresh token');
    }

    // 1. Find user with their refresh tokens
    const user = await authRepository.findUserByTokenFamily(userId, family);

    if (!user) {
      // Token family not found — either expired, or REUSE ATTACK
      // Wipe ALL tokens for this user as precaution
      if (userId) {
        await authRepository.removeAllRefreshTokens(userId);
        logger.warn('Refresh token reuse detected — all tokens wiped', { userId, ip });
      }
      throw new AppError('Session expired. Please login again.', 401, 'REFRESH_TOKEN_REUSED');
    }

    // 2. Find the specific token in the family
    const storedToken = user.refreshTokens.find(t => t.family === family);

    if (!storedToken) {
      await authRepository.removeAllRefreshTokens(user._id);
      throw new AppError('Session expired. Please login again.', 401, 'REFRESH_TOKEN_REUSED');
    }

    // 3. Check expiry
    if (storedToken.expiresAt < new Date()) {
      await authRepository.removeRefreshTokenFamily(user._id, family);
      throw AppError.unauthorized('Session expired. Please login again.');
    }

    // 4. Verify token hash
    const isValid = await this.compareTokenHash(refreshToken, storedToken.tokenHash);
    if (!isValid) {
      // Hash mismatch with correct family → reuse attack
      await authRepository.removeAllRefreshTokens(user._id);
      logger.warn('Refresh token hash mismatch — possible theft detected', { userId: user._id, ip });
      throw new AppError('Security violation detected. Please login again.', 401, 'REFRESH_TOKEN_REUSED');
    }

    // 5. Issue new tokens (rotation — old family gets new token)
    const newAccessToken = this.generateAccessToken({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const newPlainRefreshToken = this.generateRefreshToken();
    const newTokenHash = await this.hashToken(newPlainRefreshToken);

    const newTokenData = {
      tokenHash: newTokenHash,
      family, // SAME family — tracks the rotation chain
      ip,
      userAgent: userAgent?.slice(0, 200),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    };

    // 6. Atomic replace: remove old, insert new
    await authRepository.replaceRefreshToken(user._id, family, newTokenData);

    logger.debug('Tokens refreshed', { userId: user._id });

    return {
      accessToken: newAccessToken,
      refreshToken: newPlainRefreshToken,
      family,
    };
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout({ userId, family, logoutAll = false }) {
    if (logoutAll) {
      await authRepository.removeAllRefreshTokens(userId);
      logger.info('User logged out from all devices', { userId });
    } else {
      await authRepository.removeRefreshTokenFamily(userId, family);
      logger.info('User logged out', { userId });
    }
  }

  // ── Email Verification ────────────────────────────────────────────────────

  async verifyEmail({ token }) {
    // Hash the incoming token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await authRepository.findByEmailVerificationToken(tokenHash);
    if (!user) {
      throw AppError.badRequest('Invalid or expired verification link');
    }

    if (user.emailVerified) {
      throw AppError.badRequest('Email already verified');
    }

    await authRepository.verifyEmail(user._id);

    logger.info('Email verified', { userId: user._id });

    return { message: 'Email verified successfully' };
  }

  async resendVerificationEmail({ email }) {
    const user = await authRepository.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists — always return success
      return { message: 'If the email exists, a verification link has been sent' };
    }

    if (user.emailVerified) {
      throw AppError.badRequest('Email already verified');
    }

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
    const verifyExpires = new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS);

    await authRepository.setEmailVerificationToken(user._id, verifyTokenHash, verifyExpires);

    await addEmailJob('email:verify', {
      to: user.email,
      name: user.name,
      verifyUrl: `${env.ALLOWED_ORIGINS.split(',')[0]}/verify-email?token=${verifyToken}`,
    });

    return { message: 'If the email exists, a verification link has been sent' };
  }

  // ── Forgot Password ───────────────────────────────────────────────────────

  async forgotPassword({ email }) {
    const user = await authRepository.findByEmail(email);

    // Always return success — never reveal if email exists (enumeration attack)
    if (!user) {
      return { message: 'If that email is registered, a reset link has been sent' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);

    await authRepository.setPasswordResetToken(user._id, resetTokenHash, resetExpires);

    await addEmailJob('email:passwordReset', {
      to: user.email,
      name: user.name,
      resetUrl: `${env.ALLOWED_ORIGINS.split(',')[0]}/reset-password?token=${resetToken}`,
      expiresInMinutes: PASSWORD_RESET_EXPIRY_MS / 60000,
    });

    logger.info('Password reset email queued', { userId: user._id });

    return { message: 'If that email is registered, a reset link has been sent' };
  }

  // ── Reset Password ────────────────────────────────────────────────────────

  async resetPassword({ token, password }) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await authRepository.findByPasswordResetToken(tokenHash);
    if (!user) {
      throw AppError.badRequest('Invalid or expired reset link');
    }

    // Hash new password manually (bypassing model pre-save since we use updateOne)
    const newHash = await bcrypt.hash(password, 12);

    // resetPassword also wipes all refresh tokens → forced re-login everywhere
    await authRepository.resetPassword(user._id, newHash);

    await addEmailJob('email:passwordChanged', {
      to: user.email,
      name: user.name,
    });

    logger.info('Password reset successful', { userId: user._id });

    return { message: 'Password reset successfully. Please login.' };
  }

  // ── Change Password (authenticated) ──────────────────────────────────────

  async changePassword({ userId, currentPassword, newPassword }) {
    const user = await authRepository.findById(userId, { includePassword: true, lean: false });
    if (!user) throw AppError.notFound('User');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw AppError.badRequest('Current password is incorrect');
    }

    if (currentPassword === newPassword) {
      throw AppError.badRequest('New password must differ from current password');
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await authRepository.updatePassword(userId, newHash);

    logger.info('Password changed', { userId });

    return { message: 'Password changed successfully. Please login again.' };
  }
}

module.exports = new AuthService();