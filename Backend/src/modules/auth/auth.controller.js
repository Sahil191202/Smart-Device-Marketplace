// src/modules/auth/auth.controller.js
const authService = require("./auth.service");
const apiResponse = require("../../shared/utils/apiResponse");
const asyncWrapper = require("../../shared/utils/asyncWrapper");
const {
  TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_EXPIRY_MS,
} = require("./auth.constants");
const env = require("../../config/env");

// ── Cookie options ────────────────────────────────────────────────────────────
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true, // XSS protection — JS can't read this
  secure: env.NODE_ENV === "production", // HTTPS only in production
  sameSite: env.NODE_ENV === "production" ? "strict" : "lax", // CSRF protection
  maxAge: REFRESH_TOKEN_EXPIRY_MS,
  path: "/api/v1/auth", // cookie only sent to auth routes
};

// Embed token family in cookie name to support multiple sessions
// Alternative: store family in a separate cookie
const setRefreshCookie = (res, token, family, userId = null) => {
  const cookiePayload = JSON.stringify({ token, family, userId });
  res.cookie(TOKEN_COOKIE_NAME, cookiePayload, REFRESH_COOKIE_OPTIONS);
};

const clearRefreshCookie = (res) => {
  res.clearCookie(TOKEN_COOKIE_NAME, { path: "/api/v1/auth" });
};

const register = asyncWrapper(async (req, res) => {
  const user = await authService.register(req.body);
  apiResponse.created(res, {
    message: "Registration successful. Please verify your email.",
    data: { user },
  });
});

const login = asyncWrapper(async (req, res) => {
  const { accessToken, refreshToken, family, user } = await authService.login({
    ...req.body,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  setRefreshCookie(res, refreshToken, family, user.id.toString());

  apiResponse.success(res, {
    message: "Login successful",
    data: { accessToken, user },
  });
});

const refresh = asyncWrapper(async (req, res) => {
  const cookieRaw = req.cookies[TOKEN_COOKIE_NAME];

  if (!cookieRaw) {
    return res.status(401).json({
      success: false,
      message: "No refresh token",
      code: "UNAUTHORIZED",
    });
  }

  let cookieData;
  try {
    cookieData = JSON.parse(cookieRaw);
  } catch {
    clearRefreshCookie(res);
    return res.status(401).json({
      success: false,
      message: "Invalid session",
      code: "UNAUTHORIZED",
    });
  }

  const { token: refreshToken, family, userId: cookieUserId } = cookieData;

  if (!refreshToken || !family) {
    clearRefreshCookie(res);
    return res.status(401).json({
      success: false,
      message: "Invalid session data",
      code: "UNAUTHORIZED",
    });
  }

  // Extract userId from expired access token OR from cookie
  let userId = cookieUserId || null;

  // Try to decode the access token (even if expired) to get userId
  if (!userId) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.decode(authHeader.slice(7));
        userId = decoded?.sub || null;
      } catch {
        /* ignore */
      }
    }
  }

  if (!userId) {
    clearRefreshCookie(res);
    return res.status(401).json({
      success: false,
      message: "Cannot identify user session",
      code: "UNAUTHORIZED",
    });
  }

  try {
    const tokens = await authService.refreshTokens({
      refreshToken,
      family,
      userId,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Rotate cookie with new token + userId embedded
    setRefreshCookie(res, tokens.refreshToken, tokens.family, userId);

    apiResponse.success(res, {
      message: "Token refreshed",
      data: { accessToken: tokens.accessToken },
    });
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
});

const logout = asyncWrapper(async (req, res) => {
  const cookieRaw = req.cookies[TOKEN_COOKIE_NAME];
  let family = null;

  if (cookieRaw) {
    try {
      family = JSON.parse(cookieRaw).family;
    } catch {
      /* ignore */
    }
  }

  await authService.logout({
    userId: req.user.id,
    family,
    logoutAll: req.query.all === "true",
  });

  clearRefreshCookie(res);

  apiResponse.success(res, { message: "Logged out successfully", data: null });
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
    message: "Profile fetched",
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
