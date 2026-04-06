// src/modules/users/user.model.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../../shared/constants/roles');

const addressSchema = new mongoose.Schema({
  label: { type: String, trim: true, default: 'Home' },      // 'Home', 'Work', etc.
  line1: { type: String, required: true, trim: true },
  line2: { type: String, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  pincode: { type: String, required: true, trim: true },
  country: { type: String, default: 'India', trim: true },
  isDefault: { type: Boolean, default: false },
}, { _id: true });

const refreshTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true },  // bcrypt hash — NEVER store plaintext
  family: { type: String, required: true },      // UUID family for rotation tracking
  userAgent: { type: String },
  ip: { type: String },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
  },
  passwordHash: {
    type: String,
    required: true,
    select: false, // NEVER returned in queries unless explicitly .select('+passwordHash')
  },
  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.USER,
  },
  avatar: {
    url: String,
    publicId: String, // Cloudinary public ID for deletion
  },
  addresses: {
    type: [addressSchema],
    validate: [arr => arr.length <= 5, 'Maximum 5 addresses allowed'],
  },

  // ── Email verification ──────────────────────────────────────────────
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, select: false },
  emailVerificationExpires: { type: Date, select: false },

  // ── Password reset ──────────────────────────────────────────────────
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },

  // ── Refresh tokens (array supports multi-device login) ───────────────
  refreshTokens: {
    type: [refreshTokenSchema],
    select: false, // excluded by default, loaded only in auth operations
  },

  // ── Account state ───────────────────────────────────────────────────
  isDeleted: { type: Boolean, default: false },     // soft delete
  isBanned: { type: Boolean, default: false },
  lastLoginAt: { type: Date },
  loginAttempts: { type: Number, default: 0 },      // brute force tracking
  lockUntil: { type: Date },                         // account lockout

}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      delete ret.passwordHash;
      delete ret.refreshTokens;
      delete ret.emailVerificationToken;
      delete ret.emailVerificationExpires;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      delete ret.__v;
      return ret;
    },
  },
});

// ── Indexes ──────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 });                          // unique login lookup
userSchema.index({ isDeleted: 1, role: 1 });             // admin user list
userSchema.index({ 'refreshTokens.family': 1 });          // token family lookup
userSchema.index({ passwordResetToken: 1 }, { sparse: true });
userSchema.index({ emailVerificationToken: 1 }, { sparse: true });

// ── Virtual: is account locked? ───────────────────────────────────────────────
userSchema.virtual('isLocked').get(function () {
  return this.lockUntil && this.lockUntil > Date.now();
});

// ── Methods ──────────────────────────────────────────────────────────────────

// Compare plaintext password with stored hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Increment login failures, lock after 5 attempts
userSchema.methods.incrementLoginAttempts = async function () {
  // Reset lock if it expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: '' },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };
  // Lock for 2 hours after 5 failures
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) };
  }
  return this.updateOne(updates);
};

// ── Pre-save: hash password ───────────────────────────────────────────────────
// Only runs when passwordHash field is modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// ── Query middleware: exclude soft-deleted docs by default ────────────────────
// Any find* query automatically excludes deleted users
// Override with .setOptions({ includeDeleted: true }) for admin queries
userSchema.pre(/^find/, function (next) {
  if (!this.getOptions().includeDeleted) {
    this.where({ isDeleted: false, isBanned: false });
  }
  next();
});

module.exports = mongoose.model('User', userSchema);