// src/modules/admin/userMgmt.controller.js
const mongoose = require("mongoose");
const User = require("../users/user.model");
const userRepository = require("../users/user.repository");
const { getRedisClient } = require("../../config/redis");
const { deleteAsset } = require("../../config/cloudinary");
const cacheManager = require("../../shared/cache/cache.manager");
const apiResponse = require("../../shared/utils/apiResponse");
const asyncWrapper = require("../../shared/utils/asyncWrapper");
const AppError = require("../../shared/utils/AppError");
const logger = require("../../config/logger");

// GET /admin/users — list all users (including banned)
const listUsers = asyncWrapper(async (req, res) => {
  const { page = 1, limit = 20, role, search, banned } = req.query;

  const filter = {};
  if (role) filter.role = role;
  if (banned === "true") filter.isBanned = true;
  if (banned === "false") filter.isBanned = false;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [users, total] = await Promise.all([
    User.find(filter)
      .setOptions({ includeDeleted: true })
      .select(
        "name email role avatar emailVerified isBanned isDeleted createdAt lastLoginAt loginAttempts",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    User.countDocuments(filter).setOptions({ includeDeleted: true }),
  ]);

  apiResponse.success(res, {
    message: "Users fetched",
    data: { users },
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// GET /admin/users/:id — get single user (full details)
const getUser = asyncWrapper(async (req, res) => {
  const user = await User.findById(req.params.id)
    .setOptions({ includeDeleted: true })
    .select(
      "-refreshTokens -passwordHash -emailVerificationToken -passwordResetToken",
    )
    .lean();

  if (!user) throw AppError.notFound("User");

  apiResponse.success(res, { message: "User fetched", data: { user } });
});

// PATCH /admin/users/:id/ban
const banUser = asyncWrapper(async (req, res) => {
  const { reason } = req.body;
  if (!reason) throw AppError.badRequest("Ban reason is required");

  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound("User");
  if (user.role === "admin")
    throw AppError.forbidden("Cannot ban another admin");
  if (user.isBanned) throw AppError.conflict("User is already banned");

  // Capture before state for audit log
  req.audit.before = { isBanned: false };

  // 1. Ban user + wipe all refresh tokens (force logout everywhere)
  await User.updateOne(
    { _id: user._id },
    {
      $set: { isBanned: true, refreshTokens: [] },
    },
  );

  // 2. Blacklist their current access token (if provided via header)
  // We don't have the token here — access token will naturally expire in 15min
  // For immediate effect, the isBanned check in authenticate middleware handles it
  // (we need to add that check — see authenticate.js update below)
  const redis = getRedisClient();
  await redis.setEx(`banned:user:${user._id}`, 15 * 60, "1");

  // 3. Invalidate profile cache
  await cacheManager.invalidateUser(user._id.toString());

  req.audit.after = { isBanned: true, reason };

  logger.info("User banned", {
    targetUserId: user._id,
    adminId: req.user.id,
    reason,
  });

  apiResponse.success(res, {
    message: "User banned successfully",
    data: { userId: user._id, isBanned: true },
  });
});

// PATCH /admin/users/:id/unban
const unbanUser = asyncWrapper(async (req, res) => {
  const user = await User.findById(req.params.id).setOptions({
    includeDeleted: true,
  });
  if (!user) throw AppError.notFound("User");
  if (!user.isBanned) throw AppError.conflict("User is not banned");

  req.audit.before = { isBanned: true };

  await User.updateOne({ _id: user._id }, { $set: { isBanned: false } });
  await cacheManager.invalidateUser(user._id.toString());

  req.audit.after = { isBanned: false };

  apiResponse.success(res, {
    message: "User unbanned successfully",
    data: { userId: user._id, isBanned: false },
  });
});

// PATCH /admin/users/:id/role
const changeRole = asyncWrapper(async (req, res) => {
  const { role } = req.body;
  const validRoles = ["user", "seller", "admin"];

  if (!validRoles.includes(role)) {
    throw AppError.badRequest(
      `Invalid role. Must be one of: ${validRoles.join(", ")}`,
    );
  }

  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound("User");

  // Prevent demoting the last admin
  if (user.role === "admin" && role !== "admin") {
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount <= 1) {
      throw AppError.badRequest("Cannot demote the last admin");
    }
  }

  req.audit.before = { role: user.role };

  await User.updateOne(
    { _id: user._id },
    {
      $set: { role },
      // Wipe refresh tokens on role change (force re-login to get new role in JWT)
      $set: { refreshTokens: [], role },
    },
  );

  await cacheManager.invalidateUser(user._id.toString());
  req.audit.after = { role };

  logger.info("User role changed", {
    targetUserId: user._id,
    fromRole: user.role,
    toRole: role,
    adminId: req.user.id,
  });

  apiResponse.success(res, {
    message: `User role updated to ${role}`,
    data: { userId: user._id, role },
  });
});

// POST /admin/users/:id/force-logout
const forceLogout = asyncWrapper(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound("User");

  req.audit.before = { tokenCount: user.refreshTokens?.length || 0 };

  // Wipe all refresh tokens → all sessions invalidated
  await User.updateOne({ _id: user._id }, { $set: { refreshTokens: [] } });
  await cacheManager.invalidateUser(user._id.toString());

  req.audit.after = { tokenCount: 0, reason: "admin force logout" };

  logger.info("User force logged out", {
    targetUserId: user._id,
    adminId: req.user.id,
  });

  apiResponse.success(res, {
    message: "User sessions terminated",
    data: { userId: user._id },
  });
});

// DELETE /admin/users/:id — soft delete
const deleteUser = asyncWrapper(async (req, res) => {
  const { reason } = req.body;
  if (!reason) throw AppError.badRequest("Deletion reason is required");

  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound("User");
  if (user.role === "admin")
    throw AppError.forbidden("Cannot delete an admin account");

  req.audit.before = { isDeleted: false, email: user.email };

  await userRepository.softDelete(user._id.toString());
  await cacheManager.invalidateUser(user._id.toString());

  // Delete Cloudinary avatar if exists
  if (user.avatar?.publicId) {
    await deleteAsset(user.avatar.publicId).catch(() => {});
  }

  req.audit.after = { isDeleted: true, reason };

  apiResponse.success(res, {
    message: "User deleted",
    data: { userId: user._id },
  });
});

module.exports = {
  listUsers,
  getUser,
  banUser,
  unbanUser,
  changeRole,
  forceLogout,
  deleteUser,
};
