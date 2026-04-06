// src/modules/auth/auth.controller.js
const authService = require('./auth.service');
const apiResponse = require('../../shared/utils/apiResponse');
const asyncWrapper = require('../../shared/utils/asyncWrapper');
const { TOKEN_COOKIE_NAME, REFRESH_TOKEN_EXPIRY_MS } = require('./auth.constants');
const env = require('../../config/env');

// ── Cookie options ────────────────────────────────────────────────────────────
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,                                    // XSS protection — JS can't read this
  secure: env.NODE_ENV === 'production',             // HTTPS only in production
  sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax', // CSRF protection
  maxAge: REFRESH_TOKEN_EXPIRY_MS,
  path: '/api/v1/auth',                             // cookie only sent to auth routes
};

// Embed token family in cookie name to support multiple sessions
// Alternative: store family in a separate cookie
const setRefreshCookie = (res, token, family) => {
  res.cookie(TOKEN_COOKIE_NAME, JSON.stringify({ token, family }), REFRESH_COOKIE_OPTIONS);
};

const clearRefreshCookie = (res) => {
  res.clearCookie(TOKEN_COOKIE_NAME, { path: '/api/v1/auth' });
};

const register = asyncWrapper(async (req, res) => {
  const user = await authService.register(req.body);
  apiResponse.created(res, {
    message: 'Registration successful. Please verify your email.',
    data: { user },
  });
});

const login = asyncWrapper(async (req, res) => {
  const { accessToken, refreshToken, family, user } = await authService.login({
    ...req.body,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  setRefreshCookie(res, refreshToken, family);

  apiResponse.success(res, {
    message: 'Login successful',
    data: { accessToken, user },
  });
});

const refresh = asyncWrapper(async (req, res) => {
  // Parse refresh token + family from httpOnly cookie
  const cookieRaw = req.cookies[TOKEN_COOKIE_NAME];
  if (!cookieRaw) {
    return res.status(401).json({
      success: false,
      message: 'No refresh token',
      code: 'UNAUTHORIZED',
    });
  }

  let cookieData;
  try {
    cookieData = JSON.parse(cookieRaw);
  } catch {
    clearRefreshCookie(res);
    return res.status(401).json({ success: false, message: 'Invalid session', code: 'UNAUTHORIZED' });
  }

  const { token: refreshToken, family } = cookieData;

  // Extract userId from access token (even if expired — we just need the ID)
  // We read it from the Authorization header if present, else from cookie
  const authHeader = req.headers.authorization;
  let userId = null;

  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = require('jsonwebtoken').decode(authHeader.slice(7));
      userId = decoded?.sub;
    } catch { /* ignore */ }
  }

  // userId can also come from a separate cookie or the refresh cookie payload
  // For now, we store it in the cookie alongside the token
  if (!userId && cookieData.userId) {
    userId = cookieData.userId;
  }

  const tokens = await authService.refreshTokens({
    refreshToken,
    family,
    userId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Rotate the cookie too
  setRefreshCookie(res, tokens.refreshToken, tokens.family);

  apiResponse.success(res, {
    message: 'Token refreshed',
    data: { accessToken: tokens.accessToken },
  });
});

const logout = asyncWrapper(async (req, res) => {
  const cookieRaw = req.cookies[TOKEN_COOKIE_NAME];
  let family = null;

  if (cookieRaw) {
    try {
      family = JSON.parse(cookieRaw).family;
    } catch { /* ignore */ }
  }

  await authService.logout({
    userId: req.user.id,
    family,
    logoutAll: req.query.all === 'true',
  });

  clearRefreshCookie(res);

  apiResponse.success(res, { message: 'Logged out successfully', data: null });
});

const verifyEmail = asyncWrapper(async (req, res) => {
  const result = await authService.verifyEmail(req.body);
  apiResponse.success(res, { message: result.message, data: null });
});

const resendVerification = asyncWrapper(async (req, res) => {
  const result = await authService.resendVerificationEmail(req.body);
  apiResponse.success(res, { message: result.message, data: null });
});

const forgotPassword = asyncWrapper(async (req, res) => {
  const result = await authService.forgotPassword(req.body);
  apiResponse.success(res, { message: result.message, data: null });
});

const resetPassword = asyncWrapper(async (req, res) => {
  const result = await authService.resetPassword(req.body);
  apiResponse.success(res, { message: result.message, data: null });
});

const changePassword = asyncWrapper(async (req, res) => {
  const result = await authService.changePassword({
    userId: req.user.id,
    ...req.body,
  });
  apiResponse.success(res, { message: result.message, data: null });
});

const getMe = asyncWrapper(async (req, res) => {
  // req.user is set by authenticate middleware
  apiResponse.success(res, {
    message: 'Profile fetched',
    data: { user: req.user },
  });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
};