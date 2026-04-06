// src/modules/auth/auth.dto.js
const Joi = require('joi');

const passwordRule = Joi.string()
  .min(8)
  .max(72) // bcrypt silently truncates at 72 bytes — enforce the limit
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
  .required()
  .messages({
    'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
    'string.min': 'Password must be at least 8 characters',
    'string.max': 'Password cannot exceed 72 characters',
  });

const registerDto = Joi.object({
  name: Joi.string().min(2).max(50).trim().required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: passwordRule,
  role: Joi.string().valid('user', 'seller').default('user'), // admin never self-registers
});

const loginDto = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required(),
});

const forgotPasswordDto = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
});

const resetPasswordDto = Joi.object({
  token: Joi.string().required(),
  password: passwordRule,
});

const changePasswordDto = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: passwordRule,
});

const verifyEmailDto = Joi.object({
  token: Joi.string().required(),
});

module.exports = {
  registerDto,
  loginDto,
  forgotPasswordDto,
  resetPasswordDto,
  changePasswordDto,
  verifyEmailDto,
};