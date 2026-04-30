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
  path: "/", // cookie only sent to auth routes
};

// Embed token family in cookie name to support multiple sessions
// Alternative: store family in a separate cookie
const setRefreshCookie = (res, refreshToken, family, userId) => {
  res.cookie(
    TOKEN_COOKIE_NAME,
    JSON.stringify({
      token: refreshToken,
      family,
      userId,
    }),
    {
      httpOnly: true,
      secure: false, // IMPORTANT for localhost
      sameSite: "lax", // IMPORTANT
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  );
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

  // No refresh cookie
  if (!cookieRaw) {
    return res.status(401).json({
      success: false,
      message: "No refresh token",
      code: "UNAUTHORIZED",
    });
  }

  let cookieData;

  // Parse cookie safely
  try {
    cookieData =
      typeof cookieRaw === "string" ? JSON.parse(cookieRaw) : cookieRaw;
  } catch (err) {
    console.log("COOKIE PARSE ERROR:", err);

    clearRefreshCookie(res);

    return res.status(401).json({
      success: false,
      message: "Invalid session",
      code: "UNAUTHORIZED",
    });
  }

  const { token: refreshToken, family, userId } = cookieData;

  console.log({
    refreshToken,
    family,
    userId,
  });

  // Validate cookie payload
  if (!refreshToken || !family || !userId) {
    clearRefreshCookie(res);

    return res.status(401).json({
      success: false,
      message: "Invalid session data",
      code: "UNAUTHORIZED",
    });
  }

  try {
    // Generate new tokens
    const tokens = await authService.refreshTokens({
      refreshToken,
      family,
      userId,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // Ensure access token exists
    if (!tokens?.accessToken) {
      throw new Error("Access token was not generated");
    }

    // Rotate refresh cookie
    res.cookie(
      TOKEN_COOKIE_NAME,
      JSON.stringify({
        token: tokens.refreshToken,
        family: tokens.family,
        userId,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    );

    // Send new access token
    return apiResponse.success(res, {
      message: "Token refreshed",
      data: {
        accessToken: tokens.accessToken,
      },
    });
  } catch (err) {
    console.log("REFRESH ERROR:", err);

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
