// src/modules/auth/auth.routes.js
const router = require('express').Router();
const rateLimit = require('express-rate-limit');

const controller = require('./auth.controller');
const validate = require('../../shared/middleware/validate');
const { authenticate } = require('../../shared/middleware/authenticate');
const {
  registerDto,
  loginDto,
  forgotPasswordDto,
  resetPasswordDto,
  changePasswordDto,
  verifyEmailDto,
} = require('./auth.dto');

// ──Rate limiters ────────────────────────────────────────────
const { authLimiter, forgotPasswordLimiter } = require('../../shared/middleware/rateLimiter');

// ── Public routes ──────────────────────────────────────────────────────────

// POST /api/v1/auth/register
router.post('/register', authLimiter, validate(registerDto), controller.register);

// POST /api/v1/auth/login
router.post('/login', authLimiter, validate(loginDto), controller.login);

// POST /api/v1/auth/refresh
// No auth middleware — refresh token is in httpOnly cookie
router.post('/refresh', controller.refresh);

// POST /api/v1/auth/verify-email
router.post('/verify-email', validate(verifyEmailDto), controller.verifyEmail);

// POST /api/v1/auth/resend-verification
router.post('/resend-verification', authLimiter, validate(forgotPasswordDto), controller.resendVerification);

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordDto), controller.forgotPassword);

// POST /api/v1/auth/reset-password
router.post('/reset-password', authLimiter, validate(resetPasswordDto), controller.resetPassword);

// ── Protected routes ───────────────────────────────────────────────────────

// POST /api/v1/auth/logout
router.post('/logout', authenticate, controller.logout);

// PATCH /api/v1/auth/change-password
router.patch('/change-password', authenticate, validate(changePasswordDto), controller.changePassword);

// GET /api/v1/auth/me
router.get('/me', authenticate, controller.getMe);

module.exports = router;